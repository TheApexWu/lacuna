"""
LACUNA Multi-Domain Dataset Comparator
Validates all domain datasets and generates a benchmark overview report.
Run this before embed.py to get a full picture of what's available.

Usage:
    python compare_domains.py              # Scan current directory
    python compare_domains.py --dir data/  # Custom directory
    python compare_domains.py --verbose    # Show all hero pair details
"""

import json
import os
import argparse
from pathlib import Path


# ── COLORS ────────────────────────────────────────────────────────────────────
class C:
    GREEN  = "\033[92m"
    YELLOW = "\033[93m"
    RED    = "\033[91m"
    BLUE   = "\033[94m"
    CYAN   = "\033[96m"
    BOLD   = "\033[1m"
    RESET  = "\033[0m"

def ok(msg):     print(f"  {C.GREEN}✅ {msg}{C.RESET}")
def warn(msg):   print(f"  {C.YELLOW}⚠️  {msg}{C.RESET}")
def fail(msg):   print(f"  {C.RED}❌ {msg}{C.RESET}")
def info(msg):   print(f"  {C.BLUE}ℹ️  {msg}{C.RESET}")
def section(msg):print(f"\n{C.BOLD}{C.CYAN}{msg}{C.RESET}")


# ── LOAD ALL DATASETS ─────────────────────────────────────────────────────────

def find_datasets(directory):
    """Find all concepts_*.json and concepts.json files in directory."""
    path = Path(directory)
    files = list(path.glob("concepts*.json"))
    return sorted(files)


def load_dataset(filepath):
    """Load and validate a single dataset file."""
    with open(filepath, encoding="utf-8") as f:
        try:
            data = json.load(f)
            return data, None
        except json.JSONDecodeError as e:
            return None, str(e)


# ── ANALYSE A SINGLE DATASET ──────────────────────────────────────────────────

def analyse_dataset(data, filepath):
    """Extract key metrics from a dataset."""
    meta      = data.get("meta", {})
    concepts  = data.get("concepts", [])
    languages = meta.get("languages", [])

    # Language coverage
    coverage = {}
    for lang in languages:
        count = sum(1 for c in concepts if lang in c.get("definitions", {}))
        coverage[lang] = count

    # Cluster distribution
    clusters = {}
    for c in concepts:
        cl = c.get("cluster", "unknown")
        clusters[cl] = clusters.get(cl, 0) + 1

    # Hero pairs
    hero_pairs = data.get("meta", {}).get("expected_hero_pairs", [])

    # Definition length stats
    all_lengths = []
    for c in concepts:
        for lang, defn in c.get("definitions", {}).items():
            all_lengths.append(len(defn))

    avg_len = round(sum(all_lengths) / len(all_lengths)) if all_lengths else 0

    return {
        "filepath":   filepath,
        "domain":     meta.get("domain", filepath.stem),
        "hypothesis": meta.get("hypothesis", ""),
        "languages":  languages,
        "n_concepts": len(concepts),
        "coverage":   coverage,
        "clusters":   clusters,
        "hero_pairs": hero_pairs,
        "avg_def_len": avg_len,
        "ready":      all(v == len(concepts) for v in coverage.values()),
    }


# ── PRINT DATASET SUMMARY ─────────────────────────────────────────────────────

