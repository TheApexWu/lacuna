"""
Drift check for the benchmark numbers.

Recomputes every metric from the committed model files with compute_metrics.py
and fails if src/data/embeddings/metrics.json, the README results tables, or
the model registry's live/stub status disagree with it. The README must lead
with the re-run results, and the old hackathon numbers may appear only in the
superseded section.

  python -m pytest scripts/embeddings/test_metrics_drift.py
  python scripts/embeddings/test_metrics_drift.py [README.md] [metrics.json]
"""

import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO = SCRIPT_DIR.parents[1]
EMB_DIR = REPO / "src" / "data" / "embeddings"
RESULTS_HEADING = "## Results, re-run 18 Nov 2026"
SUPERSEDED_HEADING = "## Hackathon results (1 Mar 2026, superseded)"
OLD_HEADLINE_RATE = "95.9%"


def pct(x):
    return f"{x * 100:.1f}%"


def recompute():
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / "metrics.json"
        subprocess.run(
            [sys.executable, str(SCRIPT_DIR / "compute_metrics.py"),
             "--models-dir", str(EMB_DIR), "--output", str(out)],
            check=True, capture_output=True,
        )
        return json.loads(out.read_text())


def model_name(model_id):
    return json.loads((EMB_DIR / f"{model_id}.json").read_text())["modelName"]


def expected_readme_rows(metrics):
    """(lacuna detection rows, other-metric rows) as the README tables print them."""
    detection, other = [], []
    for m in metrics["models"]:
        name = f"{model_name(m['modelId'])} (`{m['modelId']}`)"
        lac = m["lacunaDetection"]
        base = lac["randomLabelBaseline"]
        same = lac["sameConceptsPresent"]
        knn = lac["knnFlags"]
        detection.append(
            f"| {name} | {pct(lac['averageRate'])} ({lac['detected']}/{lac['expected']}) "
            f"| {pct(base['median'])} / {pct(base['p95'])} | {base['pValue']:.3f} "
            f"| {pct(same['rate'])} ({same['detected']}/{same['expected']}) "
            f"| {knn['handLabelled']} of {knn['flagged']} |"
        )
        other.append(
            f"| {name} | {m['clas']['average']:.3f} | {m['clas']['crossConceptAverage']:.3f} "
            f"| {m['topology']['averageR']:.3f} | {m['topology']['nullP95']:.3f} "
            f"| {m['silhouette']['average']:.3f} | {m['silhouetteNullP95']:.3f} |"
        )
    return detection, other


def section(readme, heading):
    """Text from `heading` to the next level-2 heading, or None if absent."""
    start = readme.find(heading + "\n")
    if start < 0:
        return None
    end = readme.find("\n## ", start + len(heading))
    return readme[start:] if end < 0 else readme[start:end]


def registry_status():
    src = (EMB_DIR / "models.ts").read_text()
    return dict(re.findall(r'id: "([^"]+)",.*?status: "([^"]+)"', src, re.S))


def check(readme_path=REPO / "README.md", metrics_path=EMB_DIR / "metrics.json"):
    errors = []
    fresh = recompute()
    committed = json.loads(Path(metrics_path).read_text())
    if fresh != committed:
        errors.append(f"{metrics_path} differs from a fresh compute_metrics.py run")

    readme = Path(readme_path).read_text()
    results = section(readme, RESULTS_HEADING)
    if results is None:
        errors.append(f"README has no '{RESULTS_HEADING}' section")
        results = ""
    elif readme.find("\n## ") != readme.find(RESULTS_HEADING) - 1:
        errors.append(f"'{RESULTS_HEADING}' is not the first section of the README")
    detection_rows, other_rows = expected_readme_rows(fresh)
    for row in detection_rows:
        if row not in results:
            errors.append(f"README results section is missing the row: {row}")
    for row in other_rows:
        if row not in readme:
            errors.append(f"README is missing the row: {row}")

    allowed = set()
    for m in fresh["models"]:
        lac = m["lacunaDetection"]
        base = lac["randomLabelBaseline"]
        allowed |= {pct(lac["averageRate"]), pct(base["median"]), pct(base["p95"]),
                    pct(lac["sameConceptsPresent"]["rate"])}
    errors += [
        f"README results section has {p}, which no current metric produces"
        for p in re.findall(r"\d+\.\d%", results)
        if p not in allowed
    ]

    superseded_at = readme.find(SUPERSEDED_HEADING + "\n")
    if superseded_at < 0:
        errors.append(f"README has no '{SUPERSEDED_HEADING}' section")
    elif OLD_HEADLINE_RATE in readme[:superseded_at]:
        errors.append(f"README shows the old {OLD_HEADLINE_RATE} above the superseded section")

    live_scored = {m["modelId"] for m in fresh["models"]}
    for model_id, status in registry_status().items():
        file_status = json.loads((EMB_DIR / f"{model_id}.json").read_text())["status"]
        if status != file_status:
            errors.append(f"models.ts says {model_id} is {status}; {model_id}.json says {file_status}")
        if model_id != "curated" and (file_status == "live") != (model_id in live_scored):
            errors.append(f"{model_id}: status {file_status} but scored={model_id in live_scored}")
    return errors


def test_metrics_readme_and_registry_match_committed_data():
    errors = check()
    assert not errors, "\n".join(errors)


if __name__ == "__main__":
    errs = check(*sys.argv[1:3])
    print("\n".join(errs) if errs else "OK: metrics.json, README and models.ts match the committed data")
    sys.exit(1 if errs else 0)
