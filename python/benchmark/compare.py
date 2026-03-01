#!/usr/bin/env python3
"""
LACUNA Multi-Model Embedding Benchmark

Compares how different embedding models structure the same concepts
across languages. Outputs metrics and embeddings for visualization.

Usage:
    python benchmark/compare.py --input data/versailles.json --models all
    python benchmark/compare.py --models bge-m3,mistral-embed
    python benchmark/compare.py --models bge-m3 --skip-existing

Output:
    python/benchmark_output/
    ├── bge-m3/
    │   ├── concepts.json    # Concept[] with positions/weights
    │   ├── embeddings_en.npy
    │   ├── embeddings_de.npy
    │   └── metrics.json     # Computed metrics
    ├── mistral-embed/
    │   └── ...
    ├── comparison.json      # Cross-model rankings
    └── manifest.json        # Available models list
"""

import argparse
import json
import sys
from pathlib import Path
from typing import List, Dict, Optional

import numpy as np

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from lib.embeddings import cosine_similarity_matrix, compute_embedding_weight
from lib.models import (
    list_models,
    get_provider,
    get_model_config,
    get_available_providers,
    get_manifest,
)
from benchmark.metrics import run_all_metrics, MetricResults


# Output directory
OUTPUT_DIR = Path(__file__).parent.parent / "benchmark_output"


def load_concepts(path: Path) -> List[Dict]:
    """Load concepts from JSON file."""
    with open(path) as f:
        return json.load(f)


def extract_data_for_benchmark(
    concepts: List[Dict],
    languages: List[str] = ["en", "de"]
) -> Dict:
    """
    Extract data needed for benchmark.

    Returns:
        Dict with concept_ids, definitions, clusters, ghost_flags
    """
    # Find concepts that have definitions in both languages
    concept_ids = []
    definitions = {lang: [] for lang in languages}
    clusters = []
    ghost_flags = {lang: {} for lang in languages}

    for c in concepts:
        # Check if concept has definitions in all required languages
        has_all = all(
            "definitions" in c and lang in c["definitions"]
            for lang in languages
        )
        if not has_all:
            continue

        cid = c["id"]
        concept_ids.append(cid)
        clusters.append(c.get("cluster", "unknown"))

        for lang in languages:
            definitions[lang].append(c["definitions"][lang])
            # Ghost flag for this language
            is_ghost = c.get("ghost", {}).get(lang, False)
            ghost_flags[lang][cid] = is_ghost

    return {
        "concept_ids": concept_ids,
        "definitions": definitions,
        "clusters": clusters,
        "ghost_flags": ghost_flags,
    }


def fit_umap(embeddings: np.ndarray, random_state: int = 42) -> np.ndarray:
    """Fit UMAP and transform embeddings to 2D."""
    import umap

    reducer = umap.UMAP(
        n_components=2,
        n_neighbors=min(15, len(embeddings) - 1),
        min_dist=0.1,
        metric="cosine",
        random_state=random_state,
    )
    return reducer.fit_transform(embeddings)


def build_concepts_json(
    original_concepts: List[Dict],
    embeddings_by_lang: Dict[str, np.ndarray],
    concept_ids: List[str],
    model_key: str
) -> List[Dict]:
    """
    Build concepts JSON with positions from embeddings.

    Args:
        original_concepts: Original concept data
        embeddings_by_lang: {lang: embeddings} for processed concepts
        concept_ids: IDs of processed concepts (same order as embeddings)
        model_key: Model identifier

    Returns:
        List of concept dicts with positions
    """
    # Build lookup from original
    original_lookup = {c["id"]: c.copy() for c in original_concepts}

    # Fit UMAP for each language
    positions_by_lang = {}
    for lang, embeddings in embeddings_by_lang.items():
        print(f"[compare] Fitting UMAP for {lang}...")
        positions_by_lang[lang] = fit_umap(embeddings)

    # Build output concepts
    output_concepts = []
    id_to_idx = {cid: i for i, cid in enumerate(concept_ids)}

    for cid in concept_ids:
        if cid not in original_lookup:
            continue

        c = original_lookup[cid].copy()
        idx = id_to_idx[cid]

        # Update positions
        c["position"] = {}
        for lang, positions in positions_by_lang.items():
            c["position"][lang] = [
                float(positions[idx, 0]),
                float(positions[idx, 1])
            ]

        # Update weights
        c["weight"] = {}
        for lang, embeddings in embeddings_by_lang.items():
            c["weight"][lang] = compute_embedding_weight(
                embeddings[idx], embeddings
            )

        # Mark source
        c["source"] = "embedding"
        c["model"] = model_key

        output_concepts.append(c)

    return output_concepts


