"""
LACUNA Embedding Provider Abstraction Layer

Provides a unified interface for different embedding models,
enabling model comparison benchmarking.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from enum import Enum
from typing import List, Optional

import numpy as np


class ProviderType(Enum):
    """Type of embedding provider."""
    LOCAL = "local"
    API = "api"


@dataclass
class EmbeddingModelConfig:
    """Configuration for an embedding model."""
    name: str                      # Human-readable name
    model_id: str                  # Model identifier (HuggingFace ID or API model name)
    dimensions: int                # Output embedding dimensions
    provider_type: ProviderType    # LOCAL or API
    key: str                       # Short key for CLI/API (e.g., "bge-m3")
    notes: str = ""                # Additional notes about the model
    requires_pca: bool = False     # Whether model needs PCA reduction
    original_dimensions: int = 0   # Original dims before PCA (if applicable)


class EmbeddingProvider(ABC):
    """Abstract base class for embedding providers."""

    def __init__(self, config: EmbeddingModelConfig):
        self.config = config
        self._model = None

    @property
    def name(self) -> str:
        return self.config.name

    @property
    def dimensions(self) -> int:
        return self.config.dimensions

    @property
    def key(self) -> str:
        return self.config.key

    @abstractmethod
    def embed(self, texts: List[str], batch_size: int = 8) -> np.ndarray:
        """
        Embed a list of texts.

        Args:
            texts: List of strings to embed
            batch_size: Batch size for encoding (ignored by some providers)

        Returns:
            np.ndarray of shape (len(texts), self.dimensions)
        """
        pass

    def embed_single(self, text: str) -> np.ndarray:
        """Embed a single text. Returns 1D array."""
        return self.embed([text])[0]

    def is_available(self) -> bool:
        """Check if the provider is available (model loaded, API key set, etc.)."""
        return True


class LocalEmbeddingProvider(EmbeddingProvider):
    """Base class for local embedding providers using sentence-transformers."""

    def _load_model(self):
        """Lazy load the model."""
        if self._model is None:
            print(f"[{self.key}] Loading model {self.config.model_id}...")
            from sentence_transformers import SentenceTransformer
            self._model = SentenceTransformer(self.config.model_id)
            print(f"[{self.key}] Model loaded.")
        return self._model

    def embed(self, texts: List[str], batch_size: int = 8) -> np.ndarray:
        """Embed texts using sentence-transformers."""
        model = self._load_model()
        embeddings = model.encode(
            texts,
            batch_size=batch_size,
            normalize_embeddings=True,
            show_progress_bar=len(texts) > 10
        )
        return np.array(embeddings)


class APIEmbeddingProvider(EmbeddingProvider):
    """Base class for API-based embedding providers."""

    def __init__(self, config: EmbeddingModelConfig, api_key: Optional[str] = None):
        super().__init__(config)
        self.api_key = api_key

    def is_available(self) -> bool:
        """Check if API key is set."""
        return self.api_key is not None and len(self.api_key) > 0
