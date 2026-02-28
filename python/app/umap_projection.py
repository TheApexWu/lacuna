"""UMAP projection and weight calculation."""

import logging
import pickle
from pathlib import Path
from typing import Tuple, Dict
import numpy as np
from umap import UMAP

from .config import settings

logger = logging.getLogger(__name__)


class UMAPProjector:
    """Service for UMAP projection and weight calculation."""

    def __init__(self):
        """Initialize UMAP projector."""
        self.models: Dict[str, UMAP] = {}
        self.min_norms: Dict[str, float] = {}
        self.max_norms: Dict[str, float] = {}
        self._load_models()

    def _load_models(self):
        """Load pre-fitted UMAP models for each language."""
        data_dir = Path(settings.data_dir)

        for lang in ["en", "de"]:
            model_path = data_dir / f"umap_model_{lang}.pkl"

            if not model_path.exists():
                logger.warning(f"UMAP model not found: {model_path}")
                continue

            try:
                with open(model_path, "rb") as f:
                    model_data = pickle.load(f)

                self.models[lang] = model_data["model"]
                self.min_norms[lang] = model_data["min_norm"]
                self.max_norms[lang] = model_data["max_norm"]

                logger.info(f"Loaded UMAP model for {lang}")
            except Exception as e:
                logger.error(f"Failed to load UMAP model for {lang}: {e}")
                raise

    def project(self, embedding: np.ndarray, language: str) -> Tuple[float, float]:
        """
        Project embedding to 2D using pre-fitted UMAP.

        Args:
            embedding: 1024-dimensional embedding vector
            language: Language code (en, de)

        Returns:
            Tuple of (x, z) coordinates
        """
        if language not in self.models:
            raise ValueError(f"No UMAP model available for language: {language}")

        try:
            # UMAP expects 2D input (n_samples, n_features)
            embedding_2d = embedding.reshape(1, -1)

            # Transform using pre-fitted model
            position = self.models[language].transform(embedding_2d)[0]

            return float(position[0]), float(position[1])
        except Exception as e:
            logger.error(f"UMAP projection failed: {e}")
            raise

    def calculate_weight(self, embedding: np.ndarray, language: str) -> float:
        """
        Calculate semantic weight from embedding magnitude.

        Weight is normalized L2 norm: (||embedding|| - min) / (max - min)

        Args:
            embedding: 1024-dimensional embedding vector
            language: Language code (en, de)

        Returns:
            Normalized weight between 0 and 1
        """
        if language not in self.min_norms or language not in self.max_norms:
            raise ValueError(f"Normalization stats not available for language: {language}")

        try:
            # Calculate L2 norm
            norm = float(np.linalg.norm(embedding))

            # Normalize to [0, 1] range
            min_norm = self.min_norms[language]
            max_norm = self.max_norms[language]

            if max_norm == min_norm:
                return 0.5  # Fallback for edge case

            weight = (norm - min_norm) / (max_norm - min_norm)

            # Clamp to [0, 1] range
            return max(0.0, min(1.0, weight))
        except Exception as e:
            logger.error(f"Weight calculation failed: {e}")
            raise

    def is_available(self, language: str) -> bool:
        """Check if UMAP model is available for language."""
        return language in self.models
