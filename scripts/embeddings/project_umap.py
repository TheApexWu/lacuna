"""
project_umap.py

Takes raw embeddings ({model}-raw.json) and produces the final embedding
data file ({model}.json) with:
  - UMAP-projected 2D positions per language
  - Procrustes-aligned to English
  - Cosine-to-EN scores
  - 43x43 pairwise cosine distance matrices
  - Weights derived from embedding norms / cluster centroids

Usage:
  python project_umap.py --input bge-m3-raw.json --output ../../src/data/embeddings/bge-m3.json

Output format matches the EmbeddingData TypeScript interface.
"""

import json
import argparse
import sys
from pathlib import Path

import numpy as np
from scipy.spatial.distance import cosine as cosine_distance
from scipy.linalg import orthogonal_procrustes
from sklearn.preprocessing import normalize
import umap

SCRIPT_DIR = Path(__file__).parent
CONCEPTS_PATH = SCRIPT_DIR / "concepts_input.json"

# Terrain coordinate range (matching curated data)
TERRAIN_RANGE = 35  # positions will be in [-35, 35]


def load_raw(input_path):
    """Load raw embedding file."""
    with open(input_path) as f:
        return json.load(f)


def load_concepts():
    """Load concept metadata."""
    with open(CONCEPTS_PATH) as f:
        data = json.load(f)
    return data["languages"], data["concepts"]


def cosine_sim(a, b):
    """Cosine similarity between two vectors."""
    return 1 - cosine_distance(a, b)


def procrustes_align(source, target):
    """Align source to target using Procrustes analysis.
    Both should be (n, 2) arrays.
    Returns aligned source."""
    # Center both
    source_centered = source - source.mean(axis=0)
    target_centered = target - target.mean(axis=0)

    # Scale to unit variance
    source_scale = np.sqrt((source_centered ** 2).sum()) or 1
    target_scale = np.sqrt((target_centered ** 2).sum()) or 1
    source_norm = source_centered / source_scale
    target_norm = target_centered / target_scale

    # Find optimal rotation
    R, _ = orthogonal_procrustes(source_norm, target_norm)

    # Apply rotation and rescale
    aligned = (source_norm @ R) * target_scale + target.mean(axis=0)
    return aligned


def project_language(vectors, n_neighbors=10, min_dist=0.3, random_state=42):
    """Project vectors to 2D using UMAP."""
    if len(vectors) < 4:
        return np.zeros((len(vectors), 2))

    reducer = umap.UMAP(
        n_components=2,
        n_neighbors=min(n_neighbors, len(vectors) - 1),
        min_dist=min_dist,
        metric="cosine",
        random_state=random_state,
    )
    return reducer.fit_transform(vectors)


def scale_to_terrain(positions):
    """Scale 2D positions to [-TERRAIN_RANGE, TERRAIN_RANGE]."""
    if len(positions) == 0:
        return positions

    # Center
    centered = positions - positions.mean(axis=0)

    # Scale to fit terrain range
    max_abs = np.abs(centered).max()
    if max_abs > 0:
        centered = centered / max_abs * TERRAIN_RANGE * 0.85  # 85% of range for padding

    return centered


def compute_pairwise(vectors):
    """Compute 43x43 cosine distance matrix."""
    n = len(vectors)
    matrix = np.zeros((n, n))
    normed = normalize(vectors, norm="l2")

    for i in range(n):
        for j in range(i + 1, n):
            dist = 1 - np.dot(normed[i], normed[j])
            matrix[i][j] = dist
            matrix[j][i] = dist

    return matrix


def derive_weights(vectors, concepts, cluster_map):
    """Derive weights from cosine similarity to cluster centroid."""
    normed = normalize(vectors, norm="l2")
    weights = np.zeros(len(vectors))

    # Compute cluster centroids
    clusters = {}
    for i, c in enumerate(concepts):
        cluster = c["cluster"]
        if cluster not in clusters:
            clusters[cluster] = []
        clusters[cluster].append(i)

    centroids = {}
    for cluster, indices in clusters.items():
        centroid = normed[indices].mean(axis=0)
        centroid = centroid / (np.linalg.norm(centroid) or 1)
        centroids[cluster] = centroid

    # Weight = cosine similarity to cluster centroid (0-1)
    for i, c in enumerate(concepts):
        centroid = centroids.get(c["cluster"])
        if centroid is not None:
            sim = np.dot(normed[i], centroid)
            weights[i] = max(0, min(1, (sim + 1) / 2))  # Map [-1,1] to [0,1]
        else:
            weights[i] = 0.5

    # Normalize to [0.2, 1.0] range for visual impact
    w_min, w_max = weights.min(), weights.max()
    if w_max > w_min:
        weights = 0.2 + (weights - w_min) / (w_max - w_min) * 0.8

    return weights


