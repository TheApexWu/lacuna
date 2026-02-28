"""LLM-based semantic interpretation using Claude API."""

import logging
from typing import List, Optional
from anthropic import Anthropic

from .config import settings
from .models import Neighbor

logger = logging.getLogger(__name__)


class InterpretationService:
    """Service for generating semantic topology interpretations."""

    def __init__(self):
        """Initialize interpretation service."""
        self.client = None
        if settings.anthropic_api_key:
            try:
                self.client = Anthropic(api_key=settings.anthropic_api_key)
                logger.info("Claude API client initialized")
            except Exception as e:
                logger.warning(f"Failed to initialize Claude API: {e}")
        else:
            logger.warning("No Anthropic API key provided - interpretations will be unavailable")

    def generate_interpretation(
        self,
        concept: str,
        definition: str,
        language: str,
        position: tuple,
        neighbors: List[Neighbor]
    ) -> Optional[str]:
        """
        Generate semantic interpretation using Claude.

        Args:
            concept: Concept label
            definition: Concept definition
            language: Language code (en, de)
            position: (x, z) coordinates in UMAP space
            neighbors: List of nearest neighbors

        Returns:
            Interpretation text or None if unavailable
        """
        if self.client is None:
            return None

        try:
            # Build prompt
            prompt = self._build_prompt(concept, definition, language, position, neighbors)

            # Call Claude API
            response = self.client.messages.create(
                model=settings.llm_model,
                max_tokens=300,
                temperature=0.7,
                messages=[
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]
            )

            # Extract text from response
            interpretation = response.content[0].text.strip()

            logger.info(f"Generated interpretation for '{concept}'")
            return interpretation

        except Exception as e:
            logger.error(f"Interpretation generation failed: {e}")
            return None

    def _build_prompt(
        self,
        concept: str,
        definition: str,
        language: str,
        position: tuple,
        neighbors: List[Neighbor]
    ) -> str:
        """Build prompt for Claude API."""
        # Format neighbors list
        neighbors_text = "\n".join([
            f"  - {n.label} (similarity: {n.similarity:.2f})"
            for n in neighbors[:5]  # Top 5 for brevity
        ])

        # Language context
        lang_name = "English" if language == "en" else "German"

        prompt = f"""You are analyzing a semantic embedding space for political philosophy concepts from the Treaty of Versailles.

Concept: "{concept}"
Definition: {definition}
Language: {lang_name}
Position in semantic space: ({position[0]:.2f}, {position[1]:.2f})

Nearest neighbors:
{neighbors_text}

Provide 2-3 sentences explaining:
1. Why this concept clusters with these neighbors
2. What semantic dimension or theme this region of the space represents
3. Any notable insights about how the {lang_name} framing might differ from other languages

Keep your response concise and focused on semantic relationships."""

        return prompt

    def is_available(self) -> bool:
        """Check if interpretation service is available."""
        return self.client is not None