def print_dataset_summary(info, verbose=False):
    status = f"{C.GREEN}READY{C.RESET}" if info["ready"] else f"{C.YELLOW}INCOMPLETE{C.RESET}"
    print(f"\n  {C.BOLD}{info['domain']}{C.RESET}  [{status}]")
    print(f"  File     : {info['filepath']}")
    print(f"  Concepts : {info['n_concepts']}")
    print(f"  Languages: {', '.join(info['languages'])}")

    # Coverage
    for lang, count in info["coverage"].items():
        pct = round(count / info["n_concepts"] * 100) if info["n_concepts"] else 0
        bar = "█" * (pct // 10) + "░" * (10 - pct // 10)
        color = C.GREEN if pct == 100 else C.YELLOW if pct >= 80 else C.RED
        print(f"  {lang.upper()}       : {color}{bar} {pct}%{C.RESET}")

    # Clusters
    cluster_str = "  ".join(f"{k}:{v}" for k, v in info["clusters"].items())
    print(f"  Clusters : {cluster_str}")

    # Hero pairs
    print(f"  Hero pairs: {len(info['hero_pairs'])}")
    if verbose:
        for hp in info["hero_pairs"]:
            pair = " ↔ ".join(hp.get("pair", []))
            hyp  = hp.get("hypothesis", "")[:80]
            print(f"    {C.BLUE}• {pair}{C.RESET}: {hyp}{'...' if len(hp.get('hypothesis','')) > 80 else ''}")

    if verbose and info["hypothesis"]:
        print(f"  Hypothesis: {info['hypothesis'][:120]}{'...' if len(info['hypothesis']) > 120 else ''}")


# ── GENERATE BENCHMARK MATRIX ─────────────────────────────────────────────────

def print_benchmark_matrix(analyses):
    section("── BENCHMARK MATRIX ─────────────────────────────────────────")
    print()

    # Header
    domains = [a["domain"][:20].ljust(22) for a in analyses]
    print(f"  {'Domain':<22} {'Concepts':>8}  {'EN':>4}  {'DE':>4}  {'FR':>4}  {'Heroes':>6}  {'Status'}")
    print(f"  {'─'*22} {'─'*8}  {'─'*4}  {'─'*4}  {'─'*4}  {'─'*6}  {'─'*10}")

    total_concepts = 0
    total_heroes   = 0

    for a in analyses:
        n  = a["n_concepts"]
        en = a["coverage"].get("en", 0)
        de = a["coverage"].get("de", 0)
        fr = a["coverage"].get("fr", 0)
        h  = len(a["hero_pairs"])
        status = f"{C.GREEN}✅ READY{C.RESET}" if a["ready"] else f"{C.YELLOW}⚠️  PARTIAL{C.RESET}"

        total_concepts += n
        total_heroes   += h

        print(f"  {a['domain'][:22]:<22} {n:>8}  {en:>4}  {de:>4}  {fr:>4}  {h:>6}  {status}")

    print(f"  {'─'*22} {'─'*8}  {'─'*4}  {'─'*4}  {'─'*4}  {'─'*6}")
    print(f"  {'TOTAL':<22} {total_concepts:>8}  {'':>4}  {'':>4}  {'':>4}  {total_heroes:>6}")
    print()
    print(f"  {C.BOLD}Total datasets : {len(analyses)}{C.RESET}")
    print(f"  {C.BOLD}Total concepts : {total_concepts}{C.RESET}")
    print(f"  {C.BOLD}Total hero pairs: {total_heroes}{C.RESET}")


# ── GENERATE EMBED.PY COMMAND LIST ────────────────────────────────────────────

def print_embed_commands(analyses):
    section("── READY TO EMBED ───────────────────────────────────────────")
    print()
    ready = [a for a in analyses if a["ready"]]
    not_ready = [a for a in analyses if not a["ready"]]

    if ready:
        print(f"  {C.GREEN}Run these now:{C.RESET}")
        for a in ready:
            print(f"    python embed.py --input {a['filepath']}")

    if not_ready:
        print(f"\n  {C.YELLOW}Fix coverage before embedding:{C.RESET}")
        for a in not_ready:
            missing_langs = [
                lang for lang, count in a["coverage"].items()
                if count < a["n_concepts"]
            ]
            print(f"    {a['domain']} — missing: {', '.join(missing_langs)}")


# ── EXPORT SUMMARY JSON ───────────────────────────────────────────────────────

def export_summary(analyses, output_path="domain_benchmark_summary.json"):
    summary = {
        "generated": "2026-02-28",
        "total_datasets": len(analyses),
        "total_concepts": sum(a["n_concepts"] for a in analyses),
        "total_hero_pairs": sum(len(a["hero_pairs"]) for a in analyses),
        "domains": [
            {
                "domain": a["domain"],
                "file": str(a["filepath"]),
                "n_concepts": a["n_concepts"],
                "languages": a["languages"],
                "coverage": a["coverage"],
                "n_hero_pairs": len(a["hero_pairs"]),
                "hero_pairs": a["hero_pairs"],
                "ready": a["ready"],
                "hypothesis": a["hypothesis"],
            }
            for a in analyses
        ]
    }
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)
    return output_path


# ── MAIN ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="LACUNA Multi-Domain Comparator")
    parser.add_argument("--dir",     default=".",          help="Directory to scan for datasets")
    parser.add_argument("--verbose", action="store_true",  help="Show hero pair details and hypotheses")
    parser.add_argument("--export",  action="store_true",  help="Export summary to domain_benchmark_summary.json")
    args = parser.parse_args()

    print(f"\n{C.BOLD}LACUNA MULTI-DOMAIN BENCHMARK COMPARATOR{C.RESET}")
    print(f"Scanning: {Path(args.dir).resolve()}")
    print("─" * 55)

    # Find files
    files = find_datasets(args.dir)
    if not files:
        print(f"{C.RED}No concepts*.json files found in {args.dir}{C.RESET}")
        return

    print(f"Found {len(files)} dataset(s)")

    # Load and analyse
    analyses = []
    errors   = []

    for filepath in files:
        data, err = load_dataset(filepath)
        if err:
            errors.append((filepath, err))
            fail(f"Failed to load {filepath.name}: {err}")
            continue
        analysis = analyse_dataset(data, filepath)
        analyses.append(analysis)

    # Per-dataset details
    section("── DATASET DETAILS ──────────────────────────────────────────")
    for a in analyses:
        print_dataset_summary(a, args.verbose)

    # Benchmark matrix
    print_benchmark_matrix(analyses)

    # Embed commands
    print_embed_commands(analyses)

    # Export
    if args.export:
        out = export_summary(analyses)
        section("── EXPORT ───────────────────────────────────────────────────")
        ok(f"Summary exported to {out}")

    # Final status
    ready_count = sum(1 for a in analyses if a["ready"])
    section("── SUMMARY ──────────────────────────────────────────────────")
    if ready_count == len(analyses):
        print(f"\n  {C.GREEN}{C.BOLD}✅ All {len(analyses)} datasets are ready for embed.py{C.RESET}\n")
    else:
        print(f"\n  {C.YELLOW}{C.BOLD}⚠️  {ready_count}/{len(analyses)} datasets ready. Fix coverage on remaining.{C.RESET}\n")


if __name__ == "__main__":
    main()
