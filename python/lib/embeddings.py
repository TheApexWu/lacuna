"""
LACUNA BGE-M3 embedding wrapper.

Provides:
- Lazy model loading (2GB+ model)
- Batch embedding
- Cosine similarity matrix computation
- Duplicate detection
"""

import numpy as np
from typing import List, Dict, Optional, Tuple
from functools import lru_cache


# Global model instance (lazy loaded)
_model = None


def get_model():
    """Lazy load BGE-M3 model via sentence-transformers."""
    global _model
    if _model is None:
        print("[embeddings] Loading BGE-M3 model (this takes ~30s first time)...")
        from sentence_transformers import SentenceTransformer
        _model = SentenceTransformer("BAAI/bge-m3")
        print("[embeddings] Model loaded.")
    return _model


def embed_texts(texts: List[str], batch_size: int = 8) -> np.ndarray:
    """
    Embed a list of texts using BGE-M3.

    Args:
        texts: List of strings to embed
        batch_size: Batch size for encoding

    Returns:
        np.ndarray of shape (len(texts), 1024)
    """
    model = get_model()
    # sentence-transformers returns numpy array directly
    embeddings = model.encode(texts, batch_size=batch_size, normalize_embeddings=True)
    return np.array(embeddings)


def embed_single(text: str) -> np.ndarray:
    """Embed a single text. Returns 1D array of shape (1024,)."""
    return embed_texts([text])[0]


def cosine_similarity_matrix(embeddings: np.ndarray) -> np.ndarray:
    """
    Compute pairwise cosine similarity matrix.

    Args:
        embeddings: (N, D) array of embeddings

    Returns:
        (N, N) similarity matrix where [i,j] is cosine sim between i and j
    """
    # Normalize
    norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
    normalized = embeddings / (norms + 1e-10)
    # Dot product of normalized vectors = cosine similarity
    return normalized @ normalized.T


def find_duplicates(
    embeddings: np.ndarray,
    threshold: float = 0.85
) -> List[Tuple[int, int, float]]:
    """
    Find duplicate pairs based on cosine similarity threshold.

    Args:
        embeddings: (N, D) array
        threshold: Similarity threshold for duplicates

    Returns:
        List of (i, j, similarity) tuples where similarity > threshold
    """
    sim_matrix = cosine_similarity_matrix(embeddings)
    duplicates = []
    n = len(embeddings)
    for i in range(n):
        for j in range(i + 1, n):
            if sim_matrix[i, j] > threshold:
                duplicates.append((i, j, float(sim_matrix[i, j])))
    return duplicates


def compute_uniformity_score(embeddings: np.ndarray) -> float:
    """
    Compute uniformity score - how spread out embeddings are.

    Low uniformity = embeddings too similar (boring/generic definitions)
    High uniformity = good semantic diversity

    Returns:
        Score from 0 (all identical) to 1 (well spread)
    """
    if len(embeddings) < 2:
        return 1.0

    sim_matrix = cosine_similarity_matrix(embeddings)
    # Get upper triangle (exclude diagonal)
    n = len(embeddings)
    upper_tri = []
    for i in range(n):
        for j in range(i + 1, n):
            upper_tri.append(sim_matrix[i, j])

    if not upper_tri:
        return 1.0

    mean_sim = np.mean(upper_tri)
    std_sim = np.std(upper_tri)

    # High mean similarity + low std = bad (everything similar)
    # We want: low mean, high std
    # Score = 1 - mean + std/2 (normalized)
    uniformity = 1 - mean_sim + min(std_sim, 0.3)
    return float(np.clip(uniformity, 0, 1))


def compute_extremity_score(
    embedding: np.ndarray,
    reference_embeddings: np.ndarray
) -> float:
    """
    Check if an embedding is an extreme outlier from reference set.

    Args:
        embedding: Single (D,) embedding to check
        reference_embeddings: (N, D) reference embeddings

    Returns:
        Score 0-1 where 0 = extreme outlier, 1 = fits well
    """
    if len(reference_embeddings) == 0:
        return 1.0

    # Compute cosine similarity to all reference embeddings
    embedding = embedding.reshape(1, -1)
    ref_norms = np.linalg.norm(reference_embeddings, axis=1, keepdims=True)
    emb_norm = np.linalg.norm(embedding)

    ref_normalized = reference_embeddings / (ref_norms + 1e-10)
    emb_normalized = embedding / (emb_norm + 1e-10)

    similarities = (ref_normalized @ emb_normalized.T).flatten()

    # If max similarity is very low, it's an outlier
    max_sim = float(np.max(similarities))
    mean_sim = float(np.mean(similarities))

    # Return score based on how well it fits
    # Very low max_sim = outlier
    return float(np.clip(max_sim * 0.7 + mean_sim * 0.3, 0, 1))


def compute_embedding_weight(
    embedding: np.ndarray,
    all_embeddings: np.ndarray
) -> float:
    """
    Compute semantic weight based on embedding magnitude and centrality.

    Args:
        embedding: Single embedding
        all_embeddings: All embeddings in the set

    Returns:
        Weight 0-1
    """
    # L2 norm of embedding
    norm = float(np.linalg.norm(embedding))

    # Compute relative to all embeddings
    all_norms = np.linalg.norm(all_embeddings, axis=1)
    min_norm = float(np.min(all_norms))
    max_norm = float(np.max(all_norms))

    if max_norm - min_norm < 1e-6:
        return 0.5

    # Normalize to 0-1
    weight = (norm - min_norm) / (max_norm - min_norm)
    return float(np.clip(weight, 0, 1))
