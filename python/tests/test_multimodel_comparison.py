#!/usr/bin/env python3
"""
LACUNA Multi-Model Comparison

Runs the same 51 concepts through BGE-M3 and multilingual-e5-large,
compares divergence patterns, ghost detection, and weight distributions.

If both models agree on which concepts diverge, the finding is about
language, not the model. That's the mic drop.

Usage:
    cd python && python3 tests/test_multimodel_comparison.py
"""

import json
import sys
from pathlib import Path
import numpy as np
from typing import Dict, List, Tuple

sys.path.insert(0, str(Path(__file__).parent.parent))

from lib.schemas import ValidatedFrame


# Global model instances
_models = {}


def get_model(name: str):
    """Lazy load a sentence-transformer model."""
    global _models
    if name not in _models:
        from sentence_transformers import SentenceTransformer
        print(f"[loader] Loading {name}...")
        _models[name] = SentenceTransformer(name)
        print(f"[loader] {name} loaded.")
    return _models[name]


def embed_with_model(texts: List[str], model_name: str) -> np.ndarray:
    """Embed texts with a specific model."""
    model = get_model(model_name)
    return np.array(model.encode(texts, batch_size=8, normalize_embeddings=True))


def compute_centrality_weights(embeddings: np.ndarray) -> List[float]:
    """Compute centrality-based weights for a set of embeddings."""
    if len(embeddings) < 2:
        return [0.5] * len(embeddings)

    sim_matrix = embeddings @ embeddings.T
    weights = []
    for i in range(len(embeddings)):
        others = np.concatenate([sim_matrix[i, :i], sim_matrix[i, i+1:]])
        weights.append(float(np.mean(others)))

    min_w, max_w = min(weights), max(weights)
    if max_w - min_w < 1e-6:
        return [0.5] * len(weights)

    return [float(np.clip((w - min_w) / (max_w - min_w), 0.05, 0.95)) for w in weights]


def run_model_analysis(concepts: list, model_name: str, languages=["en", "de"]) -> dict:
    """Run full analysis for one model on one document's concepts."""

    # Embed per language
    lang_data = {}
    for lang in languages:
        ids = []
        texts = []
        for c in concepts:
            defs = c.get("definitions", c.get("labels", {}))
            if lang in defs:
                ids.append(c["id"])
                texts.append(defs[lang])
        if texts:
            embs = embed_with_model(texts, model_name)
            lang_data[lang] = {"ids": ids, "embeddings": embs}

    # Compute weights per language
    weights = {}
    for lang in languages:
        if lang not in lang_data:
            continue
        ids = lang_data[lang]["ids"]
        embs = lang_data[lang]["embeddings"]
        w = compute_centrality_weights(embs)
        for i, id_ in enumerate(ids):
            if id_ not in weights:
                weights[id_] = {}
            weights[id_][lang] = w[i]

    # Compute cross-language divergence
    divergences = {}
    for lang in languages:
        if lang not in lang_data:
            continue
    # Build embedding lookup
    emb_lookup = {}
    for lang in languages:
        if lang not in lang_data:
            continue
        for i, id_ in enumerate(lang_data[lang]["ids"]):
            if id_ not in emb_lookup:
                emb_lookup[id_] = {}
            emb_lookup[id_][lang] = lang_data[lang]["embeddings"][i]

    for id_, lang_embs in emb_lookup.items():
        if len(lang_embs) < 2:
            divergences[id_] = 0.0
            continue
        keys = list(lang_embs.keys())
        cos_sim = float(np.dot(lang_embs[keys[0]], lang_embs[keys[1]]))
        divergences[id_] = 1.0 - cos_sim

    # Ghost detection
    ghosts = {}
    for c in concepts:
        id_ = c["id"]
        ghosts[id_] = {}
        w = weights.get(id_, {})
        for lang in languages:
            wl = w.get(lang, 0.5)
            if wl < 0.15:
                ghosts[id_][lang] = True
                continue
            other_ws = [w.get(l, 0.5) for l in languages if l != lang]
            if other_ws and max(other_ws) / max(wl, 0.01) > 2.5:
                ghosts[id_][lang] = True
                continue
            ghosts[id_][lang] = False

    return {
        "weights": weights,
        "divergences": divergences,
        "ghosts": ghosts,
    }