def run_benchmark_for_model(
    model_key: str,
    data: Dict,
    original_concepts: List[Dict],
    output_dir: Path
) -> Optional[MetricResults]:
    """
    Run benchmark for a single model.

    Args:
        model_key: Model identifier
        data: Extracted benchmark data
        original_concepts: Original concepts for metadata
        output_dir: Directory to save outputs

    Returns:
        MetricResults or None if model unavailable
    """
    print(f"\n{'='*60}")
    print(f"Benchmarking: {model_key}")
    print(f"{'='*60}")

    # Get provider
    try:
        provider = get_provider(model_key)
        if provider is None:
            print(f"[compare] Model {model_key} not available (missing API key?)")
            return None
    except ImportError as e:
        print(f"[compare] Model {model_key} not available: {e}")
        return None

    # Create output directory
    model_dir = output_dir / model_key
    model_dir.mkdir(parents=True, exist_ok=True)

    # Embed each language
    embeddings_by_lang = {}
    for lang in ["en", "de"]:
        definitions = data["definitions"][lang]
        print(f"[compare] Embedding {len(definitions)} {lang} definitions...")

        embeddings = provider.embed(definitions)
        embeddings_by_lang[lang] = embeddings

        # Save embeddings
        np.save(model_dir / f"embeddings_{lang}.npy", embeddings)

    # Build concepts JSON
    concepts = build_concepts_json(
        original_concepts,
        embeddings_by_lang,
        data["concept_ids"],
        model_key
    )

    # Save concepts
    with open(model_dir / "concepts.json", "w") as f:
        json.dump(concepts, f, indent=2, ensure_ascii=False)

    # Run metrics
    results = run_all_metrics(
        embeddings_en=embeddings_by_lang["en"],
        embeddings_de=embeddings_by_lang["de"],
        concept_ids=data["concept_ids"],
        cluster_labels=data["clusters"],
        ghost_flags_en=data["ghost_flags"]["en"],
        ghost_flags_de=data["ghost_flags"]["de"],
        model_key=model_key
    )

    # Save metrics
    with open(model_dir / "metrics.json", "w") as f:
        json.dump(results.to_dict(), f, indent=2)

    return results


def build_comparison(results: Dict[str, MetricResults]) -> dict:
    """
    Build cross-model comparison rankings.

    Args:
        results: Dict of model_key -> MetricResults

    Returns:
        Comparison dict with rankings
    """
    comparison = {
        "models": list(results.keys()),
        "rankings": {},
        "scores": {},
    }

    # CLAS ranking (lower is better for LACUNA - preserves differences)
    clas_scores = [(k, r.clas_score) for k, r in results.items()]
    clas_scores.sort(key=lambda x: x[1])
    comparison["rankings"]["clas"] = [k for k, _ in clas_scores]
    comparison["scores"]["clas"] = {k: r.clas_score for k, r in results.items()}

    # Topology ranking (higher is better)
    topo_scores = [(k, r.topology_preservation) for k, r in results.items()]
    topo_scores.sort(key=lambda x: x[1], reverse=True)
    comparison["rankings"]["topology"] = [k for k, _ in topo_scores]
    comparison["scores"]["topology"] = {k: r.topology_preservation for k, r in results.items()}

    # Coherence ranking (higher is better)
    coh_scores = [(k, r.cluster_coherence_avg) for k, r in results.items()]
    coh_scores.sort(key=lambda x: x[1], reverse=True)
    comparison["rankings"]["coherence"] = [k for k, _ in coh_scores]
    comparison["scores"]["coherence"] = {k: r.cluster_coherence_avg for k, r in results.items()}

    # Ghost detection ranking (higher is better)
    ghost_scores = [(k, r.ghost_detection_rate) for k, r in results.items()]
    ghost_scores.sort(key=lambda x: x[1], reverse=True)
    comparison["rankings"]["ghost_detection"] = [k for k, _ in ghost_scores]
    comparison["scores"]["ghost_detection"] = {k: r.ghost_detection_rate for k, r in results.items()}

    # Overall ranking (composite score)
    # Lower CLAS = better, higher everything else = better
    composite = {}
    for model_key in results.keys():
        r = results[model_key]
        # Invert CLAS (1 - clas) so higher is better
        score = (1 - r.clas_score) + r.topology_preservation + r.cluster_coherence_avg + r.ghost_detection_rate
        composite[model_key] = score / 4  # Normalize to 0-1

    composite_sorted = sorted(composite.items(), key=lambda x: x[1], reverse=True)
    comparison["rankings"]["overall"] = [k for k, _ in composite_sorted]
    comparison["scores"]["overall"] = composite

    return comparison


