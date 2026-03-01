"""
Cohere Embed v3 Provider

Uses the Cohere API for multilingual embeddings.
Production-grade multilingual embedding model.
"""

from typing import List, Optional
import numpy as np

from ..providers import APIEmbeddingProvider, EmbeddingModelConfig


class CohereEmbedProvider(APIEmbeddingProvider):
    """Cohere API embedding provider."""

    def __init__(self, config: EmbeddingModelConfig, api_key: Optional[str] = None):
        super().__init__(config, api_key)
        self._client = None

    def _get_client(self):
        """Lazy load the Cohere client."""
        if self._client is None:
            import cohere
            self._client = cohere.ClientV2(api_key=self.api_key)
        return self._client

    def embed(self, texts: List[str], batch_size: int = 8) -> np.ndarray:
        """
        Embed texts using Cohere API.

        Args:
            texts: List of strings to embed
            batch_size: Not used (API handles batching)

        Returns:
            np.ndarray of shape (len(texts), 1024)
        """
        if not self.is_available():
            raise ValueError("Cohere API key not set. Set COHERE_API_KEY env var.")

        client = self._get_client()

        # Cohere v2 API
        response = client.embed(
            texts=texts,
            model=self.config.model_id,
            input_type="clustering",  # Best for semantic similarity
            embedding_types=["float"]
        )

        # Extract embeddings
        embeddings = response.embeddings.float_
        embeddings_array = np.array(embeddings, dtype=np.float32)

        # Normalize
        norms = np.linalg.norm(embeddings_array, axis=1, keepdims=True)
        embeddings_array = embeddings_array / (norms + 1e-10)

        return embeddings_array
