#!/usr/bin/env python3
"""
Test pipeline weight computation and ghost detection on example outputs.

Re-embeds definitions from the example JSONs, computes corrected weights
and ghosts, and reports results.

Usage:
    cd python && source .venv/bin/activate
    python tests/test_pipeline_outputs.py
"""

import json
import sys
from pathlib import Path
import numpy as np

sys.path.insert(0, str(Path(__file__).parent.parent))

from lib.embeddings import embed_texts, compute_embedding_weight, cosine_similarity_matrix
from pipeline import compute_weights, determine_ghost_status, compute_cross_language_divergence
from lib.schemas import ValidatedFrame


def load_and_embed(json_path: Path, languages=["en", "de"]) -> list[ValidatedFrame]:
    """Load example JSON, embed definitions, return ValidatedFrames."""
    with open(json_path) as f:
        concepts = json.load(f)

    print(f"\n{'='*60}")
    print(f"Processing: {json_path.name}")
    print(f"Concepts: {len(concepts)}")
    print(f"{'='*60}")

    # Collect definitions per language
    frames_data = []
    for c in concepts:
        defs = c.get("definitions", {})
        if not defs:
            # Use labels as fallback
            defs = c.get("labels", {})
        frames_data.append({
            "id": c["id"],
            "labels": c.get("labels", {}),
            "definitions": defs,
            "cluster": c.get("cluster", "unknown"),
        })

    # Embed per language
    embeddings_by_id = {}
    for lang in languages:
        texts = []
        ids = []
        for fd in frames_data:
            if lang in fd["definitions"]:
                texts.append(fd["definitions"][lang])
                ids.append(fd["id"])

        if not texts:
            continue

        print(f"\nEmbedding {len(texts)} definitions for {lang}...")
        embs = embed_texts(texts)

        for i, id_ in enumerate(ids):
            if id_ not in embeddings_by_id:
                embeddings_by_id[id_] = {}
            embeddings_by_id[id_][lang] = embs[i].tolist()

    # Build ValidatedFrames
    validated = []
    for fd in frames_data:
        if fd["id"] not in embeddings_by_id:
            continue
        vf = ValidatedFrame(
            id=fd["id"],
            labels=fd["labels"],
            definitions=fd["definitions"],
            cluster=fd["cluster"],
            embeddings=embeddings_by_id[fd["id"]],
        )
        validated.append(vf)

    return validated


def analyze(validated: list[ValidatedFrame], languages=["en", "de"]):
    """Run weight, ghost, and divergence analysis."""

    # Compute weights
    weights = compute_weights(validated, languages)

    # Compute cross-language divergence
    divergences = compute_cross_language_divergence(validated, languages)

    # Compute ghost status
    ghosts = determine_ghost_status(validated, languages)

    # Report
    print(f"\n{'─'*60}")
    print(f"{'ID':<45} {'W_EN':>5} {'W_DE':>5} {'DIV':>5} {'GHOST'}")
    print(f"{'─'*60}")

    ghost_count = 0
    for frame in validated:
        w_en = weights.get(frame.id, {}).get("en", 0)
        w_de = weights.get(frame.id, {}).get("de", 0)
        div = divergences.get(frame.id, 0)
        g_en = ghosts.get(frame.id, {}).get("en", False)
        g_de = ghosts.get(frame.id, {}).get("de", False)

        ghost_str = ""
        if g_en:
            ghost_str = "EN-GHOST"
            ghost_count += 1
        if g_de:
            ghost_str = "DE-GHOST"
            ghost_count += 1

        print(f"{frame.id:<45} {w_en:>5.2f} {w_de:>5.2f} {div:>5.3f} {ghost_str}")

    print(f"\n{'─'*60}")
    print(f"Total concepts: {len(validated)}")
    print(f"Ghosts detected: {ghost_count}")

    # Weight distribution
    all_w_en = [weights.get(f.id, {}).get("en", 0) for f in validated]
    all_w_de = [weights.get(f.id, {}).get("de", 0) for f in validated]
    print(f"\nEN weights: min={min(all_w_en):.3f} max={max(all_w_en):.3f} "
          f"mean={np.mean(all_w_en):.3f} std={np.std(all_w_en):.3f}")
    print(f"DE weights: min={min(all_w_de):.3f} max={max(all_w_de):.3f} "
          f"mean={np.mean(all_w_de):.3f} std={np.std(all_w_de):.3f}")

    # Divergence distribution
    all_div = list(divergences.values())
    print(f"\nDivergence: min={min(all_div):.3f} max={max(all_div):.3f} "
          f"mean={np.mean(all_div):.3f} std={np.std(all_div):.3f}")

    # Top 5 most divergent concepts
    sorted_div = sorted(divergences.items(), key=lambda x: x[1], reverse=True)
    print(f"\nTop 5 most divergent (biggest lacunae):")
    for id_, div in sorted_div[:5]:
        w_en = weights.get(id_, {}).get("en", 0)
        w_de = weights.get(id_, {}).get("de", 0)
        print(f"  {id_:<45} div={div:.3f} w_en={w_en:.2f} w_de={w_de:.2f}")

    return weights, divergences, ghosts


def main():
    examples_dir = Path(__file__).parent.parent / "examples"

    files = [
        examples_dir / "article_231_concepts.json",
        examples_dir / "german_response_concepts.json",
        examples_dir / "wilson_concepts.json",
    ]

    for f in files:
        if not f.exists():
            print(f"SKIP: {f} not found")
            continue

        validated = load_and_embed(f)
        if validated:
            analyze(validated)


if __name__ == "__main__":
    main()
