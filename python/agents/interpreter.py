"""
LACUNA Interpreter Agent

Uses Mistral Large to explain WHY conceptual lacunae exist.
Powers the concept cards when you click a node.

For each detected lacuna: explains the cultural, historical,
and structural reasons for the gap with citations.

Usage:
    from agents.interpreter import interpret_lacuna
    explanation = interpret_lacuna(concept, neighbors, language)
"""

import json
import os
from typing import List, Dict, Optional

from mistralai import Mistral

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))


# Mistral client (lazy init)
_client = None


def get_client() -> Mistral:
    """Get or create Mistral client."""
    global _client
    if _client is None:
        api_key = os.environ.get("MISTRAL_API_KEY")
        if not api_key:
            raise ValueError("MISTRAL_API_KEY environment variable not set")
        _client = Mistral(api_key=api_key)
    return _client


INTERPRETER_SYSTEM_PROMPT = """You are a conceptual topology interpreter for the LACUNA project.

LACUNA maps how the same historical concepts occupy different semantic positions across languages.
A "lacuna" is a conceptual gap - where a concept exists in one language's topology but is absent or
structurally different in another.

Your task is to explain WHY a lacuna exists. For each concept:

1. CULTURAL EXPLANATION: How does cultural context shape this concept differently across languages?
   - What historical events, institutions, or traditions create different framings?
   - What collective memories or traumas influence how this concept is understood?

2. HISTORICAL EXPLANATION: What specific historical moments created this divergence?
   - When did the conceptual gap emerge?
   - What events solidified different understandings?

3. STRUCTURAL EXPLANATION: How does the language itself shape meaning?
   - Are there linguistic features (compounds, etymology, connotations) that create different semantic fields?
   - How do related terms in each language create different associative networks?

4. CITATIONS: Reference specific historical sources, treaties, speeches, or scholarly works that
   illuminate this conceptual divergence. Be specific with dates, authors, and document names.

Write in an academic but accessible style. Be specific and analytical, not generic.
Your explanation will appear in a concept card UI when users click on a node in the 3D topology.

Respond in JSON format:
{
  "cultural": "Cultural explanation paragraph...",
  "historical": "Historical explanation paragraph...",
  "structural": "Structural/linguistic explanation paragraph...",
  "citations": ["Citation 1", "Citation 2", ...],
  "summary": "One-sentence summary of why this lacuna matters"
}
"""


