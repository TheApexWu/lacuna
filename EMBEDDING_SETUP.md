# LACUNA Embedding Pipeline - Setup & Usage Guide

## Quick Start

The LACUNA embedding pipeline is now fully implemented and ready to use. Follow these steps to get started:

### 1. One-Command Setup (Recommended)

```bash
cd python
./setup.sh
```

This will:
- Install `uv` package manager
- Create virtual environment
- Install all dependencies (~3-4GB download)
- Export concepts from TypeScript
- Generate embeddings for 43 concepts
- Fit UMAP models

**Time:** ~10-15 minutes (mostly downloading models)

### 2. Configure API Key (Optional, for Interpretations)

```bash
cd python
cp .env.example .env
# Edit .env and add: ANTHROPIC_API_KEY=sk-ant-api03-...
```

Interpretations will be disabled without an API key, but embeddings, UMAP, and neighbors will still work.

### 3. Start Services

**Option A: Both services together (recommended)**
```bash
# From project root
npm run dev:all
```

**Option B: Separate terminals**
```bash
# Terminal 1: Next.js
npm run dev

# Terminal 2: Python
npm run dev:python
```

**Option C: Manual Python start**
```bash
cd python
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

## What's Implemented

### ✅ Core Pipeline

1. **BGE-M3 Embeddings**
   - 1024-dimensional multilingual embeddings
   - Sentence-transformers fallback for stability
   - ~200-500ms per embedding (after warmup)

2. **UMAP Projection**
   - Pre-fitted on 43 curated Versailles concepts
   - 2D semantic space (x, z coordinates)
   - Preserves semantic relationships

3. **Semantic Neighbors**
   - Cosine similarity search
   - Returns top-8 neighbors with similarity scores
   - Fast lookup from pre-computed embeddings

4. **LLM Interpretation**
   - Claude-powered semantic analysis
   - Explains clustering and semantic dimensions
   - Compares language-specific framings
   - Optional (requires API key)

### ✅ API Endpoints

**POST /embed**
```bash
curl -X POST http://127.0.0.1:8000/embed \
  -H "Content-Type: application/json" \
  -d '{
    "concept": "freedom",
    "language": "en",
    "definition": "The state of being free and independent"
  }'
```

**Response:**
```json
{
  "concept": "freedom",
  "language": "en",
  "embedding": [0.009, 0.018, ...],  // 1024 floats
  "position": [8.63, -3.25],
  "weight": 0.333,
  "neighbors": [
    {"id": "selfdetermination", "label": "self-determination", "similarity": 0.680},
    {"id": "sovereignty", "label": "sovereignty", "similarity": 0.637},
    ...
  ],
  "interpretation": "Freedom clusters with self-determination and sovereignty...",
  "status": "live"
}
```

**GET /health**
```bash
curl http://127.0.0.1:8000/health
```

### ✅ Next.js Integration

The `/api/embed` route in Next.js automatically calls the Python service:

```typescript
// Automatically routed to Python service
const response = await fetch('/api/embed', {
  method: 'POST',
  body: JSON.stringify({ concept, language, definition })
});
```

Error handling:
- Service offline → 503 with helpful message
- Invalid language → 400 error
- Timeout → Graceful degradation

## Architecture

```
┌─────────────────┐
│   Next.js App   │
│  (localhost:3000)│
└────────┬────────┘
         │ HTTP
         ↓
┌─────────────────┐
│ Python FastAPI  │
│  (localhost:8000)│
└────────┬────────┘
         │
    ┌────┴────┬─────────┬──────────┐
    ↓         ↓         ↓          ↓
