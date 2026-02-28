#!/usr/bin/env python3
"""
LACUNA Full Pipeline

Wires the complete flow:
  Document → Extractor → Validator → embed.py → concepts.json

Usage:
    python pipeline.py document.txt --output concepts.json
    python pipeline.py document.txt --append-to existing.json
"""

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path
from typing import List, Dict, Optional
import numpy as np

# Load .env file
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / ".env")

sys.path.insert(0, str(Path(__file__).parent))

from lib.schemas import ExtractedFrame, ValidatedFrame, Concept, ExtractionResponse
from lib.embeddings import embed_texts, compute_embedding_weight
from agents.extractor import extract_frames
from agents.validator import validate_frames, validate_against_existing


def fit_umap_for_concepts(
    validated_frames: List[ValidatedFrame],
    languages: List[str] = ["en", "de"],
    existing_positions: Optional[Dict[str, Dict[str, List[float]]]] = None,
) -> Dict[str, Dict[str, List[float]]]:
    """
    Fit UMAP positions for validated frames.

    If existing_positions provided, fits UMAP on combined set
    to maintain relative positioning.

    Returns:
        {concept_id: {lang: [x, z]}}
    """
    import umap

    positions = {}

    for lang in languages:
        # Gather embeddings
        ids = []
        embeddings = []

        for frame in validated_frames:
            if lang in frame.embeddings:
                ids.append(frame.id)
                embeddings.append(frame.embeddings[lang])

        if not embeddings:
            continue

        embeddings = np.array(embeddings)

        # Fit UMAP
        n_neighbors = min(15, len(embeddings) - 1)
        if n_neighbors < 2:
            # Not enough points for UMAP, use simple projection
            for i, id_ in enumerate(ids):
                if id_ not in positions:
                    positions[id_] = {}
                positions[id_][lang] = [float(embeddings[i, 0]), float(embeddings[i, 1])]
            continue

        reducer = umap.UMAP(
            n_components=2,
            n_neighbors=n_neighbors,
            min_dist=0.1,
            metric="cosine",
            random_state=42,
        )

        projected = reducer.fit_transform(embeddings)

        for i, id_ in enumerate(ids):
            if id_ not in positions:
                positions[id_] = {}
            positions[id_][lang] = [float(projected[i, 0]), float(projected[i, 1])]

    return positions


def compute_weights(
    validated_frames: List[ValidatedFrame],
    languages: List[str] = ["en", "de"],
) -> Dict[str, Dict[str, float]]:
    """
    Compute semantic weights for each concept.

    Returns:
        {concept_id: {lang: weight}}
    """
    weights = {}

    for lang in languages:
        # Gather all embeddings for this language
        all_embeddings = []
        ids = []

        for frame in validated_frames:
            if lang in frame.embeddings:
                all_embeddings.append(frame.embeddings[lang])
                ids.append(frame.id)

        if not all_embeddings:
            continue

        all_embeddings = np.array(all_embeddings)

        for i, id_ in enumerate(ids):
            weight = compute_embedding_weight(all_embeddings[i], all_embeddings)
            if id_ not in weights:
                weights[id_] = {}
            weights[id_][lang] = weight

    return weights


def determine_ghost_status(
    validated_frames: List[ValidatedFrame],
    languages: List[str] = ["en", "de"],
    weight_threshold: float = 0.15,
) -> Dict[str, Dict[str, bool]]:
    """
    Determine ghost status based on semantic weight.

    A concept is a "ghost" in a language if its weight is below threshold,
    meaning it's semantically marginal in that language's discourse.

    Returns:
        {concept_id: {lang: is_ghost}}
    """
    weights = compute_weights(validated_frames, languages)
    ghost_status = {}

    for frame in validated_frames:
        ghost_status[frame.id] = {}
        for lang in languages:
            weight = weights.get(frame.id, {}).get(lang, 0.5)
            ghost_status[frame.id][lang] = weight < weight_threshold

    return ghost_status


def validated_to_concepts(
    validated_frames: List[ValidatedFrame],
    languages: List[str] = ["en", "de"],
) -> List[Concept]:
    """
    Convert validated frames to full Concept objects.

    Computes positions, weights, and ghost status.
    """
    # Compute all derived fields
    positions = fit_umap_for_concepts(validated_frames, languages)
    weights = compute_weights(validated_frames, languages)
    ghost_status = determine_ghost_status(validated_frames, languages)

    concepts = []
    for frame in validated_frames:
        # Build position dict with tuples
        pos_dict = {}
        for lang in languages:
            if frame.id in positions and lang in positions[frame.id]:
                pos_dict[lang] = tuple(positions[frame.id][lang])
            else:
                pos_dict[lang] = (0.0, 0.0)

        # Build weight dict
        weight_dict = {}
        for lang in languages:
            weight_dict[lang] = weights.get(frame.id, {}).get(lang, 0.5)

        # Build ghost dict
        ghost_dict = {}
        for lang in languages:
            ghost_dict[lang] = ghost_status.get(frame.id, {}).get(lang, False)

        concept = Concept(
            id=frame.id,
            labels=frame.labels,
            definitions=frame.definitions,
            cluster=frame.cluster,
            position=pos_dict,
            weight=weight_dict,
            ghost=ghost_dict,
            source="embedding",
        )
        concepts.append(concept)

    return concepts


