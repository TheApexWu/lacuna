#!/usr/bin/env python3
"""
LACUNA Pipeline API

FastAPI service exposing the extraction pipeline for the Orchestrator.

Endpoints:
    POST /extract     - Extract concepts from document
    POST /validate    - Validate extracted frames
    POST /embed       - Embed and position concepts
    GET  /health      - Health check

Usage:
    uvicorn api:app --reload --port 8000
"""

import os
import sys
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

sys.path.insert(0, str(Path(__file__).parent))

from lib.schemas import (
    ExtractedFrame,
    ValidatedFrame,
    Concept,
    ExtractionRequest,
    ExtractionResponse,
)
from pipeline import run_pipeline, validated_to_concepts
from agents.extractor import extract_frames
from agents.validator import validate_frames


# Create FastAPI app
app = FastAPI(
    title="LACUNA Pipeline API",
    description="Extraction and embedding pipeline for conceptual frames",
    version="1.0.0",
)

# CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request/Response models
class ExtractRequest(BaseModel):
    """Request to extract frames from document."""
    document: str = Field(..., description="Raw document text")
    languages: List[str] = Field(default=["en", "de"])
    max_concepts: int = Field(default=20)


class ExtractResponse(BaseModel):
    """Response from extraction."""
    frames: List[ExtractedFrame]
    count: int


class ValidateRequest(BaseModel):
    """Request to validate frames."""
    frames: List[ExtractedFrame]
    languages: List[str] = Field(default=["en", "de"])


class ValidateResponse(BaseModel):
    """Response from validation."""
    valid: List[ValidatedFrame]
    rejected: List[ExtractedFrame]
    rejection_reasons: dict


class EmbedRequest(BaseModel):
    """Request to embed and position validated frames."""
    frames: List[ValidatedFrame]
    languages: List[str] = Field(default=["en", "de"])


class EmbedResponse(BaseModel):
    """Response with full concepts."""
    concepts: List[Concept]


class PipelineRequest(BaseModel):
    """Full pipeline request."""
    document: str = Field(..., description="Raw document text")
    languages: List[str] = Field(default=["en", "de"])
    max_concepts: int = Field(default=20)


class PipelineResponse(BaseModel):
    """Full pipeline response."""
    concepts: List[Concept]
    rejected: List[ExtractedFrame]
    stats: dict


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    mistral_configured: bool
    model_loaded: bool


# Global state
_model_loaded = False


@app.get("/health", response_model=HealthResponse)
async def health():
    """Health check endpoint."""
    mistral_key = os.environ.get("MISTRAL_API_KEY")
    return HealthResponse(
        status="ok",
        mistral_configured=bool(mistral_key),
        model_loaded=_model_loaded,
    )


@app.post("/extract", response_model=ExtractResponse)
async def extract(request: ExtractRequest):
    """
    Extract conceptual frames from a document using Mistral.

    This is the first step of the pipeline.
    """
    if not os.environ.get("MISTRAL_API_KEY"):
        raise HTTPException(status_code=500, detail="MISTRAL_API_KEY not configured")

    try:
        frames = await extract_frames(
            request.document,
            request.languages,
            request.max_concepts,
        )
        return ExtractResponse(frames=frames, count=len(frames))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/validate", response_model=ValidateResponse)
async def validate(request: ValidateRequest):
    """
    Validate extracted frames using BGE-M3 embeddings.

    Filters out:
    - Duplicates (cosine > 0.85)
    - Outliers (don't fit semantic space)
    - Generic concepts (too uniform)
    """
    global _model_loaded

    try:
        result = validate_frames(
            request.frames,
            languages=request.languages,
        )
        _model_loaded = True

        return ValidateResponse(
            valid=result.valid,
            rejected=result.rejected,
            rejection_reasons=result.rejection_reasons,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/embed", response_model=EmbedResponse)
async def embed(request: EmbedRequest):
    """
    Compute UMAP positions and weights for validated frames.

    Returns full Concept objects ready for the frontend.
    """
    try:
        concepts = validated_to_concepts(request.frames, request.languages)
        return EmbedResponse(concepts=concepts)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/pipeline", response_model=PipelineResponse)
async def pipeline(request: PipelineRequest):
    """
    Run the full extraction pipeline.

    Document → Extract → Validate → Embed → Concepts

    This is the main endpoint for the Orchestrator.
    """
    if not os.environ.get("MISTRAL_API_KEY"):
        raise HTTPException(status_code=500, detail="MISTRAL_API_KEY not configured")

    global _model_loaded

    try:
        result = await run_pipeline(
            request.document,
            request.languages,
            request.max_concepts,
        )
        _model_loaded = True

        return PipelineResponse(
            concepts=result.concepts,
            rejected=result.rejected,
            stats=result.stats,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Preload model on startup (optional, can be slow)
@app.on_event("startup")
async def startup():
    """Optionally preload the embedding model."""
    preload = os.environ.get("PRELOAD_MODEL", "false").lower() == "true"
    if preload:
        print("[api] Preloading BGE-M3 model...")
        from lib.embeddings import get_model
        get_model()
        global _model_loaded
        _model_loaded = True
        print("[api] Model loaded.")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
