"""
compute_metrics.py

Computes benchmark metrics across all models, each with a control:
  - CLAS (Cross-Lingual Alignment Score); control: cross-concept cosine
  - Topology Preservation (Mantel test); control: concept-permutation null
  - Cluster Coherence (Silhouette score); control: shuffled-label null
  - Lacuna Detection Rate against the hand labels; controls: random labels,
    and the same concepts in the languages where they are marked present

Usage:
  python compute_metrics.py --models-dir ../../src/data/embeddings/ --output ../../src/data/embeddings/metrics.json

Reads {model}.json files with status "live" (written by project_umap.py).
Stub files from generate_stubs.ts and the hand-placed curated layout are
skipped: their positions are synthetic, so their scores describe no model.
"""

import json
import argparse
import random
from pathlib import Path

import numpy as np
from scipy.stats import pearsonr
from sklearn.metrics import silhouette_score

SCRIPT_DIR = Path(__file__).parent
CONCEPTS_PATH = SCRIPT_DIR / "concepts_input.json"

NULL_DRAWS = 200
NULL_SEED = 0
ORPHAN_DISTANCE = 15  # terrain units; positions span roughly [-30, 30]


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


def compute_clas_control(raw, languages, concepts):
    """CLAS control: mean cosine between EN concept i and concept j != i in
    the other language. CLAS only means alignment if it sits well above this."""
    n = len(concepts)

    def unit(lang):
        m = np.array([raw["embeddings"][f"{lang}:{c['id']}"] for c in concepts], dtype=np.float64)
        return m / np.linalg.norm(m, axis=1, keepdims=True)

    en = unit("en")
    off_diag = ~np.eye(n, dtype=bool)
    means = [(en @ unit(lang).T)[off_diag].mean() for lang in languages if lang != "en"]
    return round(float(np.mean(means)), 4)


def compute_mantel(model_data, languages, draws=NULL_DRAWS, seed=NULL_SEED):
    """Topology Preservation: Pearson r between the EN and X distance matrices.

    p is a Mantel permutation p-value (concept labels of X shuffled), since
    the 903 pairwise distances are not independent. nullP95 is the 95th
    percentile of the averaged r under that permutation.
    """
    pairwise = model_data.get("pairwise", {})
    en_matrix = pairwise.get("en")
    if not en_matrix:
        return {"pairs": {}, "averageR": 0}

    rng = np.random.default_rng(seed)
    en_matrix = np.array(en_matrix)
    n = len(en_matrix)
    iu = np.triu_indices(n, k=1)
    en_flat = en_matrix[iu]

    pairs = {}
    rs = []
    null_rs = []
    for lang in languages:
        if lang == "en" or lang not in pairwise:
            continue
        lang_matrix = np.array(pairwise[lang])
        r = pearsonr(en_flat, lang_matrix[iu])[0]
        null = np.array([
            pearsonr(en_flat, lang_matrix[np.ix_(perm, perm)][iu])[0]
            for perm in (rng.permutation(n) for _ in range(draws))
        ])
        p = (1 + int((null >= r).sum())) / (1 + draws)
        pairs[f"en-{lang}"] = {"r": round(float(r), 4), "p": round(p, 4)}
        rs.append(r)
        null_rs.append(null)

    return {
        "pairs": pairs,
        "averageR": round(float(np.mean(rs)), 4),
        "nullP95": round(float(np.percentile(np.mean(null_rs, axis=0), 95)), 4),
    }