def main():
    parser = argparse.ArgumentParser(description="Project raw embeddings to 2D terrain")
    parser.add_argument("--input", required=True, help="Path to {model}-raw.json")
    parser.add_argument("--output", required=True, help="Output path for {model}.json")
    args = parser.parse_args()

    # Load data
    raw = load_raw(args.input)
    languages, concepts = load_concepts()
    concept_ids = [c["id"] for c in concepts]
    n_concepts = len(concepts)

    print(f"Model: {raw['modelName']} ({raw['modelId']})")
    print(f"Dimension: {raw['dimension']}")
    print(f"Concepts: {n_concepts}, Languages: {len(languages)}")

    # Extract vectors per language
    lang_vectors = {}  # lang → (n_concepts, dim) array
    for lang in languages:
        vectors = []
        for concept in concepts:
            key = f"{lang}:{concept['id']}"
            vec = raw["embeddings"].get(key)
            if vec is None:
                print(f"  Warning: missing embedding for {key}")
                vec = [0.0] * raw["dimension"]
            vectors.append(vec)
        lang_vectors[lang] = np.array(vectors, dtype=np.float32)

    # Project each language to 2D
    print("\nProjecting to 2D with UMAP...")
    lang_positions = {}
    for lang in languages:
        print(f"  {lang}...", end=" ", flush=True)
        positions = project_language(lang_vectors[lang])
        lang_positions[lang] = positions
        print("done")

    # Procrustes-align all languages to English
    print("\nProcrustes alignment to EN...")
    en_positions = scale_to_terrain(lang_positions["en"])
    lang_positions["en"] = en_positions
    for lang in languages:
        if lang == "en":
            continue
        aligned = procrustes_align(lang_positions[lang], en_positions)
        lang_positions[lang] = scale_to_terrain(aligned)
        print(f"  {lang} aligned")

    # Compute cosine-to-EN for each concept
    print("\nComputing cosine-to-EN...")
    cosine_to_en = {}  # conceptId → { lang → similarity }
    for i, concept in enumerate(concepts):
        cosine_to_en[concept["id"]] = {}
        en_vec = lang_vectors["en"][i]
        for lang in languages:
            if lang == "en":
                cosine_to_en[concept["id"]][lang] = 1.0
            else:
                sim = cosine_sim(en_vec, lang_vectors[lang][i])
                cosine_to_en[concept["id"]][lang] = round(float(sim), 4)

    # Compute pairwise distance matrices
    print("Computing pairwise distance matrices...")
    pairwise = {}
    for lang in languages:
        matrix = compute_pairwise(lang_vectors[lang])
        # Normalize to [0, 1]
        max_val = matrix.max()
        if max_val > 0:
            matrix = matrix / max_val
        pairwise[lang] = np.round(matrix, 4).tolist()

    # Derive weights
    print("Deriving weights...")
    lang_weights = {}
    for lang in languages:
        weights = derive_weights(lang_vectors[lang], concepts, {})
        lang_weights[lang] = weights

    # Assemble output
    print("\nAssembling output...")
    concept_data = {}
    for i, concept in enumerate(concepts):
        positions = {}
        weights = {}
        for lang in languages:
            pos = lang_positions[lang][i]
            positions[lang] = [round(float(pos[0]), 2), round(float(pos[1]), 2)]
            weights[lang] = round(float(lang_weights[lang][i]), 3)

        concept_data[concept["id"]] = {
            "positions": positions,
            "weights": weights,
            "cosineToEN": cosine_to_en[concept["id"]],
        }

    output = {
        "modelId": raw["modelId"],
        "modelName": raw["modelName"],
        "dimension": raw["dimension"],
        "status": "live",
        "concepts": concept_data,
        "pairwise": pairwise,
        "conceptOrder": concept_ids,
    }

    with open(args.output, "w") as f:
        json.dump(output, f, indent=2)

    print(f"\n✓ Saved {args.output}")
    print(f"  {n_concepts} concepts × {len(languages)} languages")
    print(f"  Status: live")


if __name__ == "__main__":
    main()