async def run_pipeline(
    document: str,
    languages: List[str] = ["en", "de"],
    max_concepts: int = 20,
    reference_path: Optional[Path] = None,
) -> ExtractionResponse:
    """
    Run the full extraction pipeline.

    Args:
        document: Raw document text
        languages: Target languages
        max_concepts: Maximum concepts to extract
        reference_path: Path to existing concepts for validation

    Returns:
        ExtractionResponse with concepts and stats
    """
    stats = {"document_length": len(document)}

    # Step 1: Extract frames with Mistral
    print("[pipeline] Step 1: Extracting frames with Mistral...")
    frames = await extract_frames(document, languages, max_concepts)
    stats["extracted"] = len(frames)
    print(f"[pipeline] Extracted {len(frames)} frames")

    if not frames:
        return ExtractionResponse(
            concepts=[],
            rejected=[],
            stats=stats
        )

    # Step 2: Validate frames
    print("[pipeline] Step 2: Validating frames...")
    if reference_path:
        result = validate_against_existing(frames, reference_path, languages)
    else:
        result = validate_frames(frames, languages=languages)

    stats["validated"] = len(result.valid)
    stats["rejected"] = len(result.rejected)
    stats["rejection_reasons"] = result.rejection_reasons
    print(f"[pipeline] Validated: {len(result.valid)}, Rejected: {len(result.rejected)}")

    if not result.valid:
        return ExtractionResponse(
            concepts=[],
            rejected=result.rejected,
            stats=stats
        )

    # Step 3: Convert to full concepts with positions
    print("[pipeline] Step 3: Computing positions and weights...")
    concepts = validated_to_concepts(result.valid, languages)
    print(f"[pipeline] Generated {len(concepts)} concepts")

    return ExtractionResponse(
        concepts=concepts,
        rejected=result.rejected,
        stats=stats
    )


def run_pipeline_sync(
    document: str,
    languages: List[str] = ["en", "de"],
    max_concepts: int = 20,
    reference_path: Optional[Path] = None,
) -> ExtractionResponse:
    """Synchronous wrapper for run_pipeline."""
    return asyncio.run(run_pipeline(document, languages, max_concepts, reference_path))


def main():
    parser = argparse.ArgumentParser(description="LACUNA Full Pipeline")
    parser.add_argument("input", type=Path, help="Input document file")
    parser.add_argument("--output", "-o", type=Path, help="Output concepts JSON")
    parser.add_argument("--append-to", "-a", type=Path, help="Append to existing concepts JSON")
    parser.add_argument("--languages", "-l", nargs="+", default=["en", "de"])
    parser.add_argument("--max", "-m", type=int, default=20)
    parser.add_argument("--reference", "-r", type=Path, help="Reference concepts for validation")

    args = parser.parse_args()

    # Read document
    with open(args.input) as f:
        document = f.read()

    print(f"[pipeline] Processing {args.input} ({len(document)} chars)")

    # Run pipeline
    result = run_pipeline_sync(
        document,
        args.languages,
        args.max,
        args.reference or args.append_to
    )

    # Prepare output
    concepts_data = [c.model_dump() for c in result.concepts]

    # Convert tuples to lists for JSON
    for c in concepts_data:
        c["position"] = {k: list(v) for k, v in c["position"].items()}

    # Append to existing if requested
    if args.append_to and args.append_to.exists():
        with open(args.append_to) as f:
            existing = json.load(f)
        existing_ids = {c["id"] for c in existing}
        new_concepts = [c for c in concepts_data if c["id"] not in existing_ids]
        concepts_data = existing + new_concepts
        print(f"[pipeline] Appended {len(new_concepts)} new concepts to {len(existing)} existing")

    # Write output
    output_path = args.output or args.append_to
    if output_path:
        with open(output_path, "w") as f:
            json.dump(concepts_data, f, indent=2, ensure_ascii=False)
        print(f"[pipeline] Written {len(concepts_data)} concepts to {output_path}")
    else:
        print(json.dumps(concepts_data, indent=2, ensure_ascii=False))

    # Print stats
    print(f"\n[pipeline] Stats: {result.stats}")

    if result.rejected:
        print(f"\n[pipeline] Rejected frames:")
        for frame in result.rejected:
            reason = result.stats.get("rejection_reasons", {}).get(frame.id, "Unknown")
            print(f"  - {frame.id}: {reason}")


if __name__ == "__main__":
    main()