def main():
    parser = argparse.ArgumentParser(description="LACUNA Multi-Model Embedding Benchmark")
    parser.add_argument(
        "--input", "-i",
        type=Path,
        default=Path(__file__).parent.parent / "data" / "versailles.json",
        help="Input concepts JSON file"
    )
    parser.add_argument(
        "--models", "-m",
        type=str,
        default="bge-m3",
        help="Models to benchmark (comma-separated, or 'all', or 'available')"
    )
    parser.add_argument(
        "--output-dir", "-o",
        type=Path,
        default=OUTPUT_DIR,
        help="Output directory for benchmark results"
    )
    parser.add_argument(
        "--skip-existing",
        action="store_true",
        help="Skip models that already have results"
    )
    parser.add_argument(
        "--list-models",
        action="store_true",
        help="List available models and exit"
    )

    args = parser.parse_args()

    # Handle --list-models
    if args.list_models:
        print("\nAvailable embedding models:")
        print("-" * 60)
        for key in list_models():
            config = get_model_config(key)
            try:
                provider = get_provider(key)
                status = "ready" if provider else "unavailable"
            except:
                status = "error"
            print(f"  {key:15s} [{status:11s}] - {config.name}")
        print()
        return

    # Parse models list
    if args.models == "all":
        model_keys = list_models()
    elif args.models == "available":
        model_keys = list(get_available_providers().keys())
    else:
        model_keys = [m.strip() for m in args.models.split(",")]

    print(f"[compare] Models to benchmark: {model_keys}")

    # Load concepts
    print(f"[compare] Loading concepts from {args.input}")
    concepts = load_concepts(args.input)
    print(f"[compare] Loaded {len(concepts)} concepts")

    # Extract benchmark data
    data = extract_data_for_benchmark(concepts)
    print(f"[compare] {len(data['concept_ids'])} concepts with both EN and DE definitions")

    # Create output directory
    args.output_dir.mkdir(parents=True, exist_ok=True)

    # Run benchmark for each model
    all_results = {}

    for model_key in model_keys:
        # Check if we should skip
        if args.skip_existing:
            metrics_file = args.output_dir / model_key / "metrics.json"
            if metrics_file.exists():
                print(f"\n[compare] Skipping {model_key} (results exist)")
                # Load existing results
                with open(metrics_file) as f:
                    metrics_data = json.load(f)
                    results = MetricResults(
                        model_key=model_key,
                        clas_score=metrics_data["clas"]["score"],
                        topology_preservation=metrics_data["topology"]["preservation"],
                        cluster_coherence_avg=metrics_data["cluster_coherence"]["average"],
                        ghost_detection_rate=metrics_data["ghost_detection"]["rate"],
                    )
                    all_results[model_key] = results
                continue

        results = run_benchmark_for_model(
            model_key, data, concepts, args.output_dir
        )
        if results is not None:
            all_results[model_key] = results

    # Build comparison
    if len(all_results) > 0:
        print(f"\n{'='*60}")
        print("Building cross-model comparison...")
        print(f"{'='*60}")

        comparison = build_comparison(all_results)

        with open(args.output_dir / "comparison.json", "w") as f:
            json.dump(comparison, f, indent=2)

        # Print summary
        print("\n" + "="*60)
        print("BENCHMARK SUMMARY")
        print("="*60)

        print(f"\nModels benchmarked: {len(all_results)}")

        print(f"\nOverall ranking (composite score):")
        for i, model in enumerate(comparison["rankings"]["overall"], 1):
            score = comparison["scores"]["overall"][model]
            print(f"  {i}. {model:15s} - {score:.4f}")

        print(f"\nCLAS (lower = preserves language differences):")
        for model in comparison["rankings"]["clas"]:
            score = comparison["scores"]["clas"][model]
            print(f"  {model:15s} - {score:.4f}")

        print(f"\nTopology Preservation:")
        for model in comparison["rankings"]["topology"]:
            score = comparison["scores"]["topology"][model]
            print(f"  {model:15s} - {score:.4f}")

    # Save manifest
    manifest = get_manifest()
    manifest["benchmark_models"] = list(all_results.keys())
    with open(args.output_dir / "manifest.json", "w") as f:
        json.dump(manifest, f, indent=2)

    print(f"\n[compare] Results saved to {args.output_dir}")
    print("[compare] Done!")


if __name__ == "__main__":
    main()
