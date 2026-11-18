# LACUNA

A cross-lingual bias auditing instrument. LACUNA looks for concepts that exist in one language but structurally disappear in another by measuring divergence across multilingual embedding models.

Built for the Mistral AI NYC Hackathon (Feb 28 - Mar 1, 2026) by Team L'ECART.

## What It Does

LACUNA embeds 43 Treaty of Versailles concepts across 10 languages, projects them onto a 3D terrain, and lets you probe the topology with live text queries. When you fire a probe, the terrain shifts to the target language and highlights which concepts activate differently -- surfacing the gaps between how languages encode meaning. Three embedding models (mistral-embed, BGE-M3, Cohere embed-v3) have real embeddings behind their terrain views; the other three in the model menu are placeholders (see [Benchmark Results](#benchmark-results)).

Key finding: against the team's 71 hand labels, BGE-M3 places labelled lacunae far from their cluster 80.3% of the time, against 62.0% for random labels (95th percentile 70.5%). Cohere embed-v3 scores 71.8% (random 60.6%, p95 70.4%) and mistral-embed 59.2% (random 54.9%, p95 63.4%), which is inside the random range. In the languages where those concepts are marked present, the same test flags them about as often for mistral-embed (57.9%) and more often for Cohere (89.5%). BGE-M3 flags them less often there (63.2%), but that gap rests on 19 cells. So the test mostly picks out a few peripheral concepts rather than showing which languages lack them.

Correction (November 2026): earlier versions of this README reported "mistral-embed detects 95.9% of known lacunae" and a six-model results table. Those numbers came from placeholder data. All six model files in `src/data/embeddings/` were byte-identical to the output of `generate_stubs.ts`, which jitters the curated layout and draws lacuna flags at a fixed 80% agreement rate, and `metrics.json` was that script's output too. `compute_metrics.py` also scored each model against its own k-NN flags, which is circular. It now scores against the hand labels only, and the numbers below come from running the benchmark pipeline on the committed raw embeddings.

## Quick Start

```bash
npm install
cp .env.example .env.local   # Add MISTRAL_API_KEY for live probes
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## How It Works

1. **Terrain** -- 43 concepts rendered as a 3D landscape. Position = semantic proximity. Height = conceptual weight. Color = cluster membership.
2. **Language switching** -- Toggle between EN, DE, ZH, JA, AR, KO. The terrain reshapes to show how each language organizes the same concepts.
3. **Live probes** -- Type any sentence or click a pre-loaded historical example (Article 231, Nanking Treaty, Potsdam, Sykes-Picot, 38th Parallel). LACUNA embeds your text via mistral-embed, computes cosine similarity against all 43 concepts in both languages (86 dot products), and ranks by divergence.
4. **Interpreter agent** -- Click any concept to get a Mistral-large-powered analysis of why it diverges across languages.
5. **Lacuna reveal** -- Toggle to show ghost concepts: ideas that exist in one language but are structurally absent in another.

## Architecture

```
User types sentence
       |
  /api/query (1 mistral-embed call, 1024-dim)
       |
  cosine similarity vs 43 pre-computed concept vectors (lang_a + lang_b)
       |
  ranked activations + divergence scores
       |
  terrain highlights top concepts (amber glow)
  results panel shows EN sim | lang_b sim | divergence
       |
  click concept -> /api/interpret (mistral-large agent)
       |
  natural language explanation of the divergence
```

## Project Structure

```
src/
  app/
    page.tsx                          # Main page, all state + probe UI
    api/
      query/route.ts                  # Live probe: mistral-embed + cosine sim
      interpret/route.ts              # Interpreter: mistral-large agent
      concept/[id]/route.ts           # Concept detail API
      embed/route.ts                  # Embedding endpoint scaffold
  components/
    TopologyTerrain.tsx               # 3D terrain (React Three Fiber)
    ButterflyChart.tsx                # Diverging bar chart (two-language comparison)
    ConceptNetworkGraph.tsx           # Node-edge concept graph
    ConceptCard.tsx                   # Concept detail overlay
    ModelSelector.tsx                 # Embedding model dropdown
    ModelMetricsPanel.tsx             # CLAS / Mantel / Silhouette / Lacuna metrics
    ModelAgreementHeatmap.tsx         # Model-vs-model agreement grid
    ConnectionCard.tsx                # Per-concept cross-model distance comparison
  data/
    versailles.ts                     # 43 concepts, 10 languages, curated positions
    concept-embeddings.json           # Pre-computed mistral-embed vectors for live queries
    embeddings/
      models.ts                       # Model registry (curated + 6 embedding models, live/stub status)
      index.ts                        # Types + dynamic loaders
      *.json                          # Terrain data per model (status "live" or "stub")
      metrics.json                    # Benchmark metrics for the 3 live models

scripts/
  embeddings/
    embed_api.ts                      # Mistral + Cohere API embeddings
    embed_local.py                    # BGE-M3, E5, SONAR, NV-Embed-v2 local inference
    *-raw.json                        # Raw vectors: mistral-embed, BGE-M3, Cohere embed-v3
    project_umap.py                   # UMAP projection + Procrustes alignment + HDBSCAN
    compute_metrics.py                # CLAS, Mantel, Silhouette, Lacuna Detection + controls
    test_metrics_drift.py             # Fails if metrics.json or this README drift from the data
    extract_concepts.ts               # Export versailles.ts -> JSON for pipeline
    generate_stubs.ts                 # Synthetic placeholder data (source of the "stub" views)
  requirements.txt                    # Python dependencies
```

## Benchmark Results

The embedding benchmark (embedding scripts, UMAP projection, clustering, metrics and the model-comparison views) was built by Sunny Son during the hackathon. The numbers here come from re-running that pipeline in November 2026 on the raw vectors committed in `scripts/embeddings/*-raw.json`.

**Which model views are real.** mistral-embed, BGE-M3 and Cohere embed-v3 have committed raw embeddings and were projected with `project_umap.py` (`"status": "live"`). multilingual-e5-large, SONAR and NV-Embed-v2 have no committed embeddings. Their terrain views are placeholders from `generate_stubs.ts` (`"status": "stub"`, marked ◌ in the model menu) and they are not scored. The curated view is the hand-placed layout in `src/data/versailles.ts`, not a model.

**Labels.** Ground truth is the 71 concept-by-language cells marked as lacunae in `scripts/embeddings/concepts_input.json` (exported from `src/data/versailles.ts`). They cover 9 of the 43 concepts. Six German concepts (Kriegsschuld, Dolchstoß, Diktat, Schmach, Volkszorn, Revanchismus) are marked absent in the other 9 languages. Three English concepts (magnanimity, civilizing mission, mandate) are marked absent in 5 to 7 languages each. The team wrote these labels during the hackathon and nobody else annotated or reviewed them, so treat them as a small, self-authored test set.

**The scored test.** A labelled cell counts as detected when the concept's 2D UMAP position in that language is more than 15 terrain units from the centroid of the other concepts in its HDBSCAN cluster for that language. Positions are scaled to within ±29.75 units. HDBSCAN marks most concepts as noise here (17 to 43 of 43 per language), so in practice the test mostly measures distance from the middle of the map. The rate is detected cells over all 71 labelled cells.

**Controls.** *Random labels*: in each language, label the same number of concepts at random and rerun the test (200 draws, seed 0). The table shows the median and 95th percentile and the one-sided permutation p, where 0.005 is the floor at 200 draws. *Same concepts where present*: the same test on the 19 cells where those 9 concepts are marked present (for example, Dolchstoß in German). A test that detects absence should flag these less often than the labelled cells. *k-NN flags*: the density-ratio flags that `project_umap.py` writes, which the app's lacuna overlay shows for these models. The column gives how many of them land on labelled cells (the labels are 16.5% of the 430 cells).

Lacuna detection, UMAP seed 42 (the pipeline default):

| Model | Detected (hand labels) | Random labels, median / p95 | p | Same concepts where present | k-NN flags on labelled cells |
|-------|------------------------|-----------------------------|---|-----------------------------|------------------------------|
| BGE-M3 (`bge-m3`) | 80.3% (57/71) | 62.0% / 70.5% | 0.005 | 63.2% (12/19) | 0 of 7 |
| Cohere embed-v3 (`cohere-v3`) | 71.8% (51/71) | 60.6% / 70.4% | 0.050 | 89.5% (17/19) | 0 of 9 |
| Mistral Embed (`mistral-embed`) | 59.2% (42/71) | 54.9% / 63.4% | 0.239 | 57.9% (11/19) | 6 of 15 |

UMAP is stochastic. Across seeds 0 to 9 (`project_umap.py --seed N`), detection ranged from 73.2% to 83.1% for BGE-M3, 70.4% to 80.3% for Cohere embed-v3 and 57.8% to 71.8% for mistral-embed. It beat the random-label p95 in 10, 10 and 3 of the 10 seeds. These seed runs need umap-learn and hdbscan, so the drift test does not re-check them.

Other metrics, seed 42, each with a control:

| Model | CLAS | CLAS, different concepts | Topology (Mantel r) | Permutation p95 | Silhouette | Shuffled-label p95 |
|-------|------|--------------------------|---------------------|-----------------|------------|--------------------|
| BGE-M3 (`bge-m3`) | 0.857 | 0.525 | 0.743 | 0.048 | -0.016 | -0.046 |
| Cohere embed-v3 (`cohere-v3`) | 0.789 | 0.507 | 0.726 | 0.043 | -0.001 | -0.045 |
| Mistral Embed (`mistral-embed`) | 0.843 | 0.701 | 0.650 | 0.036 | -0.042 | -0.081 |

**CLAS**: mean cosine similarity between a concept's EN embedding and its embedding in each other language. The control is the same mean over different concepts (EN concept i against concept j in the other language). mistral-embed's CLAS is high mostly because any two of its vectors are similar. **Topology**: Pearson r between the EN and other-language cosine distance matrices, averaged over 9 pairs. The control is the 95th percentile with concept labels permuted (200 draws). **Silhouette**: silhouette of the HDBSCAN labels in the 2D layout, averaged over 10 languages (a language with no clusters scores 0). The control shuffles the labels. All three models score near zero: the clusters do not separate in the 2D layout.

Reproduce (Python 3 with numpy, scipy and scikit-learn; `project_umap.py` also needs umap-learn and hdbscan):

```bash
cd scripts/embeddings
python project_umap.py --input mistral-embed-raw.json --output ../../src/data/embeddings/mistral-embed.json  # also bge-m3, cohere-v3
python compute_metrics.py --models-dir ../../src/data/embeddings/ --output ../../src/data/embeddings/metrics.json
python -m pytest test_metrics_drift.py
```

The committed live files were produced with umap-learn 0.6.0, hdbscan 0.8.44, numba 0.68.1 and numpy 2.5.5. Other versions can move the UMAP layout.

## Validation Methodology

1. Embed `"{label}: {definition}"` for each concept in 10 languages (`embed_api.ts` for mistral-embed and Cohere, `embed_local.py` for local models). Only the mistral-embed, BGE-M3 and Cohere vectors are committed.
2. UMAP to 2D per language (cosine, 10 neighbours, min_dist 0.3, seed 42), Procrustes-aligned to the English layout.
3. HDBSCAN per language on the full vectors (cosine, min cluster size 3).
4. k-NN density flags per language: a concept is flagged if its mean 5-NN distance is more than 2x its English value, or if its English distance is below the English median while its distance in that language is above that language's 75th percentile. These flags drive the app's lacuna overlay. They are not used as ground truth.
5. Score each live model against the hand labels with `compute_metrics.py`, with the controls above. `test_metrics_drift.py` recomputes everything from the committed files and fails if `metrics.json`, the tables above or the live/stub registry in `models.ts` disagree.

## Pre-loaded Probes

| Probe | Languages | What It Shows |
|-------|-----------|---------------|
| Article 231 | EN vs DE | War guilt clause -- German concepts activate that English misses |
| Nanking Treaty | EN vs ZH | Unequal treaty framing diverges across languages |
| Potsdam Declaration | EN vs JA | Surrender terms carry different weight in Japanese |
| Sykes-Picot Agreement | EN vs AR | Colonial partition concepts lean heavily toward Arabic |
| 38th Parallel | EN vs KO | Division concepts resonate differently in Korean |

## Tech Stack

- Next.js 16, React 19, TypeScript
- Three.js + React Three Fiber + Drei (3D terrain)
- Mistral AI: mistral-embed (probes), mistral-large (interpreter agent)
- Leva (debug controls, hidden in production)
- Tailwind CSS

## Team L'ECART

Built at the Mistral AI NYC Hackathon, February 28 - March 1, 2026. Sunny Son built the embedding benchmark pipeline and the model-comparison views. Alex Wu built the Next.js app, the API routes (query, interpret, orchestrate) and the `python/` backend.
