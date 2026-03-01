"""
LACUNA Pydantic schemas matching frontend Concept[] type.

TypeScript reference:
  type Concept = {
    id: string;
    labels: Record<string, string>;
    definitions?: Record<string, string>;
    cluster: string;
    position: Record<string, [number, number]>;
    weight: Record<string, number>;
    ghost: Record<string, boolean>;
    hero?: boolean;
    source: "curated" | "embedding";
  }
"""

from pydantic import BaseModel, Field
from typing import Dict, List, Tuple, Optional, Literal, Any


class ExtractedFrame(BaseModel):
    """Raw frame extracted by Mistral before validation."""

    id: str = Field(..., description="Slug ID (lowercase, no spaces)")
    labels: Dict[str, str] = Field(..., description="Labels by language code")
    definitions: Dict[str, str] = Field(..., description="Definitions by language code")
    cluster: str = Field(default="extracted", description="Semantic cluster")
    source_quote: Optional[str] = Field(None, description="Original quote from document")
    confidence: float = Field(default=1.0, description="Extraction confidence 0-1")


class ValidatedFrame(BaseModel):
    """Frame that passed validation filters."""

    id: str
    labels: Dict[str, str]
    definitions: Dict[str, str]
    cluster: str
    embeddings: Dict[str, List[float]] = Field(..., description="BGE-M3 embeddings by language")
    validation_scores: Dict[str, float] = Field(default_factory=dict)


class Concept(BaseModel):
    """
    Full Concept matching frontend type.
    Output of embed.py pipeline.
    """

    id: str = Field(..., description="Unique slug ID")
    labels: Dict[str, str] = Field(..., description="Display labels by language")
    definitions: Optional[Dict[str, str]] = Field(None, description="Definitions by language")
    cluster: str = Field(..., description="Semantic cluster name")
    position: Dict[str, Tuple[float, float]] = Field(..., description="[x, z] by language")
    weight: Dict[str, float] = Field(..., description="Semantic weight 0-1 by language")
    ghost: Dict[str, bool] = Field(..., description="Ghost status by language")
    hero: Optional[bool] = Field(None, description="Hero concept flag")
    source: Literal["curated", "embedding"] = Field(default="embedding")

    class Config:
        # Allow tuple serialization as list
        json_encoders = {
            tuple: list
        }


class ExtractionRequest(BaseModel):
    """Request to extract concepts from a document."""

    document: str = Field(..., description="Raw document text")
    languages: List[str] = Field(default=["en", "de"], description="Target languages")
    max_concepts: int = Field(default=20, description="Max concepts to extract")


class ExtractionResponse(BaseModel):
    """Response from extraction pipeline."""

    concepts: List[Concept] = Field(..., description="Extracted and validated concepts")
    rejected: List[ExtractedFrame] = Field(default_factory=list, description="Rejected frames")
    stats: Dict[str, Any] = Field(default_factory=dict, description="Pipeline statistics")


class ValidationResult(BaseModel):
    """Result of validation pass."""

    valid: List[ValidatedFrame]
    rejected: List[ExtractedFrame]
    rejection_reasons: Dict[str, str] = Field(default_factory=dict)
