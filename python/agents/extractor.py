"""
LACUNA Extractor Agent

Uses Mistral to extract conceptual frames from raw documents.
Outputs structured ExtractedFrame[] matching the schema.

Usage:
    from agents.extractor import extract_frames
    frames = await extract_frames(document_text, languages=["en", "de"])
"""

import json
import os
from typing import List, Optional

from mistralai import Mistral

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from lib.schemas import ExtractedFrame


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


# Domain-specific examples for different document types
DOMAIN_EXAMPLES = {
    "versailles": {
        "concept": "Reparations",
        "frames": [
            "justice (the moral claim that wrongdoers must pay)",
            "debt (the financial obligation owed)",
            "obligation (the binding duty to fulfill)",
            "punishment (the punitive dimension)",
            "humiliation (the shame of being forced to pay)",
            "betrayal (the sense of unfair imposition)",
        ],
        "linguistic_notes": [
            'German "Schuld" = guilt + debt (one word, two frames)',
            'French "revanche" = revenge + restoration (emotional + practical)',
        ],
        "clusters": "core, justice, victory, humiliation",
    },
    "cold_war": {
        "concept": "Containment",
        "frames": [
            "defense (protecting against ideological spread)",
            "aggression (the offensive dimension of 'containing')",
            "dominion (spheres of influence and control)",
            "liberation (freeing peoples from opposing ideology)",
            "security (national and collective safety)",
        ],
        "linguistic_notes": [
            'Russian "сдерживание" carries defensive connotation vs. aggressive "containment"',
            'German "Eindämmung" evokes dam/flood metaphors',
        ],
        "clusters": "core, ideology, security, confrontation",
    },
    "default": {
        "concept": "Sovereignty",
        "frames": [
            "authority (legitimate power to govern)",
            "independence (freedom from external control)",
            "territory (spatial domain of control)",
            "recognition (acknowledgment by other states)",
            "intervention (violations of sovereign space)",
        ],
        "linguistic_notes": [
            "Different legal traditions shape sovereignty differently",
            "Post-colonial contexts add layers of meaning",
        ],
        "clusters": "core, authority, territory, recognition",
    },
}


def build_system_prompt(domain: str = "default") -> str:
    """Build system prompt with domain-specific examples."""
    examples = DOMAIN_EXAMPLES.get(domain, DOMAIN_EXAMPLES["default"])

    frame_list = "\n".join(f"- {f}" for f in examples["frames"])
    linguistic_notes = "\n".join(f"- {n}" for n in examples["linguistic_notes"])

    return f"""You are a conceptual frame decomposer for the LACUNA project.

Your task is to DECOMPOSE concepts into their constituent conceptual frames. Not keywords. FRAMES.

Example: The word "{examples['concept']}" decomposes into these underlying frames:
{frame_list}

Each frame captures a different ANGLE on how the concept operates in discourse.

For each frame you extract:
1. id: A lowercase slug (e.g., "war-guilt", "national-honor")
2. labels: The term in each requested language - use the NATIVE term, not translation
3. definitions: A 1-2 sentence definition in each language capturing the frame's specific meaning in this historical context
4. cluster: Category ({examples['clusters']}, or new)
5. source_quote: Where this frame appears or is implied in the document
6. confidence: 0-1 confidence this is a meaningful distinct frame

CRITICAL:
- Decompose concepts into their constituent frames
- Find frames that might operate DIFFERENTLY across languages
- Look for frames that are PRESENT in one language but ABSENT in another
{linguistic_notes}

Avoid:
- Surface-level keywords without conceptual depth
- Frames that are identical across languages (boring, won't show on visualization)
- Generic terms unless they carry specific contested weight

Output valid JSON with a "frames" array: {{"frames": [...]}}"""


