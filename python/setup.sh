#!/bin/bash
# LACUNA Python Service Setup Script
# Run this once to set up the embedding service

set -e  # Exit on error

echo "=== LACUNA Python Embedding Service Setup ==="
echo ""

# Check if we're in the python directory
if [ ! -f "requirements.txt" ]; then
    echo "Error: Must run from python/ directory"
    echo "Usage: cd python && ./setup.sh"
    exit 1
fi

# Step 1: Check for uv
echo "[1/6] Checking for uv package manager..."
if ! command -v uv &> /dev/null; then
    echo "Installing uv..."
    curl -LsSf https://astral.sh/uv/install.sh | sh
    export PATH="$HOME/.local/bin:$PATH"
fi
echo "✓ uv found"

# Step 2: Create virtual environment
echo ""
echo "[2/6] Creating virtual environment..."
if [ ! -d ".venv" ]; then
    uv venv
    echo "✓ Virtual environment created"
else
    echo "✓ Virtual environment already exists"
fi

# Step 3: Install dependencies
echo ""
echo "[3/6] Installing Python dependencies..."
echo "This will download BGE-M3 model and PyTorch (~3-4GB)"
echo "First installation takes ~5-10 minutes..."
uv pip install -r requirements.txt
echo "✓ Dependencies installed"

# Step 4: Export concepts from TypeScript
echo ""
echo "[4/6] Exporting concepts from TypeScript..."
cd ..
node scripts/export_concepts.js
cd python
echo "✓ Concepts exported"

# Step 5: Extract embeddings
echo ""
echo "[5/6] Generating embeddings for curated concepts..."
echo "This takes ~2-3 minutes (includes BGE-M3 model download)..."
source .venv/bin/activate
python scripts/extract_embeddings.py
echo "✓ Embeddings generated"

# Step 6: Fit UMAP models
echo ""
echo "[6/6] Fitting UMAP models..."
echo "This takes ~1 minute..."
python scripts/fit_umap.py
echo "✓ UMAP models fitted"

echo ""
echo "=== Setup Complete! ==="
echo ""
echo "Next steps:"
echo "1. Copy .env.example to .env and add your Anthropic API key:"
echo "   cp .env.example .env"
echo "   # Edit .env and set ANTHROPIC_API_KEY=sk-ant-..."
echo ""
echo "2. Start the service:"
echo "   source .venv/bin/activate"
echo "   uvicorn app.main:app --reload --port 8000"
echo ""
echo "Or from project root:"
echo "   npm run dev:python"
echo ""
echo "To run both Next.js and Python together:"
echo "   npm run dev:all"
