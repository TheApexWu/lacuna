"""Semantic neighbor search using cosine similarity."""

import logging
import json
from pathlib import Path
from typing import List, Dict, Tuple
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

from .config import settings
from .models import Neighbor

logger = logging.getLogger(__name__)


class NeighborSearch:
    """Service for finding semantic neighbors using cosine similarity."""

    def __init__(self):
        """Initialize neighbor search service."""
        self.embeddings: Dict[str, np.ndarray] = {}
        self.concept_ids: Dict[str, List[str]] = {}
        self.concept_labels: Dict[str, Dict[str, str]] = {}
        self._load_data()

    def _load_data(self):
        """Load pre-computed embeddings and concept metadata."""
        data_dir = Path(settings.data_dir)

        for lang in ["en", "de"]:
            # Load embeddings
            embeddings_path = data_dir / f"embeddings_{lang}.npy"
            if embeddings_path.exists():
                self.embeddings[lang] = np.load(embeddings_path)
                logger.info(f"Loaded {len(self.embeddings[lang])} embeddings for {lang}")
            else:
                logger.warning(f"Embeddings not found: {embeddings_path}")

            # Load concept IDs
            ids_path = data_dir / f"concept_ids_{lang}.json"
            if ids_path.exists():
                with open(ids_path, "r") as f:
                    self.concept_ids[lang] = json.load(f)
                logger.info(f"Loaded {len(self.concept_ids[lang])} concept IDs for {lang}")
            else:
                logger.warning(f"Concept IDs not found: {ids_path}")

        # Load concept metadata (labels)
        versailles_path = data_dir / "versailles.json"
        if versailles_path.exists():
            with open(versailles_path, "r") as f:
                concepts = json.load(f)

            # Build label lookup: {lang: {id: label}}
            for lang in ["en", "de"]:
                self.concept_labels[lang] = {}
                for concept in concepts:
                    concept_id = concept["id"]
                    if lang in concept["labels"]:
                        self.concept_labels[lang][concept_id] = concept["labels"][lang]

            logger.info(f"Loaded labels for {len(concepts)} concepts")
        else:
            logger.warning(f"Versailles concepts not found: {versailles_path}")

    def find_neighbors(
        self,
        embedding: np.ndarray,
        language: str,
        n: int = None
    ) -> List[Neighbor]:
        """
        Find top-N nearest neighbors using cosine similarity.

        Args:
            embedding: Query embedding vector (1024-dim)
            language: Language code (en, de)
            n: Number of neighbors to return (default: settings.n_neighbors)

        Returns:
            List of Neighbor objects sorted by similarity (descending)
        """
        if n is None:
            n = settings.n_neighbors

        if language not in self.embeddings:
            raise ValueError(f"No embeddings available for language: {language}")

        try:
            # Compute cosine similarities
            similarities = cosine_similarity(
                embedding.reshape(1, -1),
                self.embeddings[language]
            )[0]

            # Get top-N indices (excluding identical match if present)
            top_indices = np.argsort(similarities)[::-1][:n + 5]  # Get extra to filter

            # Build neighbor list
            neighbors = []
            for idx in top_indices:
                if len(neighbors) >= n:
                    break

                concept_id = self.concept_ids[language][idx]
                similarity = float(similarities[idx])

                # Skip near-identical matches (likely the same concept)
                if similarity > 0.999:
                    continue

                # Get label
                label = self.concept_labels.get(language, {}).get(
                    concept_id,
                    concept_id
                )

                neighbors.append(
                    Neighbor(
                        id=concept_id,
                        label=label,
                        similarity=similarity
                    )
                )

            return neighbors
        except Exception as e:
            logger.error(f"Neighbor search failed: {e}")
            raise

    def is_available(self, language: str) -> bool:
        """Check if neighbor search is available for language."""
        return (
            language in self.embeddings and
            language in self.concept_ids and
            len(self.embeddings[language]) > 0
        )
