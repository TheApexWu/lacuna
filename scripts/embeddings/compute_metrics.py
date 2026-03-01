"""
compute_metrics.py

Computes benchmark metrics across all models:
  - CLAS (Cross-Lingual Alignment Score)
  - Topology Preservation (Mantel test)
  - Cluster Coherence (Silhouette score)
  - Lacuna Detection Rate

Usage:
  python compute_metrics.py --models-dir ../../src/data/embeddings/ --output ../../src/data/embeddings/metrics.json

Reads all {model}.json files from the models directory.
"""

import json
import argparse
import glob
from pathlib import Path

import numpy as np
from scipy.stats import pearsonr
from scipy.spatial.distance import cosine as cosine_distance
from sklearn.metrics import silhouette_score

SCRIPT_DIR = Path(__file__).parent
CONCEPTS_PATH = SCRIPT_DIR / "concepts_input.json"


def load_concepts():
    """Load concept metadata for cluster and lacuna info."""
    with open(CONCEPTS_PATH) as f:
        data = json.load(f)
    return data["languages"], data["concepts"]


def load_model(path):
    """Load a model's embedding data."""
    with open(path) as f:
        return json.load(f)


def compute_clas(model_data, languages, concepts):
    """Cross-Lingual Alignment Score: avg cosine sim between EN and X for same concept."""
    pairs = {}
    total = 0
    count = 0

    for lang in languages:
        if lang == "en":
            continue

        lang_sum = 0
        lang_count = 0

        for concept in concepts:
            cid = concept["id"]
            cd = model_data["concepts"].get(cid)
            if not cd or "cosineToEN" not in cd:
                continue

            sim = cd["cosineToEN"].get(lang, 0)
            lang_sum += sim
            lang_count += 1

        avg = lang_sum / max(lang_count, 1)
        pairs[f"en-{lang}"] = round(avg, 4)
        total += avg
        count += 1

    return {
        "pairs": pairs,
        "average": round(total / max(count, 1), 4),
    }


def compute_mantel(model_data, languages):
    """Topology Preservation: Pearson correlation between distance matrices."""
    pairwise = model_data.get("pairwise", {})
    en_matrix = pairwise.get("en")
    if not en_matrix:
        return {"pairs": {}, "averageR": 0}

    pairs = {}
    total = 0
    count = 0

    en_flat = []
    n = len(en_matrix)
    for i in range(n):
        for j in range(i + 1, n):
            en_flat.append(en_matrix[i][j])
    en_flat = np.array(en_flat)

    for lang in languages:
        if lang == "en":
            continue

        lang_matrix = pairwise.get(lang)
        if not lang_matrix:
            continue

        lang_flat = []
        for i in range(n):
            for j in range(i + 1, n):
                lang_flat.append(lang_matrix[i][j])
        lang_flat = np.array(lang_flat)

        if len(en_flat) > 2 and np.std(en_flat) > 0 and np.std(lang_flat) > 0:
            r, p = pearsonr(en_flat, lang_flat)
        else:
            r, p = 0, 1

        pairs[f"en-{lang}"] = {"r": round(float(r), 4), "p": round(float(p), 6)}
        total += r
        count += 1

    return {
        "pairs": pairs,
        "averageR": round(total / max(count, 1), 4),
    }


def compute_silhouette(model_data, languages, concepts):
    """Cluster Coherence: silhouette score per language.

    Uses model-derived per-language cluster labels when available
    (concepts[cid].clusters[lang]), otherwise falls back to curated
    concept.cluster strings.
    """
    concept_order = model_data.get("conceptOrder", [cid["id"] for cid in concepts])

    result = {}
    total = 0
    count = 0

    for lang in languages:
        # Build cluster labels and positions for this language
        cluster_labels = []
        positions = []
        for cid in concept_order:
            cd = model_data["concepts"].get(cid)

            # Cluster label: prefer model-derived per-language label
            if cd and "clusters" in cd and lang in cd["clusters"]:
                cluster_labels.append(cd["clusters"][lang])
            else:
                concept = next((c for c in concepts if c["id"] == cid), None)
                cluster_labels.append(concept["cluster"] if concept else "unknown")

            # Position
            if cd and "positions" in cd and lang in cd["positions"]:
                positions.append(cd["positions"][lang])
            else:
                positions.append([0, 0])

        # Encode clusters as integers
        unique_clusters = list(set(cluster_labels))
        label_ints = [unique_clusters.index(c) for c in cluster_labels]
        positions = np.array(positions)

        if len(set(label_ints)) > 1 and len(positions) > len(set(label_ints)):
            try:
                score = silhouette_score(positions, label_ints, metric="euclidean")
            except Exception:
                score = 0
        else:
            score = 0

        result[lang] = round(float(score), 4)
        total += score
        count += 1

    result["average"] = round(total / max(count, 1), 4)
    return result