EXTRACTION_USER_TEMPLATE = """DECOMPOSE the concepts in this document into their constituent conceptual frames.

Language: {languages}
Maximum frames: {max_concepts}

Document:
---
{document}
---

TASK: Find a concept mentioned in the document, then DECOMPOSE it into the underlying frames that give it meaning.

Example output format:
{{
  "frames": [
    {{
      "id": "concept-as-frame",
      "labels": {{"en": "frame", "de": "Rahmen"}},
      "definitions": {{
        "en": "Definition capturing this frame's specific meaning in context",
        "de": "Definition, die die spezifische Bedeutung dieses Rahmens im Kontext erfasst"
      }},
      "cluster": "category",
      "source_quote": "Quote from document where this frame appears...",
      "confidence": 0.95
    }}
  ]
}}

Each frame must have:
- id: string (lowercase slug, can include parent concept like "reparations-as-justice")
- labels: object mapping language codes to NATIVE labels (not translations)
- definitions: object mapping language codes to contextual definitions
- cluster: string (category appropriate to the domain)
- source_quote: string (where this frame appears/is implied)
- confidence: number 0-1

Return JSON object with "frames" array: {{"frames": [...]}}"""


async def extract_frames(
    document: str,
    languages: List[str] = ["en", "de"],
    max_concepts: int = 20,
    model: str = "mistral-large-latest",
    domain: str = "default",
) -> List[ExtractedFrame]:
    """
    Extract conceptual frames from a document using Mistral.

    Args:
        document: Raw document text
        languages: Target languages for extraction
        max_concepts: Maximum number of concepts to extract
        model: Mistral model to use
        domain: Domain for context-specific examples (versailles, cold_war, default)

    Returns:
        List of ExtractedFrame objects
    """
    client = get_client()

    system_prompt = build_system_prompt(domain)
    prompt = EXTRACTION_USER_TEMPLATE.format(
        languages=", ".join(languages),
        max_concepts=max_concepts,
        document=document[:15000],  # Truncate very long docs
    )

    response = await client.chat.complete_async(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt},
        ],
        temperature=0.3,  # Lower temperature for more consistent extraction
        response_format={"type": "json_object"},
    )

    # Parse response
    content = response.choices[0].message.content
    try:
        data = json.loads(content)
        # Handle both array and object with "frames" key
        if isinstance(data, list):
            frames_data = data
        elif isinstance(data, dict) and "frames" in data:
            frames_data = data["frames"]
        else:
            frames_data = [data] if isinstance(data, dict) else []
    except json.JSONDecodeError as e:
        print(f"[extractor] Failed to parse JSON: {e}")
        print(f"[extractor] Raw content: {content[:500]}")
        return []

    # Convert to Pydantic models
    frames = []
    for fd in frames_data:
        try:
            frame = ExtractedFrame(
                id=fd.get("id", "unknown"),
                labels=fd.get("labels", {}),
                definitions=fd.get("definitions", {}),
                cluster=fd.get("cluster", "extracted"),
                source_quote=fd.get("source_quote"),
                confidence=fd.get("confidence", 1.0),
            )
            frames.append(frame)
        except Exception as e:
            print(f"[extractor] Failed to parse frame: {e}")
            continue

    return frames


def extract_frames_sync(
    document: str,
    languages: List[str] = ["en", "de"],
    max_concepts: int = 20,
    model: str = "mistral-large-latest",
    domain: str = "default",
) -> List[ExtractedFrame]:
    """Synchronous wrapper for extract_frames."""
    import asyncio
    return asyncio.run(extract_frames(document, languages, max_concepts, model, domain))


# CLI interface
if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Extract frames from document")
    parser.add_argument("input", type=Path, help="Input document file")
    parser.add_argument("--output", "-o", type=Path, help="Output JSON file")
    parser.add_argument("--languages", "-l", nargs="+", default=["en", "de"])
    parser.add_argument("--max", "-m", type=int, default=20)
    parser.add_argument(
        "--domain", "-d",
        default="default",
        choices=list(DOMAIN_EXAMPLES.keys()),
        help="Domain for context-specific examples"
    )

    args = parser.parse_args()

    # Read document
    with open(args.input) as f:
        document = f.read()

    print(f"[extractor] Processing {args.input} ({len(document)} chars) [domain={args.domain}]")

    # Extract
    frames = extract_frames_sync(document, args.languages, args.max, domain=args.domain)
    print(f"[extractor] Extracted {len(frames)} frames")

    # Output
    output = [f.model_dump() for f in frames]
    if args.output:
        with open(args.output, "w") as f:
            json.dump(output, f, indent=2, ensure_ascii=False)
        print(f"[extractor] Written to {args.output}")
    else:
        print(json.dumps(output, indent=2, ensure_ascii=False))
