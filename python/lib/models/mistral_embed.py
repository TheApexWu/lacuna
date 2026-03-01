"""
Mistral Embed Provider

Uses the Mistral AI API for embeddings.
Required for alignment with Mistral LLM interpreter.
"""

from typing import List, Optional
import numpy as np

from ..providers import APIEmbeddingProvider, EmbeddingModelConfig


class MistralEmbedProvider(APIEmbeddingProvider):
    """Mistral API embedding provider."""

    def __init__(self, config: EmbeddingModelConfig, api_key: Optional[str] = None):
        super().__init__(config, api_key)
        self._client = None

    def _get_client(self):
        """Lazy load the Mistral client."""
        if self._client is None:
            from mistralai import Mistral
            self._client = Mistral(api_key=self.api_key)
        return self._client

    def embed(self, texts: List[str], batch_size: int = 8) -> np.ndarray:
        """
        Embed texts using Mistral API.

        Args:
            texts: List of strings to embed
            batch_size: Not used (API handles batching)

        Returns:
            np.ndarray of shape (len(texts), 1024)
        """
        if not self.is_available():
            raise ValueError("Mistral API key not set. Set MISTRAL_API_KEY env var.")

        client = self._get_client()

        # Mistral API accepts batches
        response = client.embeddings.create(
            model=self.config.model_id,
            inputs=texts
        )

        # Extract embeddings from response
        embeddings = [item.embedding for item in response.data]
        embeddings_array = np.array(embeddings, dtype=np.float32)

        # Normalize
        norms = np.linalg.norm(embeddings_array, axis=1, keepdims=True)
        embeddings_array = embeddings_array / (norms + 1e-10)

        return embeddings_array
