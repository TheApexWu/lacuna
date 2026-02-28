"""FastAPI application for LACUNA embedding service."""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .models import EmbedRequest, EmbedResponse, HealthResponse
from .embeddings import EmbeddingService
from .umap_projection import UMAPProjector
from .neighbors import NeighborSearch
from .interpretation import InterpretationService

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Global service instances
embedding_service = None
umap_projector = None
neighbor_search = None
interpretation_service = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    global embedding_service, umap_projector, neighbor_search, interpretation_service

    # Startup
    logger.info("Starting LACUNA embedding service...")

    try:
        # Load services in order
        logger.info("Loading BGE-M3 model...")
        embedding_service = EmbeddingService()

        logger.info("Loading UMAP projector...")
        umap_projector = UMAPProjector()

        logger.info("Loading neighbor search...")
        neighbor_search = NeighborSearch()

        logger.info("Initializing interpretation service...")
        interpretation_service = InterpretationService()

        logger.info("All services loaded successfully!")

    except Exception as e:
        logger.error(f"Failed to initialize services: {e}")
        raise

    yield

    # Shutdown
    logger.info("Shutting down LACUNA embedding service...")


# Create FastAPI app
app = FastAPI(
    title="LACUNA Embedding Service",
    description="BGE-M3 embeddings with UMAP projection and semantic interpretation",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    models_loaded = all([
        embedding_service is not None,
        umap_projector is not None,
        neighbor_search is not None,
    ])

    languages_available = []
    if neighbor_search:
        for lang in ["en", "de"]:
            if neighbor_search.is_available(lang) and umap_projector.is_available(lang):
                languages_available.append(lang)

    return HealthResponse(
        status="healthy" if models_loaded else "loading",
        models_loaded=models_loaded,
        languages_available=languages_available
    )


@app.post("/embed", response_model=EmbedResponse)
async def embed_concept(request: EmbedRequest):
    """
    Generate embedding and semantic analysis for a concept.

    Args:
        request: EmbedRequest with concept, language, and definition

    Returns:
        EmbedResponse with embedding, position, weight, neighbors, and interpretation
    """
    # Validate services are loaded
    if not all([embedding_service, umap_projector, neighbor_search]):
        raise HTTPException(
            status_code=503,
            detail="Services not fully loaded. Please wait and retry."
        )

    # Validate language
    if request.language not in ["en", "de"]:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported language: {request.language}. Use 'en' or 'de'."
        )

    # Check if language is available
    if not neighbor_search.is_available(request.language):
        raise HTTPException(
            status_code=503,
            detail=f"Language '{request.language}' not ready. Run setup scripts first."
        )

    if not umap_projector.is_available(request.language):
        raise HTTPException(
            status_code=503,
            detail=f"UMAP model for '{request.language}' not ready. Run setup scripts first."
        )

    try:
        # Step 1: Generate embedding
        logger.info(f"Generating embedding for '{request.concept}' ({request.language})")
        embedding = embedding_service.embed(request.definition)

        # Step 2: UMAP projection
        logger.info("Projecting to 2D space")
        x, z = umap_projector.project(embedding, request.language)
        position = [x, z]

        # Step 3: Calculate weight
        logger.info("Calculating semantic weight")
        weight = umap_projector.calculate_weight(embedding, request.language)

        # Step 4: Find neighbors
        logger.info("Finding semantic neighbors")
        neighbors = neighbor_search.find_neighbors(embedding, request.language)

        # Step 5: Generate interpretation (optional)
        interpretation = None
        if interpretation_service and interpretation_service.is_available():
            logger.info("Generating interpretation")
            interpretation = interpretation_service.generate_interpretation(
                concept=request.concept,
                definition=request.definition,
                language=request.language,
                position=(x, z),
                neighbors=neighbors
            )
        else:
            logger.info("Interpretation service not available")

        # Build response
        response = EmbedResponse(
            concept=request.concept,
            language=request.language,
            embedding=embedding.tolist(),
            position=position,
            weight=weight,
            neighbors=neighbors,
            interpretation=interpretation,
            status="live"
        )

        logger.info(f"Successfully processed '{request.concept}'")
        return response

    except Exception as e:
        logger.error(f"Error processing request: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "service": "LACUNA Embedding Service",
        "version": "1.0.0",
        "status": "running"
    }
