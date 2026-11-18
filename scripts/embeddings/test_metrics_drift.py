"""
Drift check for the benchmark numbers.

Recomputes every metric from the committed model files with compute_metrics.py
and fails if src/data/embeddings/metrics.json, the README results tables, or
the model registry's live/stub status disagree with it.

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
    rows = []
    for m in metrics["models"]:
        name = f"{model_name(m['modelId'])} (`{m['modelId']}`)"
        lac = m["lacunaDetection"]
        base = lac["randomLabelBaseline"]
        same = lac["sameConceptsPresent"]
        knn = lac["knnFlags"]
        rows.append(
            f"| {name} | {pct(lac['averageRate'])} ({lac['detected']}/{lac['expected']}) "
            f"| {pct(base['median'])} / {pct(base['p95'])} | {base['pValue']:.3f} "
            f"| {pct(same['rate'])} ({same['detected']}/{same['expected']}) "
            f"| {knn['handLabelled']} of {knn['flagged']} |"
        )
        rows.append(
            f"| {name} | {m['clas']['average']:.3f} | {m['clas']['crossConceptAverage']:.3f} "
            f"| {m['topology']['averageR']:.3f} | {m['topology']['nullP95']:.3f} "
            f"| {m['silhouette']['average']:.3f} | {m['silhouetteNullP95']:.3f} |"
        )
    return rows


def headline_percentages(readme):
    """Percentages in the 'Key finding' paragraph of the README."""
    match = re.search(r"Key finding:(.*?)(?:\n\n|\n#)", readme, re.S)
    if not match:
        return None
    return re.findall(r"\d+\.\d%", match.group(1))


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
    for row in expected_readme_rows(fresh):
        if row not in readme:
            errors.append(f"README is missing the row: {row}")

    allowed = set()
    for m in fresh["models"]:
        lac = m["lacunaDetection"]
        base = lac["randomLabelBaseline"]
        allowed |= {pct(lac["averageRate"]), pct(base["median"]), pct(base["p95"]),
                    pct(lac["sameConceptsPresent"]["rate"])}
    found = headline_percentages(readme)
    if not found:
        errors.append("README has no 'Key finding:' paragraph with percentages")
    else:
        errors += [f"README headline has {p}, which no current metric produces" for p in found if p not in allowed]

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