def compute_silhouette(model_data, languages, concepts, shuffle_rng=None):
    """Cluster Coherence: silhouette score per language.

    Uses model-derived per-language cluster labels when available
    (concepts[cid].clusters[lang]), otherwise falls back to curated
    concept.cluster strings. With shuffle_rng, labels are permuted within
    each language first (the null for compute_silhouette_null).
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
        if shuffle_rng is not None:
            label_ints = list(shuffle_rng.permutation(label_ints))
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


def compute_silhouette_null(model_data, languages, concepts, draws=NULL_DRAWS, seed=NULL_SEED):
    """95th percentile of the average silhouette with cluster labels shuffled."""
    rng = np.random.default_rng(seed)
    null = [
        compute_silhouette(model_data, languages, concepts, shuffle_rng=rng)["average"]
        for _ in range(draws)
    ]
    return round(float(np.percentile(null, 95)), 4)


def hand_labels(concepts):
    """(concept_id, lang) cells marked as lacunae in concepts_input.json."""
    return {(c["id"], lang) for c in concepts for lang, v in c["lacuna"].items() if v}


def compute_lacuna_detection(model_data, languages, concepts, labels=None, exclude=None):
    """Lacuna Detection Rate: are labelled cells orphaned from their cluster?

    A labelled (concept, language) cell counts as detected when the concept's
    2D position in that language is more than ORPHAN_DISTANCE from the
    centroid of the other concepts in its HDBSCAN cluster, or when that
    cluster has no other members. Centroids leave out the cells in `exclude`
    (default: the labelled cells).

    `labels` defaults to the hand labels. The model's own k-NN flags
    (concepts[cid].lacuna) are never used as ground truth: scoring a model
    against its own flags is circular. averageRate is detected / expected
    over all labelled cells.
    """
    labels = hand_labels(concepts) if labels is None else labels
    exclude = labels if exclude is None else exclude
    concept_order = model_data.get("conceptOrder", [c["id"] for c in concepts])
    concept_map = {c["id"]: c for c in concepts}

    def cluster_of(cid, lang):
        cd = model_data["concepts"][cid]
        if "clusters" in cd and lang in cd["clusters"]:
            return str(cd["clusters"][lang])
        return concept_map[cid]["cluster"]

    per_language = {}
    total_expected = 0
    total_detected = 0

    for lang in languages:
        expected = [cid for cid in concept_order if (cid, lang) in labels]

        cluster_positions = {}
        for cid in concept_order:
            cd = model_data["concepts"].get(cid)
            if (cid, lang) in exclude or not cd or lang not in cd.get("positions", {}):
                continue
            cluster_positions.setdefault(cluster_of(cid, lang), []).append(cd["positions"][lang])
        centroids = {k: np.mean(v, axis=0) for k, v in cluster_positions.items()}

        detected = 0
        for cid in expected:
            cd = model_data["concepts"].get(cid)
            if not cd or lang not in cd.get("positions", {}):
                detected += 1  # No data = orphaned
                continue
            centroid = centroids.get(cluster_of(cid, lang))
            if centroid is None or np.linalg.norm(np.array(cd["positions"][lang]) - centroid) > ORPHAN_DISTANCE:
                detected += 1

        per_language[lang] = {
            "rate": round(detected / len(expected), 4) if expected else 1.0,
            "expected": len(expected),
            "detected": detected,
        }
        total_expected += len(expected)
        total_detected += detected

    return {
        "perLanguage": per_language,
        "averageRate": round(total_detected / max(total_expected, 1), 4),
        "detected": total_detected,
        "expected": total_expected,
    }


def lacuna_random_label_baseline(model_data, languages, concepts, observed,
                                 draws=NULL_DRAWS, seed=NULL_SEED):
    """Random-label control: in each language, label the same number of
    concepts as the hand labels, chosen uniformly at random, and rerun the
    test. pValue is the one-sided permutation p of the observed rate."""
    rng = random.Random(seed)
    ids = [c["id"] for c in concepts]
    counts = {lang: sum(1 for c in concepts if c["lacuna"].get(lang)) for lang in languages}
    rates = []
    for _ in range(draws):
        labels = {(cid, lang) for lang in languages for cid in rng.sample(ids, counts[lang])}
        rates.append(compute_lacuna_detection(model_data, languages, concepts, labels)["averageRate"])
    rates = np.array(rates)
    return {
        "draws": draws,
        "seed": seed,
        "median": round(float(np.median(rates)), 4),
        "p95": round(float(np.percentile(rates, 95)), 4),
        "pValue": round((1 + int((rates >= observed).sum())) / (1 + draws), 4),
    }


def lacuna_same_concept_control(model_data, languages, concepts):
    """Same test on the cells where the labelled concepts are marked present
    (e.g. Dolchstoss in German). If these are flagged as often as the labelled
    cells, the test is picking out the concepts, not their absence from
    particular languages. Centroids leave out every cell of those concepts."""
    labelled = {c["id"] for c in concepts if any(c["lacuna"].values())}
    present = {(cid, lang) for cid in labelled for lang in languages} - hand_labels(concepts)
    r = compute_lacuna_detection(
        model_data, languages, concepts, labels=present, exclude=present | hand_labels(concepts)
    )
    return {"rate": r["averageRate"], "detected": r["detected"], "expected": r["expected"]}


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
    parser.add_argument(
        "--raw-dir",
        default=str(SCRIPT_DIR),
        help="Directory containing {model}-raw.json (for the CLAS control)",
    )
    args = parser.parse_args()

    models_dir = Path(args.models_dir)
    raw_dir = Path(args.raw_dir)
    languages, concepts = load_concepts()
    labels = hand_labels(concepts)

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
    print(f"Hand labels: {len(labels)} cells across {len({cid for cid, _ in labels})} concepts")

    all_metrics = {
        "labels": {
            "source": "scripts/embeddings/concepts_input.json",
            "cells": len(labels),
            "concepts": len({cid for cid, _ in labels}),
            "languages": len(languages),
        },
        "models": [],
    }

    for model_file in model_files:
        print(f"\n{'=' * 50}")
        print(f"Processing: {model_file.name}")

        model_data = load_model(model_file)
        model_id = model_data.get("modelId", model_file.stem)
        status = model_data.get("status", "unknown")

        print(f"  Model: {model_data.get('modelName', model_id)}")
        print(f"  Status: {status}")
        if status != "live" or model_id == "curated":
            print("  Skipped: synthetic positions (stub or hand-placed), not a model run")
            continue

        clas = compute_clas(model_data, languages, concepts)
        raw_path = raw_dir / f"{model_id}-raw.json"
        if raw_path.exists():
            clas["crossConceptAverage"] = compute_clas_control(load_model(raw_path), languages, concepts)
        print(f"  CLAS: {clas['average']} (cross-concept control {clas.get('crossConceptAverage')})")

        mantel = compute_mantel(model_data, languages)
        print(f"  Topology (Mantel r): {mantel['averageR']} (null p95 {mantel['nullP95']})")

        silhouette = compute_silhouette(model_data, languages, concepts)
        silhouette_null = compute_silhouette_null(model_data, languages, concepts)
        print(f"  Silhouette: {silhouette['average']} (null p95 {silhouette_null})")

        lacuna = compute_lacuna_detection(model_data, languages, concepts)
        lacuna["randomLabelBaseline"] = lacuna_random_label_baseline(
            model_data, languages, concepts, lacuna["averageRate"]
        )
        lacuna["sameConceptsPresent"] = lacuna_same_concept_control(model_data, languages, concepts)
        # project_umap.py's k-NN density flags drive the app's lacuna overlay;
        # report how many land on hand-labelled cells instead of scoring them.
        flagged = {
            (cid, lang)
            for cid, cd in model_data["concepts"].items()
            for lang, v in cd.get("lacuna", {}).items()
            if v
        }
        lacuna["knnFlags"] = {"flagged": len(flagged), "handLabelled": len(flagged & labels)}
        print(
            f"  Lacuna Detection: {lacuna['averageRate']} ({lacuna['detected']}/{lacuna['expected']}); "
            f"random labels median {lacuna['randomLabelBaseline']['median']} "
            f"p95 {lacuna['randomLabelBaseline']['p95']} p={lacuna['randomLabelBaseline']['pValue']}; "
            f"same concepts where present {lacuna['sameConceptsPresent']['rate']}"
        )

        all_metrics["models"].append(
            {
                "modelId": model_id,
                "clas": clas,
                "topology": mantel,
                "silhouette": silhouette,
                "silhouetteNullP95": silhouette_null,
                "lacunaDetection": lacuna,
            }
        )

    with open(args.output, "w") as f:
        json.dump(all_metrics, f, indent=2)
        f.write("\n")

    print(f"\n{'=' * 50}")
    print(f"✓ Saved metrics for {len(all_metrics['models'])} models to {args.output}")


if __name__ == "__main__":
    main()
