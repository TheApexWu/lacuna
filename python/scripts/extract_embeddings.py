#!/usr/bin/env python3
"""
Extract BGE-M3 embeddings for curated Versailles concepts.
Run this once after installing dependencies.
"""

import json
import sys
from pathlib import Path
import numpy as np

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.embeddings import EmbeddingService
from app.config import settings


def main():
    """Extract and save embeddings for all curated concepts."""
    print("Loading BGE-M3 model...")
    embedding_service = EmbeddingService()

    # Load concepts
    data_dir = Path(settings.data_dir)
    versailles_path = data_dir / "versailles.json"

    if not versailles_path.exists():
        print(f"Error: {versailles_path} not found")
        print("Run: node scripts/export_concepts.js")
        sys.exit(1)

    with open(versailles_path, "r") as f:
        concepts = json.load(f)

    print(f"Loaded {len(concepts)} concepts")

    # Process each language
    for lang in ["en", "de"]:
        print(f"\n=== Processing {lang.upper()} ===")

        # Collect texts and IDs
        texts = []
        concept_ids = []

        for concept in concepts:
            # Use definition if available, otherwise use label
            if "definitions" in concept and lang in concept["definitions"]:
                text = concept["definitions"][lang]
            elif "labels" in concept and lang in concept["labels"]:
                text = concept["labels"][lang]
            else:
                continue  # Skip if no text available

            texts.append(text)
            concept_ids.append(concept["id"])

        print(f"  Embedding {len(texts)} concepts...")

        # Generate embeddings in batch
        embeddings = embedding_service.embed_batch(texts)

        # Save embeddings
        embeddings_path = data_dir / f"embeddings_{lang}.npy"
        np.save(embeddings_path, embeddings)
        print(f"  ✓ Saved embeddings to {embeddings_path}")
        print(f"    Shape: {embeddings.shape}")

        # Save concept IDs (order matters!)
        ids_path = data_dir / f"concept_ids_{lang}.json"
        with open(ids_path, "w") as f:
            json.dump(concept_ids, f, indent=2)
        print(f"  ✓ Saved concept IDs to {ids_path}")

    print("\n✅ Embedding extraction complete!")
    print(f"Generated embeddings for {len(texts)} concepts in 2 languages")


if __name__ == "__main__":
    main()
