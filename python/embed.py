#!/usr/bin/env python3
"""
LACUNA Embedding Pipeline

Takes concept definitions from concepts.json, embeds them with a selected model,
computes distance matrices, projects to 2D, and outputs JSON matching
the frontend Concept[] shape.

Usage:
    python embed.py                    # Full pipeline with default model (bge-m3)
    python embed.py --model e5-large   # Use different embedding model
    python embed.py --validate-only    # Just show distance matrices, no output
    python embed.py --output out.json  # Custom output path
    python embed.py --input data/versailles.json  # Custom input
    python embed.py --list-models      # Show available models

Available models:
    bge-m3        - BGE-M3 (default, BAAI multilingual)
    e5-large      - Multilingual E5 Large (Microsoft)
    mistral-embed - Mistral Embed (API, requires MISTRAL_API_KEY)
    cohere-embed  - Cohere Embed v3 (API, requires COHERE_API_KEY)
    sonar         - SONAR (Meta, 200+ languages)
    nv-embed      - NV-Embed-v2 (NVIDIA, decoder architecture)

Prerequisites:
    pip install -r requirements.txt
    # Pre-download model (2GB+, do this at home, not on hackathon WiFi):
    python -c "from FlagEmbedding import BGEM3FlagModel; BGEM3FlagModel('BAAI/bge-m3')"
"""

import argparse
import json
import sys
from pathlib import Path
from typing import List, Dict, Tuple, Optional

import numpy as np

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

# Add lib to path
sys.path.insert(0, str(Path(__file__).parent))

from lib.embeddings import (
    embed_texts as embed_texts_default,
    cosine_similarity_matrix,
    find_duplicates,
    compute_embedding_weight,
)
from lib.models import (
    list_models,
    get_provider,
    get_model_config,
    get_available_providers,
)


def load_concepts(path: Path) -> List[Dict]:
    """Load concepts from JSON file."""
    with open(path) as f:
        return json.load(f)


def extract_definitions_by_language(
    concepts: List[Dict],
    languages: List[str] = ["en", "de"]
) -> Dict[str, Tuple[List[str], List[str]]]:
    """
    Extract definitions grouped by language.

    Returns:
        {lang: (ids, definitions)} for each language
    """
    result = {}
    for lang in languages:
        ids = []
        definitions = []
        for c in concepts:
            if "definitions" in c and lang in c["definitions"]:
                ids.append(c["id"])
                definitions.append(c["definitions"][lang])
        result[lang] = (ids, definitions)
    return result


def fit_umap(embeddings: np.ndarray, random_state: int = 42) -> np.ndarray:
    """
    Fit UMAP and transform embeddings to 2D.

    Args:
        embeddings: (N, 1024) array

    Returns:
        (N, 2) array of [x, z] positions
    """
    import umap

    reducer = umap.UMAP(
        n_components=2,
        n_neighbors=min(15, len(embeddings) - 1),
        min_dist=0.1,
        metric="cosine",
        random_state=random_state,
    )
    return reducer.fit_transform(embeddings)


def print_distance_matrix(
    ids: List[str],
    sim_matrix: np.ndarray,
    top_n: int = 5
):
    """Print top-N neighbors for each concept."""
    print("\n" + "=" * 60)
    print("DISTANCE MATRIX (Top neighbors by cosine similarity)")
    print("=" * 60)

    for i, id_ in enumerate(ids):
        # Get similarities, exclude self
        sims = [(j, sim_matrix[i, j]) for j in range(len(ids)) if j != i]
        sims.sort(key=lambda x: x[1], reverse=True)

        print(f"\n{id_}:")
        for j, sim in sims[:top_n]:
            print(f"  {ids[j]:25s} {sim:.3f}")


def detect_issues(
    ids: List[str],
    sim_matrix: np.ndarray,
    duplicate_threshold: float = 0.85,
    uniform_threshold: float = 0.7,
):
    """Detect and report potential issues."""
    print("\n" + "=" * 60)
    print("VALIDATION ISSUES")
    print("=" * 60)

    issues = []

    # Check for duplicates
    n = len(ids)
    for i in range(n):
        for j in range(i + 1, n):
            if sim_matrix[i, j] > duplicate_threshold:
                issues.append(f"DUPLICATE: {ids[i]} <-> {ids[j]} (cos={sim_matrix[i, j]:.3f})")

    # Check for too-uniform concepts (all neighbors have similar similarity)
    for i, id_ in enumerate(ids):
        sims = [sim_matrix[i, j] for j in range(n) if j != i]
        if sims:
            std = np.std(sims)
            mean = np.mean(sims)
            if std < 0.05 and mean > uniform_threshold:
                issues.append(f"UNIFORM: {id_} (mean={mean:.3f}, std={std:.3f}) - definition may be too generic")

    # Check for outliers (no neighbors above 0.4)
    for i, id_ in enumerate(ids):
        sims = [sim_matrix[i, j] for j in range(n) if j != i]
        if sims and max(sims) < 0.4:
            issues.append(f"OUTLIER: {id_} (max_sim={max(sims):.3f}) - may not belong in this concept space")

    if issues:
        for issue in issues:
            print(f"  - {issue}")
    else:
        print("  No issues detected.")

    return issues


