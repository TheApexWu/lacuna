"""
SONAR Embedding Provider

Meta's SONAR model supporting 200+ languages.
Hypothesis: SONAR erases cross-lingual topology (anti-LACUNA).
"""

from typing import List
import numpy as np

from ..providers import EmbeddingProvider, EmbeddingModelConfig


class SONARProvider(EmbeddingProvider):
    """SONAR embedding provider using fairseq2."""

    def __init__(self, config: EmbeddingModelConfig):
        super().__init__(config)
        self._encoder = None
        self._tokenizer = None

    def _load_model(self):
        """Lazy load SONAR model."""
        if self._encoder is None:
            print(f"[{self.key}] Loading SONAR model...")
            try:
                from sonar.inference_pipelines.text import TextToEmbeddingModelPipeline

                self._pipeline = TextToEmbeddingModelPipeline(
                    encoder="text_sonar_basic_encoder",
                    tokenizer="text_sonar_basic_encoder"
                )
                print(f"[{self.key}] SONAR loaded.")
            except ImportError:
                # Fallback: try fairseq2 directly
                print(f"[{self.key}] sonar package not found, trying fairseq2...")
                raise ImportError(
                    "SONAR requires the sonar-space package. "
                    "Install with: pip install sonar-space"
                )
        return self._pipeline

    def embed(self, texts: List[str], batch_size: int = 8) -> np.ndarray:
        """
        Embed texts using SONAR.

        SONAR uses language-specific encoders. For cross-lingual comparison,
        we detect language or use a default.
        """
        pipeline = self._load_model()

        # SONAR requires source language - detect or default to English
        # For benchmark, we'll process in batches per language
        embeddings = pipeline.predict(
            texts,
            source_lang="eng_Latn",  # Default to English
            batch_size=batch_size
        )

        embeddings_array = np.array(embeddings, dtype=np.float32)

        # Normalize
        norms = np.linalg.norm(embeddings_array, axis=1, keepdims=True)
        embeddings_array = embeddings_array / (norms + 1e-10)

        return embeddings_array

    def embed_with_lang(
        self,
        texts: List[str],
        lang: str = "eng_Latn",
        batch_size: int = 8
    ) -> np.ndarray:
        """
        Embed texts with explicit language code.

        Args:
            texts: Texts to embed
            lang: SONAR language code (e.g., "eng_Latn", "deu_Latn")
            batch_size: Batch size

        Returns:
            Normalized embeddings
        """
        pipeline = self._load_model()

        embeddings = pipeline.predict(
            texts,
            source_lang=lang,
            batch_size=batch_size
        )

        embeddings_array = np.array(embeddings, dtype=np.float32)

        # Normalize
        norms = np.linalg.norm(embeddings_array, axis=1, keepdims=True)
        embeddings_array = embeddings_array / (norms + 1e-10)

        return embeddings_array

    def is_available(self) -> bool:
        """Check if SONAR is available."""
        try:
            from sonar.inference_pipelines.text import TextToEmbeddingModelPipeline
            return True
        except ImportError:
            return False


# SONAR language codes for common languages
SONAR_LANG_CODES = {
    "en": "eng_Latn",
    "de": "deu_Latn",
    "fr": "fra_Latn",
    "es": "spa_Latn",
    "it": "ita_Latn",
    "pt": "por_Latn",
    "nl": "nld_Latn",
    "pl": "pol_Latn",
    "ru": "rus_Cyrl",
    "zh": "zho_Hans",
    "ja": "jpn_Jpan",
    "ko": "kor_Hang",
    "ar": "arb_Arab",
}
