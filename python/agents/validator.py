"""
LACUNA Validator Agent

Embeds extracted frames with BGE-M3, computes cosine distance matrix,
and kills false positives:
- Too uniform (boring/generic definitions)
- Too extreme (outliers that don't fit)
- Duplicates (cosine > 0.85)

Usage:
    from agents.validator import validate_frames
    result = validate_frames(frames, reference_embeddings)
"""

import sys
from pathlib import Path
from typing import List, Dict, Optional, Tuple
import numpy as np

sys.path.insert(0, str(Path(__file__).parent.parent))

from lib.schemas import ExtractedFrame, ValidatedFrame, ValidationResult
from lib.embeddings import (
    embed_texts,
    cosine_similarity_matrix,
    find_duplicates,
    compute_uniformity_score,
    compute_extremity_score,
)


# Validation thresholds
DUPLICATE_THRESHOLD = 0.85  # Cosine similarity above this = duplicate
CROSS_LANG_SIMILARITY_MAX = 0.92  # If EN/DE embeddings too similar = no structural difference (boring)
UNIFORMITY_MIN = 0.3  # Below this = too generic
EXTREMITY_MIN = 0.35  # Below this = outlier
CONFIDENCE_MIN = 0.5  # Extraction confidence minimum


def compute_cross_language_similarity(
    embeddings_by_lang: Dict[str, Tuple[List[str], np.ndarray]],
    languages: List[str],
) -> Dict[str, float]:
    """
    Compute cross-language similarity for each concept.

    If a concept's embeddings are too similar across languages,
    it means the concept doesn't show structural difference - boring!

    Returns:
        {concept_id: cross_lang_similarity} where higher = more similar = bad
    """
    if len(languages) < 2:
        return {}

    # Build lookup: concept_id -> {lang: embedding}
    concept_embeddings: Dict[str, Dict[str, np.ndarray]] = {}
    for lang, (ids, embeddings) in embeddings_by_lang.items():
        for i, id_ in enumerate(ids):
            if id_ not in concept_embeddings:
                concept_embeddings[id_] = {}
            concept_embeddings[id_][lang] = embeddings[i]

    # Compute cross-language similarity for each concept
    cross_lang_sims = {}
    for concept_id, lang_embs in concept_embeddings.items():
        if len(lang_embs) < 2:
            continue

        # Get all pairs of languages
        langs = list(lang_embs.keys())
        sims = []
        for i in range(len(langs)):
            for j in range(i + 1, len(langs)):
                emb1 = lang_embs[langs[i]]
                emb2 = lang_embs[langs[j]]
                # Cosine similarity
                sim = float(np.dot(emb1, emb2) / (np.linalg.norm(emb1) * np.linalg.norm(emb2) + 1e-10))
                sims.append(sim)

        cross_lang_sims[concept_id] = float(np.mean(sims)) if sims else 0.0

    return cross_lang_sims


