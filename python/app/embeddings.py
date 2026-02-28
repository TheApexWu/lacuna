"""BGE-M3 embedding model wrapper."""

import logging
from typing import List
import numpy as np

# Workaround for FlagEmbedding import issue - use sentence-transformers directly
try:
    from FlagEmbedding import BGEM3FlagModel
    USE_FLAG_EMBEDDING = True
except (ImportError, NameError) as e:
    # Fallback to sentence-transformers if FlagEmbedding has issues
    logging.warning(f"FlagEmbedding import failed ({e}), falling back to sentence-transformers")
    from sentence_transformers import SentenceTransformer
    USE_FLAG_EMBEDDING = False

from .config import settings

logger = logging.getLogger(__name__)


class EmbeddingService:
    """Service for generating BGE-M3 embeddings."""

    def __init__(self):
        """Initialize the BGE-M3 model."""
        self.model = None
        self.use_flag_embedding = USE_FLAG_EMBEDDING
        self._load_model()

    def _load_model(self):
        """Load the BGE-M3 model."""
        try:
            logger.info(f"Loading BGE-M3 model: {settings.bge_model_name}")

            if self.use_flag_embedding:
                self.model = BGEM3FlagModel(
                    settings.bge_model_name,
                    use_fp16=True  # Use half precision for faster inference
                )
            else:
                # Use sentence-transformers directly
                self.model = SentenceTransformer(settings.bge_model_name)

            logger.info("BGE-M3 model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load BGE-M3 model: {e}")
            raise

    def embed(self, text: str) -> np.ndarray:
        """
        Generate embedding for input text.

        Args:
            text: Input text to embed

        Returns:
            1024-dimensional embedding vector as numpy array
        """
        if self.model is None:
            raise RuntimeError("BGE-M3 model not loaded")

        try:
            if self.use_flag_embedding:
                # BGE-M3 returns dict with 'dense_vecs' key containing embeddings
                embeddings = self.model.encode(
                    [text],
                    batch_size=1,
                    max_length=512  # BGE-M3 max length
                )['dense_vecs']
                return embeddings[0]
            else:
                # sentence-transformers returns numpy array directly
                embedding = self.model.encode(text, normalize_embeddings=False)
                return embedding
        except Exception as e:
            logger.error(f"Embedding generation failed: {e}")
            raise

    def embed_batch(self, texts: List[str]) -> np.ndarray:
        """
        Generate embeddings for multiple texts.

        Args:
            texts: List of input texts to embed

        Returns:
            Array of embeddings with shape (len(texts), 1024)
        """
        if self.model is None:
            raise RuntimeError("BGE-M3 model not loaded")

        try:
            if self.use_flag_embedding:
                embeddings = self.model.encode(
                    texts,
                    batch_size=32,
                    max_length=512
                )['dense_vecs']
                return embeddings
            else:
                # sentence-transformers batch encode
                embeddings = self.model.encode(
                    texts,
                    batch_size=32,
                    normalize_embeddings=False,
                    show_progress_bar=True
                )
                return embeddings
        except Exception as e:
            logger.error(f"Batch embedding generation failed: {e}")
            raise
