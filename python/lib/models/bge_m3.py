"""
BGE-M3 Embedding Provider

Wraps the existing sentence-transformers implementation for BGE-M3.
"""

from typing import List
import numpy as np

from ..providers import LocalEmbeddingProvider, EmbeddingModelConfig


class BGEM3Provider(LocalEmbeddingProvider):
    """BGE-M3 embedding provider using sentence-transformers."""

    def __init__(self, config: EmbeddingModelConfig):
        super().__init__(config)

    def embed(self, texts: List[str], batch_size: int = 8) -> np.ndarray:
        """
        Embed texts using BGE-M3.

        Note: BGE-M3 performs best when prefixed with "query:" or "passage:",
        but for cross-lingual comparison we use raw text.
        """
        model = self._load_model()
        embeddings = model.encode(
            texts,
            batch_size=batch_size,
            normalize_embeddings=True,
            show_progress_bar=len(texts) > 10
        )
        return np.array(embeddings)
