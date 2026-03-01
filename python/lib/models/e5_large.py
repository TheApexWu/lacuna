"""
Multilingual E5 Large Embedding Provider

Microsoft's contrastive multilingual embedding model.
"""

from typing import List
import numpy as np

from ..providers import LocalEmbeddingProvider, EmbeddingModelConfig


class E5LargeProvider(LocalEmbeddingProvider):
    """Multilingual E5 Large embedding provider."""

    def __init__(self, config: EmbeddingModelConfig):
        super().__init__(config)

    def embed(self, texts: List[str], batch_size: int = 8) -> np.ndarray:
        """
        Embed texts using E5.

        Note: E5 recommends prefixes like "query:" or "passage:" but
        for cross-lingual concept comparison we use raw text.
        """
        model = self._load_model()
        embeddings = model.encode(
            texts,
            batch_size=batch_size,
            normalize_embeddings=True,
            show_progress_bar=len(texts) > 10
        )
        return np.array(embeddings)
