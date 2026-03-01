# LACUNA Embedding Pipeline

Extracts conceptual frames from historical documents, embeds them with BGE-M3, validates for structural differences across languages, and outputs positioned concepts for 3D visualization.

## Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        INPUT DOCUMENT                           │
│  "Germany accepts responsibility for causing all the loss..."   │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STAGE 1: EXTRACTOR AGENT (Mistral Large)                       │
│                                                                 │
│  Decomposes concepts into constituent FRAMES.                   │
│  Not keywords. Frames.                                          │
│                                                                 │
│  "Reparations" becomes:                                         │
│    → reparations-as-justice (moral obligation)                  │
│    → reparations-as-debt (financial burden)                     │
│    → reparations-as-punishment (punitive measure)               │
│    → reparations-as-humiliation (national shame)                │
│                                                                 │
│  Runs once per language pair.                                   │
│                                                                 │
│  Output: ExtractedFrame[]                                       │
│    - id, labels (native terms), definitions                     │
│    - cluster, source_quote, confidence                          │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STAGE 2: BGE-M3 EMBEDDINGS (Local)                             │
│                                                                 │
│  Each frame gets embedded across all target languages.          │
│  Produces 1024-dim vectors in shared multilingual space.        │
│                                                                 │
│  "national disgrace" (EN) → [-0.0433, 0.0377, ..., -0.0173]    │
│  "nationale Schmach" (DE) → [-0.0294, 0.0452, ..., -0.0282]    │
│                                                                 │
│  Same semantic space enables cross-language comparison.         │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STAGE 3: VALIDATOR (Mistral Large + Math)                      │
│                                                                 │
│  LLM validates:                                                 │
│    - Semantic coherence of frame decomposition                  │
│    - Cross-language definition quality                          │
│    - Distinctiveness from other frames                          │
│                                                                 │
│  Math validates:                                                │
│    - Duplicates: cosine similarity > 0.85 within language       │
│    - Boring: cross-language similarity > 0.92 (no difference!)  │
│    - Outliers: doesn't fit semantic space                       │
│    - Low confidence: extraction confidence < 0.5                │
│                                                                 │
│  THE LLM VALIDATES QUALITY. MATH DECIDES POSITIONS.             │
│                                                                 │
│  Output: ValidatedFrame[]                                       │
│    - Same fields + embeddings per language                      │
│    - validation_scores: {confidence, extremity, cross_lang_sim} │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STAGE 4: TOPOLOGY COMPUTATION                                  │
│                                                                 │
│  Cosine distances → UMAP projection → 2D positions per language │
│                                                                 │
│  EN embedding [1024 dims] → UMAP → position [16.93, -1.23]     │
│  DE embedding [1024 dims] → UMAP → position [3.04, -21.85]     │
│                                                                 │
│  Same concept, different positions = different cultural framing │
│                                                                 │
│  Also computes:                                                 │
│    - Weight: semantic importance (L2 norm normalized)           │
│    - Ghost status: present in one language, absent in another   │
│    - Cluster assignment                                         │
│                                                                 │
│  Deterministic. Reproducible.                                   │
│                                                                 │
│  Output: Concept[] (frontend-ready)                             │
│    - id, labels, definitions                                    │
│    - position: {en: [x,z], de: [x,z]}                          │
│    - weight: {en: 0-1, de: 0-1}                                │
│    - ghost: {en: bool, de: bool}                               │
│    - source: "embedding"                                        │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Setup

```bash
cd python

# Create virtual environment
python -m venv .venv
source .venv/bin/activate

# Install dependencies (use uv for speed)
uv pip install -r requirements.txt

# Pre-download BGE-M3 model (2GB+, do this on good WiFi)
python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('BAAI/bge-m3')"
```

### 2. Configure API Keys

```bash
cp .env.example .env
# Edit .env and add:
#   MISTRAL_API_KEY=your-key-here
#   HF_TOKEN=your-huggingface-token (optional, faster downloads)
```

### 3. Run the Pipeline

**Full pipeline (document → concepts):**
```bash
python pipeline.py document.txt -o concepts.json
```

**With specific languages:**
```bash
python pipeline.py document.txt -o concepts.json -l en de fr
```

**Append to existing concepts:**
```bash
python pipeline.py new_document.txt --append-to data/versailles.json
```

**Validate existing concepts (no extraction):**
```bash
python embed.py --validate-only
```

## Example Run

### Input
```
Article 231 of the Treaty of Versailles

Germany accepts the responsibility for causing all the loss and damage...
This established the "War Guilt Clause" (Kriegsschuldklausel)...
Germans viewed this as a profound Schmach - a national disgrace.
```

