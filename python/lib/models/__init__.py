"""
LACUNA Model Registry

Central registry for all embedding models used in benchmarking.
"""

from typing import Dict, Optional, List
import os

from ..providers import (
    EmbeddingModelConfig,
    EmbeddingProvider,
    ProviderType,
)


# Model configurations for all 6 benchmark models
MODEL_CONFIGS: Dict[str, EmbeddingModelConfig] = {
    "bge-m3": EmbeddingModelConfig(
        name="BGE-M3",
        model_id="BAAI/bge-m3",
        dimensions=1024,
        provider_type=ProviderType.LOCAL,
        key="bge-m3",
        notes="Current baseline, BAAI multilingual"
    ),
    "e5-large": EmbeddingModelConfig(
        name="Multilingual E5 Large",
        model_id="intfloat/multilingual-e5-large",
        dimensions=1024,
        provider_type=ProviderType.LOCAL,
        key="e5-large",
        notes="Microsoft contrastive model"
    ),
    "mistral-embed": EmbeddingModelConfig(
        name="Mistral Embed",
        model_id="mistral-embed",
        dimensions=1024,
        provider_type=ProviderType.API,
        key="mistral-embed",
        notes="Required for track alignment with Mistral LLM"
    ),
    "cohere-embed": EmbeddingModelConfig(
        name="Cohere Embed v3",
        model_id="embed-multilingual-v3.0",
        dimensions=1024,
        provider_type=ProviderType.API,
        key="cohere-embed",
        notes="Production multilingual embeddings"
    ),
    "sonar": EmbeddingModelConfig(
        name="SONAR",
        model_id="facebook/sonar",
        dimensions=1024,
        provider_type=ProviderType.LOCAL,
        key="sonar",
        notes="200+ languages, anti-LACUNA hypothesis (erases topology)"
    ),
    "nv-embed": EmbeddingModelConfig(
        name="NVIDIA Llama Nemotron Embed",
        model_id="nvidia/llama-nemotron-embed-1b-v2",
        dimensions=1024,
        provider_type=ProviderType.LOCAL,
        key="nv-embed",
        notes="Llama 3.2 based, 1B params, multilingual (26 langs), Matryoshka support",
        requires_pca=False,  # Uses Matryoshka truncation instead
        original_dimensions=2048
    ),
}


def get_model_config(key: str) -> Optional[EmbeddingModelConfig]:
    """Get model configuration by key."""
    return MODEL_CONFIGS.get(key)


def list_models() -> List[str]:
    """List all available model keys."""
    return list(MODEL_CONFIGS.keys())


def get_provider(key: str) -> Optional[EmbeddingProvider]:
    """
    Get an embedding provider instance by key.

    Returns None if the model is not available (e.g., missing API key).
    """
    config = get_model_config(key)
    if config is None:
        return None

    if key == "bge-m3":
        from .bge_m3 import BGEM3Provider
        return BGEM3Provider(config)

    elif key == "e5-large":
        from .e5_large import E5LargeProvider
        return E5LargeProvider(config)

    elif key == "mistral-embed":
        from .mistral_embed import MistralEmbedProvider
        api_key = os.environ.get("MISTRAL_API_KEY")
        provider = MistralEmbedProvider(config, api_key)
        return provider if provider.is_available() else None

    elif key == "cohere-embed":
        from .cohere_embed import CohereEmbedProvider
        api_key = os.environ.get("COHERE_API_KEY")
        provider = CohereEmbedProvider(config, api_key)
        return provider if provider.is_available() else None

    elif key == "sonar":
        from .sonar import SONARProvider
        provider = SONARProvider(config)
        return provider if provider.is_available() else None

    elif key == "nv-embed":
        from .nv_embed import NVEmbedProvider
        return NVEmbedProvider(config)

    return None


def get_available_providers() -> Dict[str, EmbeddingProvider]:
    """
    Get all available embedding providers.

    Filters out models that require API keys if keys are not set.
    """
    providers = {}
    for key in list_models():
        try:
            provider = get_provider(key)
            if provider is not None:
                providers[key] = provider
        except ImportError as e:
            print(f"[models] Skipping {key}: {e}")
        except Exception as e:
            print(f"[models] Error loading {key}: {e}")
    return providers


def get_manifest() -> dict:
    """
    Get model manifest for API/frontend.

    Returns dict with all models and their availability status.
    """
    manifest = {
        "models": [],
        "available": [],
    }

    for key, config in MODEL_CONFIGS.items():
        model_info = {
            "key": key,
            "name": config.name,
            "dimensions": config.dimensions,
            "type": config.provider_type.value,
            "notes": config.notes,
        }
        manifest["models"].append(model_info)

        # Check availability
        try:
            provider = get_provider(key)
            if provider is not None:
                manifest["available"].append(key)
        except:
            pass

    return manifest