def interpret_lacuna(
    concept_id: str,
    concept_label: str,
    definitions: Dict[str, str],
    neighbors: Dict[str, List[Dict]],
    position: Dict[str, List[float]],
    is_ghost: Dict[str, bool],
    cluster: str,
    primary_language: str = "en",
    comparison_language: str = "de",
) -> Dict:
    """
    Generate interpretation for a concept's lacuna.

    Args:
        concept_id: The concept identifier
        concept_label: The display label
        definitions: {lang: definition} dictionary
        neighbors: {lang: [{"id": ..., "label": ..., "similarity": ...}]} nearest neighbors
        position: {lang: [x, z]} coordinates
        is_ghost: {lang: bool} whether concept is a ghost in each language
        cluster: The concept's cluster category
        primary_language: Language being viewed
        comparison_language: Language to compare against

    Returns:
        Dict with cultural, historical, structural explanations and citations
    """
    client = get_client()

    # Build context for interpretation
    primary_pos = position.get(primary_language, [0, 0])
    comparison_pos = position.get(comparison_language, [0, 0])

    # Calculate position delta
    delta_x = comparison_pos[0] - primary_pos[0] if comparison_pos and primary_pos else 0
    delta_z = comparison_pos[1] - primary_pos[1] if comparison_pos and primary_pos else 0
    distance = (delta_x**2 + delta_z**2)**0.5

    # Format neighbors
    primary_neighbors = neighbors.get(primary_language, [])
    comparison_neighbors = neighbors.get(comparison_language, [])

    primary_neighbor_str = ", ".join(
        f"{n['label']} ({n['similarity']:.2f})"
        for n in primary_neighbors[:5]
    ) if primary_neighbors else "none"

    comparison_neighbor_str = ", ".join(
        f"{n['label']} ({n['similarity']:.2f})"
        for n in comparison_neighbors[:5]
    ) if comparison_neighbors else "none"

    # Determine lacuna type
    is_primary_ghost = is_ghost.get(primary_language, False)
    is_comparison_ghost = is_ghost.get(comparison_language, False)

    if is_primary_ghost:
        lacuna_type = f"ABSENT in {primary_language.upper()} - exists only in {comparison_language.upper()} perspective"
    elif is_comparison_ghost:
        lacuna_type = f"ABSENT in {comparison_language.upper()} - exists only in {primary_language.upper()} perspective"
    elif distance > 15:
        lacuna_type = f"MAJOR SHIFT - dramatically different position across languages (distance: {distance:.1f})"
    elif distance > 8:
        lacuna_type = f"SIGNIFICANT SHIFT - different semantic neighborhood across languages (distance: {distance:.1f})"
    else:
        lacuna_type = f"SUBTLE SHIFT - similar position but different local context (distance: {distance:.1f})"

    user_prompt = f"""Explain the conceptual lacuna for this concept:

CONCEPT: {concept_label} ({concept_id})
CLUSTER: {cluster}

DEFINITIONS:
- {primary_language.upper()}: {definitions.get(primary_language, 'N/A')}
- {comparison_language.upper()}: {definitions.get(comparison_language, 'N/A')}

LACUNA TYPE: {lacuna_type}

VISUALIZATION POSITION (UMAP projection):
- {primary_language.upper()}: ({primary_pos[0]:.1f}, {primary_pos[1]:.1f})
- {comparison_language.upper()}: ({comparison_pos[0]:.1f}, {comparison_pos[1]:.1f})

SEMANTICALLY NEAREST NEIGHBORS (by embedding cosine similarity):
- {primary_language.upper()}: {primary_neighbor_str}
- {comparison_language.upper()}: {comparison_neighbor_str}

Explain WHY this conceptual gap exists. Be specific with historical details and citations."""

    print(f"[interpreter] Generating interpretation for {concept_id}...")

    response = client.chat.complete(
        model="mistral-large-latest",
        messages=[
            {"role": "system", "content": INTERPRETER_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        response_format={"type": "json_object"},
    )

    content = response.choices[0].message.content

    try:
        result = json.loads(content)
        return {
            "cultural": result.get("cultural", ""),
            "historical": result.get("historical", ""),
            "structural": result.get("structural", ""),
            "citations": result.get("citations", []),
            "summary": result.get("summary", ""),
            "lacuna_type": lacuna_type,
        }
    except json.JSONDecodeError:
        print(f"[interpreter] Failed to parse LLM response as JSON")
        return {
            "cultural": content,
            "historical": "",
            "structural": "",
            "citations": [],
            "summary": "",
            "lacuna_type": lacuna_type,
        }


def interpret_concept_card(
    concept: Dict,
    all_concepts: List[Dict],
    language: str = "en",
    comparison_language: str = "de",
    k_neighbors: int = 8,
) -> Dict:
    """
    Generate full interpretation for a concept card.

    Args:
        concept: The concept dictionary
        all_concepts: All concepts (for neighbor calculation)
        language: Primary language being viewed
        comparison_language: Language to compare against
        k_neighbors: Number of neighbors to include

    Returns:
        Full interpretation dict
    """
    from lib.embeddings import embed_texts
    import numpy as np

    def cosine_sim(a: np.ndarray, b: np.ndarray) -> float:
        """Compute cosine similarity between two vectors."""
        return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-10))

    def get_neighbors_by_embedding(lang: str) -> List[Dict]:
        """Get neighbors using actual embedding cosine similarity."""
        # Get target concept's definition
        target_def = concept.get("definitions", {}).get(lang)
        if not target_def:
            return []

        # Collect all definitions for this language
        other_concepts = []
        other_definitions = []
        for c in all_concepts:
            if c["id"] == concept["id"]:
                continue
            c_def = c.get("definitions", {}).get(lang)
            if c_def:
                other_concepts.append(c)
                other_definitions.append(c_def)

        if not other_definitions:
            return []

        # Embed target and all others
        all_defs = [target_def] + other_definitions
        embeddings = embed_texts(all_defs)
        target_emb = embeddings[0]
        other_embs = embeddings[1:]

        # Compute similarities
        neighbors = []
        for c, emb in zip(other_concepts, other_embs):
            sim = cosine_sim(target_emb, emb)
            neighbors.append({
                "id": c["id"],
                "label": c["labels"].get(lang, c["id"]),
                "similarity": sim,
            })

        # Sort by similarity (highest first)
        neighbors.sort(key=lambda x: x["similarity"], reverse=True)
        return neighbors[:k_neighbors]

    neighbors = {
        language: get_neighbors_by_embedding(language),
        comparison_language: get_neighbors_by_embedding(comparison_language),
    }

    return interpret_lacuna(
        concept_id=concept["id"],
        concept_label=concept["labels"].get(language, concept["id"]),
        definitions=concept.get("definitions", {}),
        neighbors=neighbors,
        position=concept["position"],
        is_ghost=concept["ghost"],
        cluster=concept["cluster"],
        primary_language=language,
        comparison_language=comparison_language,
    )


# CLI interface
if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Interpret concept lacunae")
    parser.add_argument("concepts", type=Path, help="Concepts JSON file")
    parser.add_argument("concept_id", help="Concept ID to interpret")
    parser.add_argument("--lang", "-l", default="en", help="Primary language")
    parser.add_argument("--compare", "-c", default="de", help="Comparison language")
    parser.add_argument("--output", "-o", type=Path, help="Output JSON file")

    args = parser.parse_args()

    # Load concepts
    with open(args.concepts) as f:
        concepts = json.load(f)

    # Find concept
    concept = next((c for c in concepts if c["id"] == args.concept_id), None)
    if not concept:
        print(f"Concept '{args.concept_id}' not found")
        sys.exit(1)

    # Generate interpretation
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent.parent / ".env")

    interpretation = interpret_concept_card(
        concept=concept,
        all_concepts=concepts,
        language=args.lang,
        comparison_language=args.compare,
    )

    if args.output:
        with open(args.output, "w") as f:
            json.dump(interpretation, f, indent=2, ensure_ascii=False)
        print(f"Written to {args.output}")
    else:
        print(json.dumps(interpretation, indent=2, ensure_ascii=False))