### Output
```
[pipeline] Processing document.txt (1223 chars)
[pipeline] Step 1: Extracting frames with Mistral...
[pipeline] Extracted 19 frames
[pipeline] Step 2: Validating frames...
[validator] war-guilt-as-responsibility: cross-lang similarity 0.911 (OK)
[validator] war-guilt-as-blame: cross-lang similarity 0.850 (OK)
[validator] REJECT new-world-order-as-naivety: too similar across languages (0.953)
[validator] Validation complete: 18 valid, 1 rejected
[pipeline] Step 3: Computing positions and weights...
[pipeline] Generated 18 concepts
[pipeline] Written 18 concepts to concepts.json
```

### Decomposed Output
```json
[
  {
    "id": "war-guilt-as-responsibility",
    "labels": {"en": "responsibility", "de": "Verantwortung"},
    "cluster": "core"
  },
  {
    "id": "war-guilt-as-blame",
    "labels": {"en": "blame", "de": "Schuldzuweisung"},
    "cluster": "justice"
  },
  {
    "id": "war-guilt-as-national-disgrace",
    "labels": {"en": "national disgrace", "de": "Schmach"},
    "cluster": "humiliation"
  },
  {
    "id": "reparations-as-enslavement",
    "labels": {"en": "enslavement", "de": "Versklavung"},
    "cluster": "humiliation"
  }
]
```

## CLI Reference

### pipeline.py - Full Extraction Pipeline

```bash
python pipeline.py <input_file> [options]

Arguments:
  input_file          Raw document text file

Options:
  -o, --output        Output JSON file path
  -a, --append-to     Append to existing concepts JSON
  -l, --languages     Target languages (default: en de)
  -m, --max           Maximum concepts to extract (default: 20)
  -r, --reference     Reference concepts for validation
```

### embed.py - Embedding & Validation Only

```bash
python embed.py [options]

Options:
  -i, --input         Input concepts JSON (default: data/versailles.json)
  -o, --output        Output JSON file
  -v, --validate-only Just show distance matrices, no output
  -l, --languages     Languages to process (default: en de)
  --top-n             Neighbors to show in distance matrix (default: 5)
```

### api.py - REST API Server

```bash
uvicorn api:app --reload --port 8000

# Endpoints:
#   POST /pipeline    Full extraction pipeline
#   POST /extract     Extract frames only (Mistral)
#   POST /validate    Validate frames only (BGE-M3)
#   POST /embed       UMAP projection only
#   GET  /health      Health check
```

## Data Flow Example

### Stage 1: Extractor Output
```json
{
  "id": "war-guilt-as-national-disgrace",
  "labels": {"en": "national disgrace", "de": "Schmach"},
  "definitions": {
    "en": "A profound humiliation imposed on the nation",
    "de": "Eine tiefe Demütigung der Nation"
  },
  "cluster": "humiliation",
  "source_quote": "Germans viewed this as a profound Schmach",
  "confidence": 0.92
}
```

### Stage 2: After Embedding
```json
{
  "id": "war-guilt-as-national-disgrace",
  "embeddings": {
    "en": [-0.0433, 0.0377, ..., -0.0173],
    "de": [-0.0294, 0.0452, ..., -0.0282]
  },
  "validation_scores": {
    "confidence": 0.92,
    "extremity": 1.0
  }
}
```

### Stage 3: Validation Log
```
[validator] war-guilt-as-national-disgrace: cross-lang similarity 0.867 (OK)
```

### Stage 4: Final Concept
```json
{
  "id": "war-guilt-as-national-disgrace",
  "labels": {"en": "national disgrace", "de": "Schmach"},
  "definitions": {...},
  "cluster": "humiliation",
  "position": {
    "en": [16.69, -2.03],
    "de": [4.23, -21.25]
  },
  "weight": {"en": 0.5, "de": 0.5},
  "ghost": {"en": false, "de": false},
  "source": "embedding"
}
```

## Configuration

### Environment Variables (.env)

| Variable | Description | Default |
|----------|-------------|---------|
| `MISTRAL_API_KEY` | Mistral API key for extraction | Required |
| `HF_TOKEN` | HuggingFace token for model downloads | Optional |
| `MISTRAL_MODEL` | Mistral model to use | `mistral-large-latest` |
| `PRELOAD_MODEL` | Preload BGE-M3 on API startup | `false` |

### Validation Thresholds

Edit in `agents/validator.py`:

| Threshold | Description | Default |
|-----------|-------------|---------|
| `DUPLICATE_THRESHOLD` | Cosine sim for duplicates | 0.85 |
| `CROSS_LANG_SIMILARITY_MAX` | Max cross-lang sim (higher = boring) | 0.92 |
| `UNIFORMITY_MIN` | Min uniformity score | 0.30 |
| `CONFIDENCE_MIN` | Min extraction confidence | 0.50 |

