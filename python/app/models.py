"""Pydantic models for API request/response schemas."""

from pydantic import BaseModel, Field
from typing import List, Optional


class EmbedRequest(BaseModel):
    """Request schema for embedding endpoint."""

    concept: str = Field(..., description="Concept label")
    language: str = Field(..., description="Language code (en, de)")
    definition: str = Field(..., description="Concept definition text")


class Neighbor(BaseModel):
    """Schema for a semantic neighbor."""

    id: str = Field(..., description="Concept ID")
    label: str = Field(..., description="Concept label")
    similarity: float = Field(..., description="Cosine similarity score")


class EmbedResponse(BaseModel):
    """Response schema for embedding endpoint."""

    concept: str = Field(..., description="Original concept label")
    language: str = Field(..., description="Language code")
    embedding: List[float] = Field(..., description="1024-dimensional BGE-M3 embedding")
    position: List[float] = Field(..., description="[x, z] UMAP-projected position")
    weight: float = Field(..., description="Normalized L2 norm (semantic weight)")
    neighbors: List[Neighbor] = Field(..., description="Top-8 nearest neighbors")
    status: str = Field(default="live", description="Service status")


class HealthResponse(BaseModel):
    """Response schema for health check endpoint."""

    status: str = Field(..., description="Service health status")
    models_loaded: bool = Field(..., description="Whether all models are loaded")
    languages_available: List[str] = Field(default=["en", "de"], description="Available languages")
