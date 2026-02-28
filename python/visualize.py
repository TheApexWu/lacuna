#!/usr/bin/env python3
"""
Simple visualization of concept positions.

Usage:
    python visualize.py examples/article_231_concepts.json
    python visualize.py examples/article_231_concepts.json --lang de
    python visualize.py examples/article_231_concepts.json -o plot.png
"""

import argparse
import json
from pathlib import Path

def main():
    parser = argparse.ArgumentParser(description="Visualize concept positions")
    parser.add_argument("input", type=Path, help="Concepts JSON file")
    parser.add_argument("--lang", "-l", default="en", help="Language to visualize")
    parser.add_argument("--output", "-o", type=Path, help="Save plot to file")
    parser.add_argument("--compare", "-c", action="store_true", help="Compare EN vs DE positions")
    args = parser.parse_args()

    # Load concepts
    with open(args.input) as f:
        concepts = json.load(f)

    print(f"Loaded {len(concepts)} concepts from {args.input}")

    if args.compare:
        print_comparison(concepts)
    else:
        try:
            import matplotlib.pyplot as plt
            plot_concepts(concepts, args.lang, args.output)
        except ImportError:
            print("matplotlib not installed. Showing text summary instead.\n")
            print_summary(concepts, args.lang)


def print_summary(concepts, lang):
    """Print text summary of positions."""
    print(f"\n{'ID':<40} {'Position':<20} {'Cluster':<15}")
    print("-" * 75)

    # Sort by x position
    sorted_concepts = sorted(concepts, key=lambda c: c["position"].get(lang, [0, 0])[0])

    for c in sorted_concepts:
        pos = c["position"].get(lang, [0, 0])
        print(f"{c['id']:<40} ({pos[0]:>7.2f}, {pos[1]:>7.2f})  {c['cluster']:<15}")


def print_comparison(concepts):
    """Compare EN vs DE positions."""
    print(f"\n{'ID':<35} {'EN Position':<18} {'DE Position':<18} {'Δ Distance':<10}")
    print("-" * 85)

    for c in concepts:
        en_pos = c["position"].get("en", [0, 0])
        de_pos = c["position"].get("de", [0, 0])

        # Euclidean distance between EN and DE positions
        dist = ((en_pos[0] - de_pos[0])**2 + (en_pos[1] - de_pos[1])**2)**0.5

        print(f"{c['id']:<35} ({en_pos[0]:>6.2f},{en_pos[1]:>6.2f})  ({de_pos[0]:>6.2f},{de_pos[1]:>6.2f})  {dist:>8.2f}")


def plot_concepts(concepts, lang, output_path=None):
    """Plot concepts using matplotlib."""
    import matplotlib.pyplot as plt

    # Cluster colors
    colors = {
        "core": "#f59e0b",
        "justice": "#3b82f6",
        "victory": "#22c55e",
        "humiliation": "#ef4444",
        "ghost-de": "#78716c",
        "ghost-en": "#78716c",
    }

    fig, ax = plt.subplots(figsize=(12, 10))

    for c in concepts:
        pos = c["position"].get(lang, [0, 0])
        color = colors.get(c["cluster"], "#888888")

        ax.scatter(pos[0], pos[1], c=color, s=100, alpha=0.7)
        ax.annotate(
            c["id"],
            (pos[0], pos[1]),
            fontsize=8,
            ha='left',
            va='bottom',
            alpha=0.8
        )

    ax.set_xlabel("UMAP Dimension 1")
    ax.set_ylabel("UMAP Dimension 2")
    ax.set_title(f"Concept Positions ({lang.upper()})")
    ax.grid(True, alpha=0.3)

    # Legend
    for cluster, color in colors.items():
        ax.scatter([], [], c=color, label=cluster, s=100)
    ax.legend(loc='upper left')

    plt.tight_layout()

    if output_path:
        plt.savefig(output_path, dpi=150)
        print(f"Saved plot to {output_path}")
    else:
        plt.show()


if __name__ == "__main__":
    main()
