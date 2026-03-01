#!/usr/bin/env python3
"""
Fit UMAP models on curated concept embeddings.
Run this once after extract_embeddings.py completes.
"""

import sys
import pickle
from pathlib import Path
import numpy as np
from umap import UMAP

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.config import settings


def main():
    """Fit and save UMAP models for each language."""
    data_dir = Path(settings.data_dir)

    # Process each language
    for lang in ["en", "de"]:
        print(f"\n=== Processing {lang.upper()} ===")

        # Load embeddings
        embeddings_path = data_dir / f"embeddings_{lang}.npy"
        if not embeddings_path.exists():
            print(f"Error: {embeddings_path} not found")
            print("Run: python scripts/extract_embeddings.py")
            sys.exit(1)

        embeddings = np.load(embeddings_path)
        print(f"  Loaded embeddings: {embeddings.shape}")

        # Calculate normalization stats for weight calculation
        norms = np.linalg.norm(embeddings, axis=1)
        min_norm = float(np.min(norms))
        max_norm = float(np.max(norms))

        print(f"  Embedding norms: min={min_norm:.4f}, max={max_norm:.4f}")

        # Fit UMAP
        print(f"  Fitting UMAP with n_neighbors={settings.umap_n_neighbors}, min_dist={settings.umap_min_dist}...")

        umap_model = UMAP(
            n_components=settings.umap_n_components,
            n_neighbors=settings.umap_n_neighbors,
            min_dist=settings.umap_min_dist,
            metric=settings.umap_metric,
            random_state=settings.umap_random_state
        )

        # Fit the model
        transformed = umap_model.fit_transform(embeddings)
        print(f"  ✓ UMAP fitted successfully")
        print(f"    Transformed shape: {transformed.shape}")

        # Print position statistics
        x_coords = transformed[:, 0]
        z_coords = transformed[:, 1]
        print(f"    X range: [{x_coords.min():.2f}, {x_coords.max():.2f}]")
        print(f"    Z range: [{z_coords.min():.2f}, {z_coords.max():.2f}]")

        # Save model with normalization stats
        model_path = data_dir / f"umap_model_{lang}.pkl"
        model_data = {
            "model": umap_model,
            "min_norm": min_norm,
            "max_norm": max_norm
        }

        with open(model_path, "wb") as f:
            pickle.dump(model_data, f)

        print(f"  ✓ Saved UMAP model to {model_path}")

        # Optional: Compare with curated positions
        try:
            import json
            versailles_path = data_dir / "versailles.json"
            if versailles_path.exists():
                with open(versailles_path, "r") as f:
                    concepts = json.load(f)

                # Load concept IDs to match order
                ids_path = data_dir / f"concept_ids_{lang}.json"
                with open(ids_path, "r") as f:
                    concept_ids = json.load(f)

                # Build lookup for curated positions
                curated_positions = {}
                for concept in concepts:
                    if lang in concept["position"]:
                        curated_positions[concept["id"]] = concept["position"][lang]

                # Calculate differences
                diffs = []
                for i, concept_id in enumerate(concept_ids):
                    if concept_id in curated_positions:
                        curated = np.array(curated_positions[concept_id])
                        umap_pos = transformed[i]
                        diff = np.linalg.norm(curated - umap_pos)
                        diffs.append(diff)

                if diffs:
                    mean_diff = np.mean(diffs)
                    max_diff = np.max(diffs)
                    print(f"\n  Comparison with curated positions:")
                    print(f"    Mean difference: {mean_diff:.2f}")
                    print(f"    Max difference: {max_diff:.2f}")
                    print(f"    (UMAP creates its own semantic space - differences are expected)")
        except Exception as e:
            print(f"  (Could not compare with curated positions: {e})")

    print("\n✅ UMAP fitting complete!")
    print("Models are ready for use in the embedding service.")


if __name__ == "__main__":
    main()
