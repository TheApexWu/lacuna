"""
NVIDIA Embedding Provider

Uses NVIDIA's Llama Nemotron Embed model for multilingual embeddings.

NOTE: The original NV-Embed-v2 (nvidia/NV-Embed-v2) has compatibility issues
with transformers >= 4.41 due to API changes in DynamicCache and MistralDecoderLayer.
We now use the newer llama-nemotron-embed-1b-v2 which is:
- Compatible with transformers 4.44+
- Smaller (1B vs 7B params) - works better on CPU
- Multilingual with 26 language support
- Supports dynamic embedding sizes (Matryoshka)
"""

from typing import List, Optional
import numpy as np

from ..providers import EmbeddingProvider, EmbeddingModelConfig


# Model variants available
NVIDIA_EMBED_MODELS = {
    # Recommended: Works with transformers >= 4.44
    "llama-nemotron-1b": {
        "model_id": "nvidia/llama-nemotron-embed-1b-v2",
        "dimensions": 2048,
        "notes": "Llama 3.2 based, multilingual, 1B params",
    },
    # Legacy: NV-Embed-v2 (requires transformers < 4.41)
    "nv-embed-v2": {
        "model_id": "nvidia/NV-Embed-v2",
        "dimensions": 4096,
        "notes": "7B params, requires PCA reduction, transformers < 4.41",
    },
}

# Default to the compatible model
DEFAULT_MODEL = "llama-nemotron-1b"


class NVEmbedProvider(EmbeddingProvider):
    """
    NVIDIA embedding provider using Llama Nemotron Embed.

    Uses nvidia/llama-nemotron-embed-1b-v2 by default, which is compatible
    with current transformers versions and supports multilingual embeddings.
    """

    def __init__(self, config: EmbeddingModelConfig):
        super().__init__(config)
        self._model = None
        self._pca = None
        self._pca_fitted = False
        self._actual_model_id = None
        self._actual_dimensions = None

    def _load_model(self):
        """Lazy load the NVIDIA embedding model."""
        if self._model is None:
            from sentence_transformers import SentenceTransformer

            # Determine which model to use
            model_id = self.config.model_id

            # If using the legacy NV-Embed-v2, try to switch to the compatible version
            if "NV-Embed-v2" in model_id:
                print(f"[{self.key}] NV-Embed-v2 has compatibility issues with transformers >= 4.41")
                print(f"[{self.key}] Switching to nvidia/llama-nemotron-embed-1b-v2 (compatible)")
                model_id = NVIDIA_EMBED_MODELS["llama-nemotron-1b"]["model_id"]
                self._actual_dimensions = NVIDIA_EMBED_MODELS["llama-nemotron-1b"]["dimensions"]

            self._actual_model_id = model_id
            print(f"[{self.key}] Loading {model_id}...")

            # Force CPU to avoid MPS memory issues on Apple Silicon
            self._model = SentenceTransformer(
                model_id,
                trust_remote_code=True,
                device="cpu"
            )
            print(f"[{self.key}] Model loaded successfully.")

        return self._model

    def _get_pca(self, n_components: int = 1024):
        """Get or create PCA reducer."""
        if self._pca is None:
            from sklearn.decomposition import PCA
            self._pca = PCA(n_components=n_components)
        return self._pca

    def embed(self, texts: List[str], batch_size: int = 8) -> np.ndarray:
        """
        Embed texts using NVIDIA's embedding model.

        For the Llama Nemotron model (2048 dims), we reduce to 1024 for
        consistency with other models in the benchmark.
        """
        model = self._load_model()

        # Llama Nemotron Embed uses instruction format
        # For semantic similarity retrieval
        instruction = "Instruct: Retrieve semantically similar passages.\nQuery: "

        # Prepend instruction to each text
        texts_with_instruction = [f"{instruction}{text}" for text in texts]

        embeddings = model.encode(
            texts_with_instruction,
            batch_size=batch_size,
            normalize_embeddings=False,  # Normalize after dimension reduction
            show_progress_bar=len(texts) > 10
        )

        embeddings_array = np.array(embeddings, dtype=np.float32)

        # Get actual embedding dimension
        actual_dim = embeddings_array.shape[1]
        target_dim = self.config.dimensions

        # Apply dimension reduction if needed
        if actual_dim > target_dim:
            if self.config.requires_pca:
                # Use PCA for reduction
                pca = self._get_pca(target_dim)

                if not self._pca_fitted:
                    print(f"[{self.key}] Fitting PCA: {actual_dim} -> {target_dim} dimensions...")
                    if len(texts) >= target_dim:
                        pca.fit(embeddings_array)
                        self._pca_fitted = True
                    else:
                        # Not enough samples for full PCA, use truncation
                        print(f"[{self.key}] Not enough samples for PCA ({len(texts)} < {target_dim}), truncating...")
                        embeddings_array = embeddings_array[:, :target_dim]

                if self._pca_fitted:
                    embeddings_array = pca.transform(embeddings_array)
            else:
                # Use Matryoshka truncation (model supports this natively)
                print(f"[{self.key}] Truncating dimensions: {actual_dim} -> {target_dim}")
                embeddings_array = embeddings_array[:, :target_dim]

        # Normalize
        norms = np.linalg.norm(embeddings_array, axis=1, keepdims=True)
        embeddings_array = embeddings_array / (norms + 1e-10)

        return embeddings_array

    def embed_raw(self, texts: List[str], batch_size: int = 8) -> np.ndarray:
        """
        Embed without dimension reduction (returns full embedding vectors).

        Useful for detailed analysis of the embedding space.
        """
        model = self._load_model()

        instruction = "Instruct: Retrieve semantically similar passages.\nQuery: "
        texts_with_instruction = [f"{instruction}{text}" for text in texts]

        embeddings = model.encode(
            texts_with_instruction,
            batch_size=batch_size,
            normalize_embeddings=True,
            show_progress_bar=len(texts) > 10
        )

        return np.array(embeddings, dtype=np.float32)

    def is_available(self) -> bool:
        """Check if the NVIDIA embedding model is available."""
        try:
            from sentence_transformers import SentenceTransformer
            return True
        except ImportError:
            return False