def print_comparison(concepts, results_bge, results_e5, doc_name):
    """Print side-by-side comparison of two models."""
    print(f"\n{'='*90}")
    print(f"  {doc_name}")
    print(f"  BGE-M3 vs multilingual-e5-large")
    print(f"{'='*90}")
    print(f"{'ID':<42} {'BGE div':>7} {'E5 div':>7} {'agree':>6} {'BGE ghost':>10} {'E5 ghost':>10}")
    print(f"{'─'*90}")

    agree_count = 0
    total = 0
    ghost_agree = 0
    ghost_total = 0

    div_pairs = []

    for c in concepts:
        id_ = c["id"]
        d_bge = results_bge["divergences"].get(id_, 0)
        d_e5 = results_e5["divergences"].get(id_, 0)

        g_bge_en = results_bge["ghosts"].get(id_, {}).get("en", False)
        g_bge_de = results_bge["ghosts"].get(id_, {}).get("de", False)
        g_e5_en = results_e5["ghosts"].get(id_, {}).get("en", False)
        g_e5_de = results_e5["ghosts"].get(id_, {}).get("de", False)

        bge_ghost = "EN" if g_bge_en else ("DE" if g_bge_de else "")
        e5_ghost = "EN" if g_e5_en else ("DE" if g_e5_de else "")

        # Divergence agreement: both above or both below median
        div_pairs.append((d_bge, d_e5))
        total += 1

        # Ghost agreement
        if g_bge_en or g_bge_de or g_e5_en or g_e5_de:
            ghost_total += 1
            if bge_ghost == e5_ghost:
                ghost_agree += 1

        agree_str = ""
        if abs(d_bge - d_e5) < 0.05:
            agree_str = "YES"
            agree_count += 1
        elif (d_bge > 0.15 and d_e5 > 0.15) or (d_bge < 0.15 and d_e5 < 0.15):
            agree_str = "~"
            agree_count += 1
        else:
            agree_str = "NO"

        print(f"{id_:<42} {d_bge:>7.3f} {d_e5:>7.3f} {agree_str:>6} {bge_ghost:>10} {e5_ghost:>10}")

    # Correlation
    bge_divs = [p[0] for p in div_pairs]
    e5_divs = [p[1] for p in div_pairs]
    if len(bge_divs) > 2:
        correlation = float(np.corrcoef(bge_divs, e5_divs)[0, 1])
    else:
        correlation = 0.0

    print(f"{'─'*90}")
    print(f"Divergence agreement: {agree_count}/{total} ({100*agree_count/total:.0f}%)")
    print(f"Ghost agreement: {ghost_agree}/{ghost_total} ({100*ghost_agree/max(ghost_total,1):.0f}%)" if ghost_total > 0 else "No ghosts to compare")
    print(f"Divergence correlation (Pearson r): {correlation:.3f}")
    print(f"  r > 0.7 = models agree on WHICH concepts diverge")
    print(f"  r > 0.85 = strong agreement, finding is about language not model")

    # BGE stats
    print(f"\nBGE-M3:  div range [{min(bge_divs):.3f} - {max(bge_divs):.3f}], mean {np.mean(bge_divs):.3f}, ghosts {sum(1 for c in concepts if results_bge['ghosts'].get(c['id'],{}).get('en',False) or results_bge['ghosts'].get(c['id'],{}).get('de',False))}")
    print(f"E5-large: div range [{min(e5_divs):.3f} - {max(e5_divs):.3f}], mean {np.mean(e5_divs):.3f}, ghosts {sum(1 for c in concepts if results_e5['ghosts'].get(c['id'],{}).get('en',False) or results_e5['ghosts'].get(c['id'],{}).get('de',False))}")

    return correlation, agree_count, total, ghost_agree, ghost_total, bge_divs, e5_divs


def main():
    examples_dir = Path(__file__).parent.parent / "examples"
    models = ["BAAI/bge-m3", "intfloat/multilingual-e5-large"]

    files = [
        ("Article 231", examples_dir / "article_231_concepts.json"),
        ("German Response", examples_dir / "german_response_concepts.json"),
        ("Wilson Fourteen Points", examples_dir / "wilson_concepts.json"),
    ]

    all_correlations = []
    all_bge_divs = []
    all_e5_divs = []

    for doc_name, filepath in files:
        if not filepath.exists():
            print(f"SKIP: {filepath}")
            continue

        with open(filepath) as f:
            concepts = json.load(f)

        print(f"\n[run] Embedding {doc_name} with BGE-M3...")
        results_bge = run_model_analysis(concepts, models[0])

        print(f"[run] Embedding {doc_name} with e5-large...")
        results_e5 = run_model_analysis(concepts, models[1])

        corr, agree, total, g_agree, g_total, bge_d, e5_d = print_comparison(
            concepts, results_bge, results_e5, doc_name
        )
        all_correlations.append(corr)
        all_bge_divs.extend(bge_d)
        all_e5_divs.extend(e5_d)

    # Overall
    if all_bge_divs:
        overall_corr = float(np.corrcoef(all_bge_divs, all_e5_divs)[0, 1])
        print(f"\n{'='*90}")
        print(f"  OVERALL (all 51 concepts)")
        print(f"{'='*90}")
        print(f"Overall Pearson r: {overall_corr:.3f}")
        print(f"Per-document correlations: {', '.join(f'{c:.3f}' for c in all_correlations)}")
        print()
        if overall_corr > 0.85:
            print("STRONG AGREEMENT. The divergence pattern is about LANGUAGE, not MODEL.")
            print("schuld-as-guilt, dolchstoss-as-betrayal, fetters-as-enslavement --")
            print("these lacunae are real structural features of how EN and DE organize concepts.")
        elif overall_corr > 0.7:
            print("MODERATE AGREEMENT. Most divergence patterns hold across models.")
            print("Some concept-level disagreements worth investigating.")
        else:
            print("WEAK AGREEMENT. Models see different topology. Findings may be model-dependent.")
            print("Need more models to determine what's real vs artifact.")


if __name__ == "__main__":
    main()
