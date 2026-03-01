"""
LACUNA Benchmark Metrics

Four metrics for comparing cross-lingual embedding models:

1. CLAS (Cross-Lingual Alignment Score)
   - Avg cosine similarity between EN/DE embeddings of same concept
   - High = model collapses language differences

2. Topology Preservation (Mantel test)
   - Spearman correlation between EN and DE distance matrices
   - High = same structure in both languages

3. Cluster Coherence (Silhouette)
   - Per-cluster silhouette score for the 6 semantic clusters
   - Measured per language

4. Ghost Detection Rate
   - What fraction of known ghosts have low semantic weight?
   - Tests if model "sees" lacunae
"""

from dataclasses import dataclass, field
from typing import Dict, List, Tuple, Optional
import numpy as np
from scipy import stats
from scipy.spatial.distance import pdist, squareform


@dataclass
class MetricResults:
    """Results from all benchmark metrics for a model."""
    model_key: str
    clas_score: float = 0.0
    clas_per_concept: Dict[str, float] = field(default_factory=dict)
    topology_preservation: float = 0.0
    topology_p_value: float = 1.0
    cluster_coherence: Dict[str, float] = field(default_factory=dict)
    cluster_coherence_avg: float = 0.0
    ghost_detection_rate: float = 0.0
    ghost_scores: Dict[str, float] = field(default_factory=dict)

    def to_dict(self) -> dict:
        """Convert to JSON-serializable dict."""
        return {
            "model_key": self.model_key,
            "clas": {
                "score": self.clas_score,
                "per_concept": self.clas_per_concept,
            },
            "topology": {
                "preservation": self.topology_preservation,
                "p_value": self.topology_p_value,
            },
            "cluster_coherence": {
                "per_cluster": self.cluster_coherence,
                "average": self.cluster_coherence_avg,
            },
            "ghost_detection": {
                "rate": self.ghost_detection_rate,
                "per_ghost": self.ghost_scores,
            },
        }


def compute_clas(
    embeddings_en: np.ndarray,
    embeddings_de: np.ndarray,
    concept_ids: List[str]
) -> Tuple[float, Dict[str, float]]:
    """
    Compute Cross-Lingual Alignment Score (CLAS).

    CLAS measures how similar the EN and DE embeddings are for
    the same concept. High CLAS = model erases language differences.

    Args:
        embeddings_en: (N, D) English embeddings
        embeddings_de: (N, D) German embeddings
        concept_ids: List of concept IDs (same order as embeddings)

    Returns:
        Tuple of (average CLAS, per-concept CLAS dict)
    """
    if len(embeddings_en) != len(embeddings_de):
        raise ValueError("EN and DE embeddings must have same length")

    # Normalize embeddings
    en_norm = embeddings_en / (np.linalg.norm(embeddings_en, axis=1, keepdims=True) + 1e-10)
    de_norm = embeddings_de / (np.linalg.norm(embeddings_de, axis=1, keepdims=True) + 1e-10)

    # Compute cosine similarity for each concept
    per_concept = {}
    for i, cid in enumerate(concept_ids):
        sim = float(np.dot(en_norm[i], de_norm[i]))
        per_concept[cid] = sim

    # Average CLAS
    avg_clas = float(np.mean(list(per_concept.values())))

    return avg_clas, per_concept


def compute_topology_preservation(
    embeddings_en: np.ndarray,
    embeddings_de: np.ndarray,
    n_permutations: int = 999
) -> Tuple[float, float]:
    """
    Compute Topology Preservation using Mantel test.

    The Mantel test measures correlation between distance matrices.
    High correlation = same structure preserved across languages.

    Args:
        embeddings_en: (N, D) English embeddings
        embeddings_de: (N, D) German embeddings
        n_permutations: Number of permutations for p-value (0 for no p-value)

    Returns:
        Tuple of (Spearman correlation, p-value)
    """
    # Compute distance matrices (cosine distance = 1 - cosine similarity)
    dist_en = squareform(pdist(embeddings_en, metric='cosine'))
    dist_de = squareform(pdist(embeddings_de, metric='cosine'))

    # Flatten upper triangles for correlation
    n = len(embeddings_en)
    triu_indices = np.triu_indices(n, k=1)
    vec_en = dist_en[triu_indices]
    vec_de = dist_de[triu_indices]

    # Compute Spearman correlation
    correlation, _ = stats.spearmanr(vec_en, vec_de)

    # Permutation test for p-value
    if n_permutations > 0:
        perm_correlations = []
        for _ in range(n_permutations):
            perm = np.random.permutation(n)
            perm_vec_de = dist_de[perm][:, perm][triu_indices]
            perm_corr, _ = stats.spearmanr(vec_en, perm_vec_de)
            perm_correlations.append(perm_corr)

        p_value = (np.sum(np.abs(perm_correlations) >= np.abs(correlation)) + 1) / (n_permutations + 1)
    else:
        p_value = 0.0

    return float(correlation), float(p_value)


