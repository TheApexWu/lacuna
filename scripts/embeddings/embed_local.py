"""
embed_local.py

Generates embeddings using local models (BGE-M3, E5-large, SONAR, NV-Embed-v2).
Reads concept data from concepts_input.json.

Usage:
  python embed_local.py --model bge-m3
  python embed_local.py --model e5-large
  python embed_local.py --model sonar
  python embed_local.py --model nv-embed-v2

Output: scripts/embeddings/{model}-raw.json
"""

import json
import argparse
import os
import sys
from pathlib import Path

import numpy as np

SCRIPT_DIR = Path(__file__).parent
CONCEPTS_PATH = SCRIPT_DIR / "concepts_input.json"

MODEL_CONFIGS = {
    "bge-m3": {
        "name": "BGE-M3",
        "hf_id": "BAAI/bge-m3",
        "type": "sentence-transformers",
        "dimension": 1024,
    },
    "e5-large": {
        "name": "multilingual-e5-large",
        "hf_id": "intfloat/multilingual-e5-large",
        "type": "sentence-transformers",
        "dimension": 1024,
        "prefix": "query: ",  # E5 requires prefix
    },
    "sonar": {
        "name": "SONAR (Meta)",
        "hf_id": "cointegrated/SONAR_200_text_encoder",
        "type": "sonar",
        "dimension": 1024,
    },
    "nv-embed-v2": {
        "name": "NV-Embed-v2",
        "hf_id": "nvidia/NV-Embed-v2",
        "type": "transformers",
        "dimension": 4096,
    },
}


def load_concepts():
    """Load concepts from concepts_input.json."""
    if not CONCEPTS_PATH.exists():
        print(f"Error: {CONCEPTS_PATH} not found. Run extract_concepts.ts first.")
        sys.exit(1)

    with open(CONCEPTS_PATH) as f:
        data = json.load(f)

    return data["languages"], data["concepts"]


def build_texts(languages, concepts, prefix=""):
    """Build input texts: "{label}: {definition}" per concept per language."""
    texts = []
    keys = []  # "lang:conceptId"

    for lang in languages:
        for concept in concepts:
            label = concept["labels"].get(lang, concept["labels"].get("en", concept["id"]))
            definition = concept.get("definitions", {}).get(lang, "")
            if not definition:
                definition = concept.get("definitions", {}).get("en", "")

            text = f"{label}: {definition}" if definition else label
            texts.append(f"{prefix}{text}")
            keys.append(f"{lang}:{concept['id']}")

    return texts, keys


def embed_sentence_transformers(model_id, texts, dimension):
    """Embed using sentence-transformers library."""
    from sentence_transformers import SentenceTransformer

    print(f"  Loading model: {model_id}")
    model = SentenceTransformer(model_id, trust_remote_code=True)

    print(f"  Encoding {len(texts)} texts...")
    embeddings = model.encode(
        texts,
        batch_size=32,
        show_progress_bar=True,
        normalize_embeddings=True,
    )

    return embeddings.tolist()


def embed_sonar(model_id, texts, dimension):
    """Embed using SONAR/fairseq2."""
    try:
        from sonar.inference_pipelines.text import TextToEmbeddingModelPipeline

        print(f"  Loading SONAR model...")
        pipeline = TextToEmbeddingModelPipeline(
            encoder="text_sonar_basic_encoder",
            tokenizer="text_sonar_basic_encoder",
        )

        print(f"  Encoding {len(texts)} texts...")
        # SONAR processes by language, but we can batch all together
        embeddings = pipeline.predict(texts, source_lang="eng_Latn", batch_size=32)
        return embeddings.cpu().numpy().tolist()

    except ImportError:
        print("  SONAR not installed. Attempting sentence-transformers fallback...")
        return embed_sentence_transformers(model_id, texts, dimension)


def embed_nv_embed(model_id, texts, dimension):
    """Embed using NV-Embed-v2 via transformers."""
    import torch
    from transformers import AutoModel, AutoTokenizer

    print(f"  Loading NV-Embed-v2 model (this may take a while)...")
    tokenizer = AutoTokenizer.from_pretrained(model_id, trust_remote_code=True)
    model = AutoModel.from_pretrained(model_id, trust_remote_code=True)

    if torch.cuda.is_available():
        model = model.cuda()
        print("  Using CUDA")
    elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        model = model.to("mps")
        print("  Using MPS (Apple Silicon)")

    model.eval()

    batch_size = 8  # Small batches for large model
    all_embeddings = []

    print(f"  Encoding {len(texts)} texts in batches of {batch_size}...")
    for i in range(0, len(texts), batch_size):
        batch = texts[i : i + batch_size]
        inputs = tokenizer(
            batch, padding=True, truncation=True, max_length=512, return_tensors="pt"
        )
        inputs = {k: v.to(model.device) for k, v in inputs.items()}

        with torch.no_grad():
            outputs = model(**inputs)
            # Use last hidden state [CLS] or mean pooling
            embs = outputs.last_hidden_state[:, 0, :]  # CLS token
            embs = torch.nn.functional.normalize(embs, p=2, dim=1)
            all_embeddings.extend(embs.cpu().numpy().tolist())

        if (i // batch_size + 1) % 10 == 0:
            print(f"    Batch {i // batch_size + 1}/{(len(texts) + batch_size - 1) // batch_size}")

    return all_embeddings


def main():
    parser = argparse.ArgumentParser(description="Generate embeddings with local models")
    parser.add_argument(
        "--model",
        required=True,
        choices=list(MODEL_CONFIGS.keys()),
        help="Model to use",
    )
    parser.add_argument(
        "--output",
        default=None,
        help="Output path (default: {model}-raw.json)",
    )
    args = parser.parse_args()

    config = MODEL_CONFIGS[args.model]
    output_path = args.output or str(SCRIPT_DIR / f"{args.model}-raw.json")

    print(f"Model: {config['name']} ({config['hf_id']})")
    print(f"Expected dimension: {config['dimension']}")

    # Load concepts
    languages, concepts = load_concepts()
    print(f"Loaded {len(concepts)} concepts, {len(languages)} languages")

    # Build texts
    prefix = config.get("prefix", "")
    texts, keys = build_texts(languages, concepts, prefix=prefix)
    print(f"Total texts to embed: {len(texts)}")

    # Embed
    embed_fn = {
        "sentence-transformers": lambda: embed_sentence_transformers(
            config["hf_id"], texts, config["dimension"]
        ),
        "sonar": lambda: embed_sonar(config["hf_id"], texts, config["dimension"]),
        "transformers": lambda: embed_nv_embed(
            config["hf_id"], texts, config["dimension"]
        ),
    }[config["type"]]

    vectors = embed_fn()
    actual_dim = len(vectors[0]) if vectors else 0
    print(f"Got {len(vectors)} vectors, dimension: {actual_dim}")

    # Build output
    embeddings = {}
    for i, key in enumerate(keys):
        embeddings[key] = vectors[i]

    output = {
        "modelId": args.model,
        "modelName": config["name"],
        "dimension": actual_dim,
        "embeddings": embeddings,
    }

    with open(output_path, "w") as f:
        json.dump(output, f)

    print(f"\n✓ Saved {output_path}")
    print(f"  {len(embeddings)} embeddings, {actual_dim} dimensions each")
    file_size_mb = os.path.getsize(output_path) / (1024 * 1024)
    print(f"  File size: {file_size_mb:.1f} MB")


if __name__ == "__main__":
    main()
