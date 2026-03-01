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


EXTRACTION_SYSTEM_PROMPT = """You are a conceptual frame decomposer for the LACUNA project.

Your task is to DECOMPOSE concepts into their constituent conceptual frames. Not keywords. FRAMES.

Example: The word "Reparations" decomposes into these underlying frames:
- justice (the moral claim that wrongdoers must pay)
- debt (the financial obligation owed)
- obligation (the binding duty to fulfill)
- punishment (the punitive dimension)
- humiliation (the shame of being forced to pay)
- betrayal (the sense of unfair imposition)

Each frame captures a different ANGLE on how the concept operates in discourse.

For each frame you extract:
1. id: A lowercase slug (e.g., "war-guilt", "national-honor")
2. labels: The term in each requested language - use the NATIVE term, not translation
3. definitions: A 1-2 sentence definition in each language capturing the frame's specific meaning in this historical context
4. cluster: Category (core, justice, victory, humiliation, or new)
5. source_quote: Where this frame appears or is implied in the document
6. confidence: 0-1 confidence this is a meaningful distinct frame

CRITICAL:
- Decompose concepts into their constituent frames
- Find frames that might operate DIFFERENTLY across languages
- Look for frames that are PRESENT in one language but ABSENT in another
- German "Schuld" = guilt + debt (one word, two frames)
- French "revanche" = revenge + restoration (emotional + practical)

Avoid:
- Surface-level keywords without conceptual depth
- Frames that are identical across languages (boring, won't show on visualization)
- Generic terms unless they carry specific contested weight

Output valid JSON array of frames."""


EXTRACTION_USER_TEMPLATE = """DECOMPOSE the concepts in this document into their constituent conceptual frames.

Language: {languages}
Maximum frames: {max_concepts}

Document:
---
{document}
---

TASK: Find a concept mentioned in the document, then DECOMPOSE it into the underlying frames that give it meaning.

Example decomposition of "Reparations":
[
  {{
    "id": "reparations-as-justice",
    "labels": {{"en": "justice", "de": "Gerechtigkeit"}},
    "definitions": {{
      "en": "The moral principle that those who caused harm must make amends",
      "de": "Das moralische Prinzip, dass Verursacher von Schaden Wiedergutmachung leisten müssen"
    }},
    "cluster": "justice",
    "source_quote": "Germany accepts responsibility for causing all the loss and damage...",
    "confidence": 0.95
  }},
  {{
    "id": "reparations-as-punishment",
    "labels": {{"en": "punishment", "de": "Strafe"}},
    "definitions": {{
      "en": "The punitive dimension - payment as penalty for wrongdoing",
      "de": "Die Strafdimension - Zahlung als Strafe für Fehlverhalten"
    }},
    "cluster": "justice",
    "source_quote": "crushing Reparationen",
    "confidence": 0.92
  }},
  {{
    "id": "reparations-as-humiliation",
    "labels": {{"en": "humiliation", "de": "Demütigung"}},
    "definitions": {{
      "en": "The shame of being forced to pay by the victors",
      "de": "Die Schmach, von den Siegern zur Zahlung gezwungen zu werden"
    }},
    "cluster": "humiliation",
    "source_quote": "economic Versklavung",
    "confidence": 0.90
  }}
]

Return a JSON array of frames. Each frame must have:
- id: string (lowercase slug, can include parent concept like "reparations-as-justice")
- labels: object mapping language codes to NATIVE labels (not translations)
- definitions: object mapping language codes to contextual definitions
- cluster: string (core, justice, victory, humiliation, or new)
- source_quote: string (where this frame appears/is implied)
- confidence: number 0-1

Return only the JSON array, no other text."""


async def extract_frames(
    document: str,
    languages: List[str] = ["en", "de"],
    max_concepts: int = 20,
    model: str = "mistral-large-latest",
) -> List[ExtractedFrame]:
    """
    Extract conceptual frames from a document using Mistral.

    Args:
        document: Raw document text
        languages: Target languages for extraction
        max_concepts: Maximum number of concepts to extract
        model: Mistral model to use

    Returns:
        List of ExtractedFrame objects
    """
    client = get_client()

    prompt = EXTRACTION_USER_TEMPLATE.format(
        languages=", ".join(languages),
        max_concepts=max_concepts,
        document=document[:15000],  # Truncate very long docs
    )

    response = await client.chat.complete_async(
        model=model,
        messages=[
            {"role": "system", "content": EXTRACTION_SYSTEM_PROMPT},
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
) -> List[ExtractedFrame]:
    """Synchronous wrapper for extract_frames."""
    import asyncio
    return asyncio.run(extract_frames(document, languages, max_concepts, model))


# CLI interface
if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Extract frames from document")
    parser.add_argument("input", type=Path, help="Input document file")
    parser.add_argument("--output", "-o", type=Path, help="Output JSON file")
    parser.add_argument("--languages", "-l", nargs="+", default=["en", "de"])
    parser.add_argument("--max", "-m", type=int, default=20)

    args = parser.parse_args()

    # Read document
    with open(args.input) as f:
        document = f.read()

    print(f"[extractor] Processing {args.input} ({len(document)} chars)")

    # Extract
    frames = extract_frames_sync(document, args.languages, args.max)
    print(f"[extractor] Extracted {len(frames)} frames")

    # Output
    output = [f.model_dump() for f in frames]
    if args.output:
        with open(args.output, "w") as f:
            json.dump(output, f, indent=2, ensure_ascii=False)
        print(f"[extractor] Written to {args.output}")
    else:
        print(json.dumps(output, indent=2, ensure_ascii=False))