def validate_frames(
    frames: List[ExtractedFrame],
    reference_embeddings: Optional[np.ndarray] = None,
    languages: List[str] = ["en", "de"],
    duplicate_threshold: float = DUPLICATE_THRESHOLD,
    cross_lang_max: float = CROSS_LANG_SIMILARITY_MAX,
    uniformity_min: float = UNIFORMITY_MIN,
    extremity_min: float = EXTREMITY_MIN,
    confidence_min: float = CONFIDENCE_MIN,
) -> ValidationResult:
    """
    Validate extracted frames by embedding and filtering.

    Args:
        frames: List of extracted frames to validate
        reference_embeddings: Optional existing embeddings to check against
        languages: Languages to process
        duplicate_threshold: Cosine threshold for duplicates
        uniformity_min: Minimum uniformity score
        extremity_min: Minimum extremity score
        confidence_min: Minimum extraction confidence

    Returns:
        ValidationResult with valid and rejected frames
    """
    if not frames:
        return ValidationResult(valid=[], rejected=[])

    valid = []
    rejected = []
    rejection_reasons = {}

    # First pass: filter by extraction confidence
    confident_frames = []
    for frame in frames:
        if frame.confidence < confidence_min:
            rejected.append(frame)
            rejection_reasons[frame.id] = f"Low confidence: {frame.confidence:.2f} < {confidence_min}"
        else:
            confident_frames.append(frame)

    if not confident_frames:
        return ValidationResult(
            valid=[],
            rejected=rejected,
            rejection_reasons=rejection_reasons
        )

    # Embed all frames per language
    embeddings_by_lang: Dict[str, Tuple[List[str], np.ndarray]] = {}

    for lang in languages:
        # Get definitions for this language
        ids = []
        definitions = []
        for frame in confident_frames:
            if lang in frame.definitions:
                ids.append(frame.id)
                definitions.append(frame.definitions[lang])

        if not definitions:
            continue

        print(f"[validator] Embedding {len(definitions)} frames for {lang}...")
        embeddings = embed_texts(definitions)
        embeddings_by_lang[lang] = (ids, embeddings)

    # Check for duplicates within extracted set
    duplicate_ids = set()
    for lang, (ids, embeddings) in embeddings_by_lang.items():
        duplicates = find_duplicates(embeddings, duplicate_threshold)
        for i, j, sim in duplicates:
            # Keep the first one, reject the second
            dup_id = ids[j]
            duplicate_ids.add(dup_id)
            if dup_id not in rejection_reasons:
                rejection_reasons[dup_id] = f"Duplicate of {ids[i]} ({lang}, cos={sim:.3f})"

    # Check uniformity (are embeddings too similar to each other?)
    uniformity_scores = {}
    for lang, (ids, embeddings) in embeddings_by_lang.items():
        uniformity = compute_uniformity_score(embeddings)
        uniformity_scores[lang] = uniformity
        print(f"[validator] {lang} uniformity score: {uniformity:.3f}")

        if uniformity < uniformity_min:
            print(f"[validator] WARNING: {lang} embeddings are too uniform - definitions may be too generic")

    # Check cross-language similarity - kill concepts that don't show structural difference
    cross_lang_sims = compute_cross_language_similarity(embeddings_by_lang, languages)
    boring_ids = set()
    for concept_id, sim in cross_lang_sims.items():
        if sim > cross_lang_max:
            boring_ids.add(concept_id)
            rejection_reasons[concept_id] = f"No structural difference across languages (cross-lang sim={sim:.3f} > {cross_lang_max})"
            print(f"[validator] REJECT {concept_id}: too similar across languages ({sim:.3f})")
        else:
            print(f"[validator] {concept_id}: cross-lang similarity {sim:.3f} (OK)")

    # Check extremity against reference (if provided)
    extremity_scores = {}
    if reference_embeddings is not None:
        for lang, (ids, embeddings) in embeddings_by_lang.items():
            for i, (id_, emb) in enumerate(zip(ids, embeddings)):
                score = compute_extremity_score(emb, reference_embeddings)
                extremity_scores[id_] = extremity_scores.get(id_, []) + [score]

    # Build validated frames
    frame_lookup = {f.id: f for f in confident_frames}
    frame_embeddings: Dict[str, Dict[str, List[float]]] = {}

    for lang, (ids, embeddings) in embeddings_by_lang.items():
        for id_, emb in zip(ids, embeddings):
            if id_ not in frame_embeddings:
                frame_embeddings[id_] = {}
            frame_embeddings[id_][lang] = emb.tolist()

    # Final validation pass
    for frame in confident_frames:
        # Check if duplicate
        if frame.id in duplicate_ids:
            rejected.append(frame)
            continue

        # Check if boring (no cross-language difference)
        if frame.id in boring_ids:
            rejected.append(frame)
            continue

        # Check extremity
        if frame.id in extremity_scores:
            avg_extremity = np.mean(extremity_scores[frame.id])
            if avg_extremity < extremity_min:
                rejected.append(frame)
                rejection_reasons[frame.id] = f"Outlier (extremity={avg_extremity:.3f})"
                continue

        # Frame is valid
        validated = ValidatedFrame(
            id=frame.id,
            labels=frame.labels,
            definitions=frame.definitions,
            cluster=frame.cluster,
            embeddings=frame_embeddings.get(frame.id, {}),
            validation_scores={
                "confidence": frame.confidence,
                "extremity": np.mean(extremity_scores.get(frame.id, [1.0])),
            }
        )
        valid.append(validated)

    print(f"[validator] Validation complete: {len(valid)} valid, {len(rejected)} rejected")

    return ValidationResult(
        valid=valid,
        rejected=rejected,
        rejection_reasons=rejection_reasons
    )


def validate_against_existing(
    frames: List[ExtractedFrame],
    existing_concepts_path: Path,
    languages: List[str] = ["en", "de"],
) -> ValidationResult:
    """
    Validate frames against existing concept embeddings.

    Args:
        frames: Frames to validate
        existing_concepts_path: Path to existing concepts JSON
        languages: Languages to process

    Returns:
        ValidationResult
    """
    import json

    # Load existing concepts
    with open(existing_concepts_path) as f:
        existing = json.load(f)

    # Embed existing definitions
    all_existing_embeddings = []
    for lang in languages:
        definitions = []
        for c in existing:
            if "definitions" in c and lang in c["definitions"]:
                definitions.append(c["definitions"][lang])
        if definitions:
            embeddings = embed_texts(definitions)
            all_existing_embeddings.append(embeddings)

    if all_existing_embeddings:
        reference_embeddings = np.vstack(all_existing_embeddings)
    else:
        reference_embeddings = None

    return validate_frames(frames, reference_embeddings, languages)


# CLI interface
if __name__ == "__main__":
    import argparse
    import json

    parser = argparse.ArgumentParser(description="Validate extracted frames")
    parser.add_argument("input", type=Path, help="Input frames JSON file")
    parser.add_argument("--output", "-o", type=Path, help="Output JSON file")
    parser.add_argument("--reference", "-r", type=Path, help="Reference concepts JSON")
    parser.add_argument("--languages", "-l", nargs="+", default=["en", "de"])

    args = parser.parse_args()

    # Load frames
    with open(args.input) as f:
        data = json.load(f)

    frames = [ExtractedFrame(**f) for f in data]
    print(f"[validator] Loaded {len(frames)} frames")

    # Validate
    if args.reference:
        result = validate_against_existing(frames, args.reference, args.languages)
    else:
        result = validate_frames(frames, languages=args.languages)

    # Output
    output = {
        "valid": [f.model_dump() for f in result.valid],
        "rejected": [f.model_dump() for f in result.rejected],
        "rejection_reasons": result.rejection_reasons,
    }

    if args.output:
        with open(args.output, "w") as f:
            json.dump(output, f, indent=2, ensure_ascii=False)
        print(f"[validator] Written to {args.output}")
    else:
        print(json.dumps(output, indent=2, ensure_ascii=False))
