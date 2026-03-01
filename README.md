# LACUNA

A cross-lingual bias auditing instrument. LACUNA detects concepts that exist in one language but structurally disappear in another by measuring divergence across multilingual embedding models.

Built for the Mistral AI NYC Hackathon (Feb 28 - Mar 1, 2025) by Team L'ECART.

## What It Does

LACUNA embeds 43 Treaty of Versailles concepts across 10 languages using 6 embedding models from 5 companies, projects them onto a 3D terrain, and lets you probe the topology with live text queries. When you fire a probe, the terrain shifts to the target language and highlights which concepts activate differently -- surfacing the gaps between how languages encode meaning.

Key finding: **mistral-embed detects 95.9% of known lacunae**, the highest of all 6 models tested.

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
      models.ts                       # Model registry (curated + 6 embedding models)
      index.ts                        # Types + dynamic loaders
      *.json                          # Pre-computed embedding data per model
      metrics.json                    # Benchmark metrics for all models

scripts/
  embeddings/
    embed_api.ts                      # Mistral + Cohere API embeddings
    embed_local.py                    # BGE-M3, E5, SONAR, NV-Embed-v2 local inference
    project_umap.py                   # UMAP projection + Procrustes alignment
    compute_metrics.py                # CLAS, Mantel, Silhouette, Lacuna Detection
    extract_concepts.ts               # Export versailles.ts -> JSON for pipeline
    generate_stubs.ts                 # Generate synthetic data (no API keys needed)
  requirements.txt                    # Python dependencies
```

## Benchmark Results

6 embedding models tested against 43 Treaty of Versailles concepts across 10 languages:

| Model | CLAS | Topology | Silhouette | Lacuna Detection |
|-------|------|----------|------------|------------------|
| **mistral-embed** | 0.839 | 0.441 | 0.157 | **95.9%** |
| Cohere embed-v3 | 0.856 | 0.492 | 0.190 | 93.6% |
| NV-Embed-v2 | 0.842 | 0.427 | 0.114 | 92.1% |
| BGE-M3 | 0.852 | 0.433 | 0.178 | 92.0% |
| SONAR | 0.830 | 0.373 | 0.099 | 88.6% |
| e5-mistral | 0.827 | 0.441 | 0.140 | 84.5% |

**CLAS**: Cross-Lingual Alignment Score (avg cosine similarity EN vs target language). **Topology**: Mantel test correlation of pairwise distance matrices. **Silhouette**: Cluster coherence per language. **Lacuna Detection**: % of ground-truth lacunae identified as orphaned from their cluster.

## Validation Methodology

1. Embed each concept definition in 10 languages using each model
2. UMAP projection to 2D, Procrustes-aligned to English reference frame
3. HDBSCAN clustering per language
4. Lacuna detection via k-NN density ratio: if a concept's neighbor distance in language X exceeds 2x its distance in English, it is flagged as structurally absent
5. Ground truth: 6 German-only lacunae (Kriegsschuld, Dolchstoss, Diktat, Schmach, Volkszorn, Revanchism), 3 English-only lacunae (Magnanimity, Civilizing Mission, Mandate)
6. Cross-model validation: all 6 architectures detect the same lacuna patterns

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

Built at the Mistral AI NYC Hackathon, February 28 - March 1, 2025.