┌────────┐ ┌──────┐ ┌────────┐ ┌─────────┐
│BGE-M3  │ │ UMAP │ │Neighbor│ │ Claude  │
│1024-dim│ │2D proj│ │ Search │ │  API    │
└────────┘ └──────┘ └────────┘ └─────────┘
```

## File Structure

```
python/
├── app/
│   ├── main.py              # FastAPI app + endpoints
│   ├── config.py            # Settings (from .env)
│   ├── models.py            # Pydantic schemas
│   ├── embeddings.py        # BGE-M3 wrapper
│   ├── umap_projection.py   # UMAP transform + weights
│   ├── neighbors.py         # Cosine similarity search
│   └── interpretation.py    # Claude API integration
├── data/
│   ├── versailles.json          # 43 curated concepts
│   ├── embeddings_en.npy        # EN embeddings (43x1024)
│   ├── embeddings_de.npy        # DE embeddings (43x1024)
│   ├── umap_model_en.pkl        # Pre-fitted UMAP
│   ├── umap_model_de.pkl        # Pre-fitted UMAP
│   ├── concept_ids_en.json      # Ordered IDs
│   └── concept_ids_de.json      # Ordered IDs
├── scripts/
│   ├── extract_embeddings.py    # Generate embeddings (run once)
│   └── fit_umap.py              # Fit UMAP models (run once)
└── setup.sh                     # One-command setup
```

## Manual Setup Steps

If you prefer step-by-step setup instead of `./setup.sh`:

### 1. Install Dependencies
```bash
cd python
uv venv
uv pip install -r requirements.txt
```

### 2. Export Concepts
```bash
cd ..
node scripts/export_concepts.js
```

### 3. Generate Embeddings
```bash
cd python
source .venv/bin/activate
python scripts/extract_embeddings.py
```

### 4. Fit UMAP
```bash
python scripts/fit_umap.py
```

### 5. Start Service
```bash
uvicorn app.main:app --reload --port 8000
```

## Testing

### Health Check
```bash
curl http://127.0.0.1:8000/health
# {"status":"healthy","models_loaded":true,"languages_available":["en","de"]}
```

### Test Embedding
```bash
curl -X POST http://127.0.0.1:8000/embed \
  -H "Content-Type: application/json" \
  -d '{
    "concept": "Schuld",
    "language": "de",
    "definition": "Der Zustand, ein Unrecht oder Vergehen gegen andere begangen zu haben"
  }'
```

### Test via Next.js
```bash
# Start both services
npm run dev:all

# In browser console:
fetch('/api/embed', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    concept: 'freedom',
    language: 'en',
    definition: 'The state of being free'
  })
}).then(r => r.json()).then(console.log)
```

## Performance Metrics

| Metric | Value |
|--------|-------|
| First request (cold start) | ~5-8s (model loading) |
| Subsequent requests | <1s |
| Memory usage | ~2GB (BGE-M3) |
| Concurrent requests | 10+ supported |
| Model download size | ~3-4GB |

## Troubleshooting

### Service won't start

**Issue:** `ModuleNotFoundError`
```bash
source .venv/bin/activate  # Must activate venv first
```

**Issue:** `FileNotFoundError: umap_model_en.pkl`
```bash
# Run setup scripts in order:
node scripts/export_concepts.js
python scripts/extract_embeddings.py
python scripts/fit_umap.py
```

### Embeddings fail

**Issue:** PyTorch version error
```bash
# Already fixed in requirements.txt (torch>=2.6.0)
uv pip install 'torch>=2.6.0'
```

**Issue:** FlagEmbedding import error
- Automatically falls back to sentence-transformers
- Check logs for warnings

### No interpretations

**Issue:** `interpretation: null` in response
```bash
# Add API key to python/.env
ANTHROPIC_API_KEY=sk-ant-api03-...
```

Service still works without interpretations.

### First request timeout

**Expected:** First request takes ~5s (BGE-M3 warmup)
- Next.js has 30s timeout to accommodate this
- Subsequent requests are fast (<1s)

## Configuration

All settings in `python/app/config.py` can be overridden via `.env`:

```bash
# Required for interpretations
ANTHROPIC_API_KEY=sk-ant-api03-...

# Model selection
BGE_MODEL_NAME=BAAI/bge-m3
LLM_MODEL=claude-3-5-sonnet-20241022

# UMAP parameters
UMAP_N_NEIGHBORS=15
UMAP_MIN_DIST=0.1
UMAP_METRIC=cosine

# Search settings
N_NEIGHBORS=8
```

## Next Steps

1. **Add UI for concept input**
   - Create form in Next.js
   - Display embedding results on terrain
   - Show neighbors and interpretation

2. **Batch embedding support**
   - Add `/embed/batch` endpoint
   - Process multiple concepts at once

3. **Cache embeddings**
   - Store user-generated embeddings
   - Avoid re-computing identical concepts

4. **Visualization**
   - Plot UMAP positions in 3D terrain
   - Color by clusters
   - Show semantic neighborhoods

## NPM Scripts

```bash
# Development
npm run dev              # Next.js only
npm run dev:python       # Python only
npm run dev:all          # Both services

# Python setup
npm run python:setup     # Install dependencies
npm run python:export    # Export concepts from TS
npm run python:extract   # Generate embeddings
npm run python:fit       # Fit UMAP models
```

## Documentation

- Python service: `python/README.md`
- Main project: `README.md`
- This guide: `EMBEDDING_SETUP.md`

## Support

For issues:
- Check `python/README.md` troubleshooting section
- Verify all setup scripts ran successfully
- Check service logs for errors
- Ensure both services are running

---

**Status:** ✅ Fully implemented and tested
**Version:** 1.0.0
**Last updated:** 2025-02-28
