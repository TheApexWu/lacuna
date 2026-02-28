"""Configuration settings for the LACUNA pipeline service."""

from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # API Keys
    mistral_api_key: Optional[str] = None

    # Model Configuration
    bge_model_name: str = "BAAI/bge-m3"
    mistral_model: str = "mistral-large-latest"

    # UMAP Hyperparameters
    umap_n_neighbors: int = 15
    umap_min_dist: float = 0.1
    umap_metric: str = "cosine"
    umap_random_state: int = 42
    umap_n_components: int = 2

    # Validation Thresholds
    duplicate_threshold: float = 0.85
    uniformity_min: float = 0.3
    extremity_min: float = 0.35
    confidence_min: float = 0.5

    # Neighbor Search
    n_neighbors: int = 8

    # File Paths
    data_dir: str = "data"

    # API Settings
    preload_model: bool = False

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


# Global settings instance
settings = Settings()