def update_concepts_with_embeddings(
    concepts: List[Dict],
    embeddings_by_lang: Dict[str, Tuple[List[str], np.ndarray, np.ndarray]],
) -> List[Dict]:
    """
    Update concepts with computed positions and weights.

    Args:
        concepts: Original concepts
        embeddings_by_lang: {lang: (ids, embeddings, positions)}

    Returns:
        Updated concepts with new positions/weights
    """
    # Build lookup
    id_to_concept = {c["id"]: c.copy() for c in concepts}

    for lang, (ids, embeddings, positions) in embeddings_by_lang.items():
        for i, id_ in enumerate(ids):
            if id_ not in id_to_concept:
                continue

            c = id_to_concept[id_]

            # Update position
            if "position" not in c:
                c["position"] = {}
            c["position"][lang] = [float(positions[i, 0]), float(positions[i, 1])]

            # Update weight
            if "weight" not in c:
                c["weight"] = {}
            c["weight"][lang] = compute_embedding_weight(embeddings[i], embeddings)

            # Mark source as embedding
            c["source"] = "embedding"

    return list(id_to_concept.values())


def embed_with_model(
    texts: List[str],
    model_key: str = "bge-m3",
    batch_size: int = 8
) -> np.ndarray:
    """
    Embed texts using the specified model.

    Args:
        texts: List of strings to embed
        model_key: Model identifier (e.g., "bge-m3", "mistral-embed")
        batch_size: Batch size for embedding

    Returns:
        np.ndarray of shape (len(texts), dimensions)
    """
    if model_key == "bge-m3":
        # Use the existing optimized implementation
        return embed_texts_default(texts, batch_size)

    # Use the provider abstraction
    provider = get_provider(model_key)
    if provider is None:
        raise ValueError(
            f"Model '{model_key}' not available. "
            f"Available models: {list_models()}"
        )

    return provider.embed(texts, batch_size)


def main():
    parser = argparse.ArgumentParser(description="LACUNA Embedding Pipeline")
    parser.add_argument(
        "--input", "-i",
        type=Path,
        default=Path(__file__).parent / "data" / "versailles.json",
        help="Input concepts JSON file"
    )
    parser.add_argument(
        "--output", "-o",
        type=Path,
        default=None,
        help="Output JSON file (default: overwrite input)"
    )
    parser.add_argument(
        "--model", "-m",
        type=str,
        default="bge-m3",
        help="Embedding model to use (default: bge-m3)"
    )
    parser.add_argument(
        "--list-models",
        action="store_true",
        help="List available embedding models and exit"
    )
    parser.add_argument(
        "--validate-only", "-v",
        action="store_true",
        help="Only validate, don't write output"
    )
    parser.add_argument(
        "--languages", "-l",
        nargs="+",
        default=["en", "de"],
        help="Languages to process"
    )
    parser.add_argument(
        "--top-n",
        type=int,
        default=5,
        help="Number of neighbors to show in distance matrix"
    )

    args = parser.parse_args()

    # Handle --list-models
    if args.list_models:
        print("\nAvailable embedding models:")
        print("-" * 60)
        for key in list_models():
            config = get_model_config(key)
            provider = get_provider(key)
            status = "available" if provider else "unavailable"
            print(f"  {key:15s} - {config.name}")
            print(f"                   dims={config.dimensions}, type={config.provider_type.value}, [{status}]")
            if config.notes:
                print(f"                   {config.notes}")
        print()
        return

    # Validate model selection
    if args.model not in list_models():
        print(f"[embed] Error: Unknown model '{args.model}'")
        print(f"[embed] Available models: {', '.join(list_models())}")
        sys.exit(1)

    model_config = get_model_config(args.model)
    print(f"[embed] Using model: {model_config.name} ({args.model})")

    # Load concepts
    print(f"[embed] Loading concepts from {args.input}")
    concepts = load_concepts(args.input)
    print(f"[embed] Loaded {len(concepts)} concepts")

    # Extract definitions by language
    defs_by_lang = extract_definitions_by_language(concepts, args.languages)

    # Process each language
    embeddings_by_lang = {}

    for lang in args.languages:
        ids, definitions = defs_by_lang[lang]
        if not definitions:
            print(f"[embed] No definitions found for language: {lang}")
            continue

        print(f"\n[embed] Processing {lang}: {len(definitions)} definitions")

        # Embed with selected model
        print(f"[embed] Embedding with {model_config.name}...")
        embeddings = embed_with_model(definitions, args.model)
        print(f"[embed] Embeddings shape: {embeddings.shape}")

        # Compute similarity matrix
        sim_matrix = cosine_similarity_matrix(embeddings)

        # Print distance matrix
        print_distance_matrix(ids, sim_matrix, args.top_n)

        # Detect issues
        detect_issues(ids, sim_matrix)

        if not args.validate_only:
            # Fit UMAP
            print(f"[embed] Fitting UMAP...")
            positions = fit_umap(embeddings)
            print(f"[embed] Position range: x=[{positions[:, 0].min():.2f}, {positions[:, 0].max():.2f}], z=[{positions[:, 1].min():.2f}, {positions[:, 1].max():.2f}]")

            embeddings_by_lang[lang] = (ids, embeddings, positions)

    if args.validate_only:
        print("\n[embed] Validation complete. No output written.")
        return

    # Update concepts
    print("\n[embed] Updating concepts with embeddings...")
    updated_concepts = update_concepts_with_embeddings(concepts, embeddings_by_lang)

    # Write output
    output_path = args.output or args.input
    print(f"[embed] Writing to {output_path}")
    with open(output_path, "w") as f:
        json.dump(updated_concepts, f, indent=2, ensure_ascii=False)

    print("[embed] Done!")


if __name__ == "__main__":
    main()