def compute_lacuna_detection(model_data, languages, concepts):
    """Lacuna Detection Rate: are lacuna concepts orphaned from their cluster?

    Uses model-derived lacuna flags (concepts[cid].lacuna[lang]) when
    available as the "expected" ground truth for that model, otherwise
    falls back to curated concept.lacuna[lang].
    """
    concept_order = model_data.get("conceptOrder", [c["id"] for c in concepts])
    concept_map = {c["id"]: c for c in concepts}

    per_language = {}
    total_rate = 0
    rate_count = 0

    for lang in languages:
        expected_lacunae = []
        detected_lacunae = []

        # Get cluster centroids (non-lacuna concepts only)
        cluster_positions = {}
        for cid in concept_order:
            c = concept_map.get(cid)
            if not c:
                continue

            cd = model_data["concepts"].get(cid)

            # Lacuna flag: prefer model-derived per-language flag
            if cd and "lacuna" in cd and lang in cd["lacuna"]:
                is_lacuna = cd["lacuna"][lang]
            else:
                is_lacuna = c["lacuna"].get(lang, False)

            if is_lacuna:
                expected_lacunae.append(cid)
                continue

            if not cd or "positions" not in cd or lang not in cd["positions"]:
                continue

            # Cluster label: prefer model-derived
            if cd and "clusters" in cd and lang in cd["clusters"]:
                cluster = cd["clusters"][lang]
            else:
                cluster = c["cluster"]

            cluster = str(cluster)
            if cluster not in cluster_positions:
                cluster_positions[cluster] = []
            cluster_positions[cluster].append(cd["positions"][lang])

        # Compute centroids
        centroids = {}
        for cluster, positions in cluster_positions.items():
            arr = np.array(positions)
            centroids[cluster] = arr.mean(axis=0)

        # Check if lacuna concepts are far from their cluster centroid
        for cid in expected_lacunae:
            c = concept_map.get(cid)
            cd = model_data["concepts"].get(cid)
            if not c or not cd or "positions" not in cd or lang not in cd["positions"]:
                detected_lacunae.append(cid)  # No data = definitely orphaned
                continue

            pos = np.array(cd["positions"][lang])

            # Get cluster label for this lacuna concept
            if cd and "clusters" in cd and lang in cd["clusters"]:
                lacuna_cluster = str(cd["clusters"][lang])
            else:
                lacuna_cluster = c["cluster"]

            centroid = centroids.get(lacuna_cluster)
            if centroid is None:
                detected_lacunae.append(cid)
                continue

            dist = np.linalg.norm(pos - centroid)
            # If lacuna is far from centroid (>15 units), it's detected as orphaned
            if dist > 15:
                detected_lacunae.append(cid)

        rate = len(detected_lacunae) / max(len(expected_lacunae), 1) if expected_lacunae else 1.0
        per_language[lang] = {
            "rate": round(rate, 4),
            "expected": len(expected_lacunae),
            "detected": len(detected_lacunae),
        }

        if expected_lacunae:
            total_rate += rate
            rate_count += 1

    return {
        "perLanguage": per_language,
        "averageRate": round(total_rate / max(rate_count, 1), 4),
    }


def main():
    parser = argparse.ArgumentParser(description="Compute benchmark metrics for all models")
    parser.add_argument(
        "--models-dir",
        required=True,
        help="Directory containing {model}.json files",
    )
    parser.add_argument(
        "--output",
        required=True,
        help="Output path for metrics.json",
    )
    args = parser.parse_args()

    models_dir = Path(args.models_dir)
    languages, concepts = load_concepts()

    # Find all model JSON files (exclude metrics.json and *-raw.json)
    model_files = sorted(models_dir.glob("*.json"))
    model_files = [
        f
        for f in model_files
        if f.name != "metrics.json"
        and not f.name.endswith("-raw.json")
        and not f.name.endswith("-layers.json")
    ]

    print(f"Found {len(model_files)} model files")
    print(f"Languages: {len(languages)}, Concepts: {len(concepts)}")

    all_metrics = {"models": []}

    for model_file in model_files:
        print(f"\n{'=' * 50}")
        print(f"Processing: {model_file.name}")

        model_data = load_model(model_file)
        model_id = model_data.get("modelId", model_file.stem)

        print(f"  Model: {model_data.get('modelName', model_id)}")
        print(f"  Status: {model_data.get('status', 'unknown')}")

        clas = compute_clas(model_data, languages, concepts)
        print(f"  CLAS: {clas['average']}")

        mantel = compute_mantel(model_data, languages)
        print(f"  Topology (Mantel r): {mantel['averageR']}")

        silhouette = compute_silhouette(model_data, languages, concepts)
        print(f"  Silhouette: {silhouette['average']}")

        lacuna = compute_lacuna_detection(model_data, languages, concepts)
        print(f"  Lacuna Detection: {lacuna['averageRate']}")

        all_metrics["models"].append(
            {
                "modelId": model_id,
                "clas": clas,
                "topology": mantel,
                "silhouette": silhouette,
                "lacunaDetection": lacuna,
            }
        )

    with open(args.output, "w") as f:
        json.dump(all_metrics, f, indent=2)

    print(f"\n{'=' * 50}")
    print(f"✓ Saved metrics for {len(all_metrics['models'])} models to {args.output}")


if __name__ == "__main__":
    main()