def compute_cluster_coherence(
    embeddings: np.ndarray,
    cluster_labels: List[str],
    language: str = "en"
) -> Tuple[Dict[str, float], float]:
    """
    Compute Cluster Coherence using Silhouette score.

    Silhouette measures how well clusters are separated.
    High score = clear semantic groupings.

    Args:
        embeddings: (N, D) embeddings
        cluster_labels: Cluster label for each concept
        language: Language identifier for reporting

    Returns:
        Tuple of (per-cluster scores, average score)
    """
    from sklearn.metrics import silhouette_samples, silhouette_score

    # Get unique clusters
    unique_clusters = list(set(cluster_labels))
    if len(unique_clusters) < 2:
        return {}, 0.0

    # Convert labels to numeric
    label_to_idx = {label: i for i, label in enumerate(unique_clusters)}
    numeric_labels = np.array([label_to_idx[l] for l in cluster_labels])

    # Compute per-sample silhouette
    try:
        sample_scores = silhouette_samples(embeddings, numeric_labels, metric='cosine')
        avg_score = float(silhouette_score(embeddings, numeric_labels, metric='cosine'))
    except ValueError:
        # Not enough samples per cluster
        return {}, 0.0

    # Aggregate per cluster
    per_cluster = {}
    for cluster in unique_clusters:
        mask = np.array([l == cluster for l in cluster_labels])
        if np.sum(mask) > 0:
            per_cluster[cluster] = float(np.mean(sample_scores[mask]))

    return per_cluster, avg_score


def compute_ghost_detection_rate(
    embeddings: np.ndarray,
    concept_ids: List[str],
    ghost_flags: Dict[str, bool],
    weight_threshold: float = 0.3
) -> Tuple[float, Dict[str, float]]:
    """
    Compute Ghost Detection Rate.

    Ghosts are concepts that don't exist in one language.
    A good model should give ghosts low semantic weight.

    Args:
        embeddings: (N, D) embeddings for ONE language
        concept_ids: List of concept IDs
        ghost_flags: Dict mapping concept_id -> is_ghost for this language
        weight_threshold: Weight below which we consider ghost "detected"

    Returns:
        Tuple of (detection rate, per-ghost scores)
    """
    # Compute semantic weights
    from lib.embeddings import compute_embedding_weight

    weights = {}
    for i, cid in enumerate(concept_ids):
        weight = compute_embedding_weight(embeddings[i], embeddings)
        weights[cid] = weight

    # Check ghosts
    ghost_scores = {}
    detected = 0
    total_ghosts = 0

    for cid, is_ghost in ghost_flags.items():
        if is_ghost and cid in weights:
            total_ghosts += 1
            weight = weights[cid]
            ghost_scores[cid] = weight
            if weight < weight_threshold:
                detected += 1

    detection_rate = detected / total_ghosts if total_ghosts > 0 else 0.0

    return detection_rate, ghost_scores


def run_all_metrics(
    embeddings_en: np.ndarray,
    embeddings_de: np.ndarray,
    concept_ids: List[str],
    cluster_labels: List[str],
    ghost_flags_en: Dict[str, bool],
    ghost_flags_de: Dict[str, bool],
    model_key: str
) -> MetricResults:
    """
    Run all benchmark metrics for a model.

    Args:
        embeddings_en: (N, D) English embeddings
        embeddings_de: (N, D) German embeddings
        concept_ids: List of concept IDs (same order)
        cluster_labels: Cluster label for each concept
        ghost_flags_en: Dict of concept_id -> is_ghost in English
        ghost_flags_de: Dict of concept_id -> is_ghost in German
        model_key: Model identifier

    Returns:
        MetricResults with all computed metrics
    """
    results = MetricResults(model_key=model_key)

    print(f"[metrics] Computing CLAS...")
    results.clas_score, results.clas_per_concept = compute_clas(
        embeddings_en, embeddings_de, concept_ids
    )

    print(f"[metrics] Computing Topology Preservation...")
    results.topology_preservation, results.topology_p_value = compute_topology_preservation(
        embeddings_en, embeddings_de, n_permutations=999
    )

    print(f"[metrics] Computing Cluster Coherence...")
    # Compute for both languages
    coherence_en, avg_en = compute_cluster_coherence(embeddings_en, cluster_labels, "en")
    coherence_de, avg_de = compute_cluster_coherence(embeddings_de, cluster_labels, "de")

    results.cluster_coherence = {
        "en": coherence_en,
        "de": coherence_de,
    }
    results.cluster_coherence_avg = (avg_en + avg_de) / 2

    print(f"[metrics] Computing Ghost Detection Rate...")
    # Compute for both languages
    rate_en, scores_en = compute_ghost_detection_rate(
        embeddings_en, concept_ids, ghost_flags_en
    )
    rate_de, scores_de = compute_ghost_detection_rate(
        embeddings_de, concept_ids, ghost_flags_de
    )

    results.ghost_detection_rate = (rate_en + rate_de) / 2
    results.ghost_scores = {"en": scores_en, "de": scores_de}

    print(f"[metrics] Metrics computed for {model_key}")
    print(f"  CLAS: {results.clas_score:.4f}")
    print(f"  Topology: {results.topology_preservation:.4f} (p={results.topology_p_value:.4f})")
    print(f"  Coherence: {results.cluster_coherence_avg:.4f}")
    print(f"  Ghost Detection: {results.ghost_detection_rate:.2%}")

    return results