## Project Structure

```
python/
├── pipeline.py          # Full pipeline: doc → concepts
├── embed.py             # Embedding & validation CLI
├── api.py               # FastAPI REST server
├── visualize.py         # 2D matplotlib visualization
├── agents/
│   ├── extractor.py     # Mistral frame decomposition
│   ├── validator.py     # Mistral + BGE-M3 validation
│   └── interpreter.py   # Mistral lacuna explanations
├── lib/
│   ├── embeddings.py    # BGE-M3 wrapper
│   └── schemas.py       # Pydantic models
├── data/
│   └── versailles.json  # Curated concepts
├── examples/            # Example documents and outputs
├── requirements.txt
├── .env.example
└── README.md
```

## Key Design Decisions

### 1. Frame Decomposition, Not Keyword Extraction

The extractor doesn't just find "Reparations" - it decomposes it into the conceptual frames that give it meaning:

```
"Reparations" → [
  reparations-as-justice,      # moral claim
  reparations-as-debt,         # financial obligation
  reparations-as-punishment,   # punitive measure
  reparations-as-humiliation   # national shame
]
```

This reveals how the same word operates differently across cultures.

### 2. LLM Validates Quality, Math Decides Position

The extractor LLM extracts frames. The validator LLM checks semantic quality. Math decides positions.

Cosine distances and UMAP projections are **deterministic and reproducible**.

### 3. Interpreter Agent for Concept Cards

When you click a node in the 3D visualization, the Interpreter Agent explains WHY the lacuna exists:

```bash
python agents/interpreter.py data/versailles.json dolchstoss
```

Output:
```json
{
  "cultural": "The Dolchstoßlegende emerged from German military circles...",
  "historical": "The myth crystallized in November 1919 when Hindenburg...",
  "structural": "German 'Dolchstoß' carries connotations of treachery...",
  "citations": ["Hindenburg's testimony to the Reichstag, Nov 1919", ...],
  "summary": "A uniquely German myth explaining defeat without military loss"
}
```

The interpreter provides:
- **Cultural explanation**: How context shapes different framings
- **Historical explanation**: What events created the divergence
- **Structural explanation**: How language itself shapes meaning
- **Citations**: Specific sources illuminating the gap

### 4. Cross-Language Difference Detection

Concepts that embed too similarly across languages (>92% cosine similarity) are **rejected**:

```
[validator] REJECT generic-concept: too similar across languages (0.953)
```

If EN and DE embeddings are nearly identical, there's no structural difference worth visualizing.

### 5. Ghost Detection

A concept can be a "ghost" in one language - semantically marginal or absent:

- German "Dolchstoß" has no real English equivalent
- English "magnanimity" barely registers in German Versailles discourse

## Supported Languages

BGE-M3 supports 100+ languages. Common pairs:

```bash
# English + German
python pipeline.py doc.txt -l en de

# French + German
python pipeline.py doc.txt -l fr de

# Trilingual
python pipeline.py doc.txt -l en de fr
```

## Performance

| Stage | Time | Notes |
|-------|------|-------|
| Model load | ~30s | First run only, cached after |
| Extraction | 2-5s | Per document, depends on length |
| Embedding | ~200ms | Per 10 concepts |
| UMAP | ~100ms | Per language |
| **Total** | **3-8s** | After model cached |

Memory: ~2GB for BGE-M3 model

## Troubleshooting

### "MISTRAL_API_KEY not set"
```bash
export MISTRAL_API_KEY=your-key-here
# or add to python/.env
```

### Model download slow
```bash
export HF_TOKEN=your-huggingface-token
```

### UMAP warnings about n_jobs
Safe to ignore. UMAP uses single thread for reproducibility when `random_state` is set.

## API Usage

### Full Pipeline
```bash
curl -X POST http://localhost:8000/pipeline \
  -H "Content-Type: application/json" \
  -d '{
    "document": "Germany accepts responsibility...",
    "languages": ["en", "de"],
    "max_concepts": 20
  }'
```

### Step-by-Step
```bash
# Extract only
curl -X POST http://localhost:8000/extract \
  -d '{"document": "...", "languages": ["en", "de"]}'

# Validate only
curl -X POST http://localhost:8000/validate \
  -d '{"frames": [...], "languages": ["en", "de"]}'

# Embed only
curl -X POST http://localhost:8000/embed \
  -d '{"frames": [...], "languages": ["en", "de"]}'
```

## License

MIT - Part of the LACUNA project.
