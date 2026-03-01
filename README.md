# LACUNA

Conceptual Topology Mapper — a 3D visualization of how the Treaty of Versailles was perceived differently across languages and how embedding models capture (or erase) those differences.

Built with Next.js 16, React 19, Three.js, and React Three Fiber.

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Use the bottom bar to switch languages, toggle lacunae, and select embedding models.

## Project Structure

```
src/
  app/
    page.tsx                         # Main page, all state management
    api/
      concept/[id]/route.ts          # Concept detail API
      embed/route.ts                 # Embedding endpoint (scaffold)
  components/
    TopologyTerrain.tsx              # 3D terrain (React Three Fiber)
    ButterflyChart.tsx               # Diverging bar chart (two-language comparison)
    ConceptNetworkGraph.tsx          # Node-edge concept graph
    ConceptCard.tsx                  # Concept detail overlay
    ModelSelector.tsx                # Embedding model dropdown
    ModelMetricsPanel.tsx            # CLAS / Mantel / Silhouette / Ghost metrics
    ModelAgreementHeatmap.tsx        # 43x43 model-vs-model agreement grid
    ConnectionCard.tsx               # Per-concept cross-model distance comparison
  data/
    versailles.ts                    # 43 concepts, 10 languages, curated positions/weights
    embeddings/
      models.ts                      # Model registry (curated + 6 embedding models)
      index.ts                       # Types + dynamic loaders
      *.json                         # Pre-computed embedding data per model
      metrics.json                   # Benchmark metrics for all models
  hooks/
    useModelData.ts                  # Multiplexer: curated vs embedding-derived data

scripts/
  embeddings/
    generate_stubs.ts                # Generate synthetic data for all models
    extract_concepts.ts              # Export versailles.ts -> JSON for pipeline
    embed_api.ts                     # Mistral + Cohere API embeddings
    embed_local.py                   # BGE-M3, E5, SONAR, NV-Embed-v2 local inference
    project_umap.py                  # UMAP projection + Procrustes alignment
    compute_metrics.py               # CLAS, Mantel, Silhouette, Ghost Detection
  requirements.txt                   # Python dependencies
```

## Embedding Benchmark Pipeline

LACUNA benchmarks 6 embedding models against the same 43 Treaty of Versailles concepts across 10 languages. The pipeline produces 2D terrain positions from high-dimensional embeddings and computes four metrics per model.

### Models

| Model | Dim | Provider | Notes |
|-------|-----|----------|-------|
| BGE-M3 | 1024 | Local | Dense+sparse+ColBERT, 100+ languages |
| multilingual-e5-large | 1024 | Local | Microsoft, contrastive multilingual |
| Mistral Embed | 1024 | API | Mistral AI endpoint |
| Cohere embed-v3 | 1024 | API | Cohere embed-multilingual-v3.0 |
| SONAR (Meta) | 1024 | Local | 200+ languages, sentence-level |
| NV-Embed-v2 | 4096 | Local | NVIDIA, decoder architecture |

### Metrics

- **CLAS** (Cross-Lingual Alignment Score) — avg cosine similarity between EN and other languages for the same concept. High = model collapses cross-lingual differences.
- **Topology Preservation** (Mantel test) — correlation between EN and other-language distance matrices. High = same conceptual structure in both languages.
- **Cluster Coherence** (Silhouette score) — do the 6 concept clusters hold together per language?
- **Ghost Detection Rate** — are ghost concepts (lacunae) orphaned in foreign languages?

### Setup

#### 1. Generate stub data (no API keys needed)

The UI works immediately with synthetic stub data:

```bash
npx tsx scripts/embeddings/generate_stubs.ts
```

This produces `src/data/embeddings/*.json` with deterministically jittered positions for all 6 models.

#### 2. Set up API keys

```bash
cp .env.example .env
```

Edit `.env` and add your keys:

```
MISTRAL_API_KEY=your_key
COHERE_API_KEY=your_key
```

#### 3. Install Python dependencies

```bash
pip install -r scripts/requirements.txt
```

#### 4. Extract concept data

```bash
npx tsx scripts/embeddings/extract_concepts.ts
```

Produces `scripts/embeddings/concepts_input.json` — the shared input for all embedding scripts.

#### 5. Generate real embeddings

**API models** (Mistral, Cohere):

```bash
npx tsx scripts/embeddings/embed_api.ts --model mistral-embed
npx tsx scripts/embeddings/embed_api.ts --model cohere-v3
```

**Local models** (requires torch + sentence-transformers):

```bash
python scripts/embeddings/embed_local.py --model bge-m3
python scripts/embeddings/embed_local.py --model e5-large
python scripts/embeddings/embed_local.py --model sonar
python scripts/embeddings/embed_local.py --model nv-embed-v2
```

#### 6. Project embeddings to 2D terrain

For each model with raw embeddings:

```bash
python scripts/embeddings/project_umap.py \
  --input scripts/embeddings/bge-m3-raw.json \
  --output src/data/embeddings/bge-m3.json
```

This runs UMAP dimensionality reduction, Procrustes-aligns to English, scales to terrain coordinates, and computes pairwise cosine distance matrices.

#### 7. Compute benchmark metrics

```bash
python scripts/embeddings/compute_metrics.py \
  --models-dir src/data/embeddings/ \
  --output src/data/embeddings/metrics.json
```

### Full pipeline (one-liner per model)

```bash
# Mistral (API)
npx tsx scripts/embeddings/embed_api.ts --model mistral-embed && \
python scripts/embeddings/project_umap.py \
  --input scripts/embeddings/mistral-embed-raw.json \
  --output src/data/embeddings/mistral-embed.json

# BGE-M3 (local)
python scripts/embeddings/embed_local.py --model bge-m3 && \
python scripts/embeddings/project_umap.py \
  --input scripts/embeddings/bge-m3-raw.json \
  --output src/data/embeddings/bge-m3.json

# Recompute metrics after any model update
python scripts/embeddings/compute_metrics.py \
  --models-dir src/data/embeddings/ \
  --output src/data/embeddings/metrics.json
```

## UI Controls

| Button | Function |
|--------|----------|
| Language bar (EN, DE, FR, ...) | Switch terrain to that language's topology |
| REVEAL LACUNAE | Show ghost concepts (absent from current language) |
| DIVERGENCE | Butterfly chart comparing two languages' concept weights |
| NETWORK | Node-edge graph of concept proximity |
| METRICS | Benchmark metrics panel (CLAS, Mantel, Silhouette, Ghost) |
| AGREEMENT | 43x43 heatmap comparing two models' distance matrices |
| CONNECT | Per-concept cross-model distance comparison |
| MODEL dropdown | Switch terrain data source between curated and embedding models |
