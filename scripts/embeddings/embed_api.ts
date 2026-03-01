/**
 * embed_api.ts
 *
 * Generates embeddings using API-based models (Mistral, Cohere).
 * Reads concept data from concepts_input.json and API keys from .env.
 *
 * Usage:
 *   npx tsx scripts/embeddings/embed_api.ts --model mistral-embed
 *   npx tsx scripts/embeddings/embed_api.ts --model cohere-v3
 *
 * Output: scripts/embeddings/{model}-raw.json
 *
 * Required env vars:
 *   MISTRAL_API_KEY  (for mistral-embed)
 *   COHERE_API_KEY   (for cohere-v3)
 */

import * as fs from "fs";
import * as path from "path";

// ── Load .env ───────────────────────────────────────────────
function loadEnv() {
  const envPath = path.resolve(__dirname, "../../.env");
  if (!fs.existsSync(envPath)) {
    const localPath = path.resolve(__dirname, "../../.env.local");
    if (fs.existsSync(localPath)) {
      parseEnvFile(localPath);
      return;
    }
    console.warn("⚠ No .env or .env.local found. API keys must be set in environment.");
    return;
  }
  parseEnvFile(envPath);
}

function parseEnvFile(filePath: string) {
  const content = fs.readFileSync(filePath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    process.env[key] = value;
  }
}

// ── Types ───────────────────────────────────────────────────
interface ConceptInput {
  id: string;
  labels: Record<string, string>;
  definitions: Record<string, string>;
  cluster: string;
}

interface ConceptsFile {
  languages: string[];
  concepts: ConceptInput[];
}

interface RawOutput {
  modelId: string;
  modelName: string;
  dimension: number;
  embeddings: Record<string, number[]>; // "lang:conceptId" → vector
}

// ── Mistral Embed ───────────────────────────────────────────
async function embedMistral(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) throw new Error("MISTRAL_API_KEY not set");

  const batchSize = 16; // Mistral allows batched requests
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    console.log(`  Mistral batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(texts.length / batchSize)} (${batch.length} texts)`);

    const response = await fetch("https://api.mistral.ai/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "mistral-embed",
        input: batch,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Mistral API error ${response.status}: ${error}`);
    }

    const data = await response.json();
    for (const item of data.data) {
      results.push(item.embedding);
    }

    // Rate limit: wait 500ms between batches
    if (i + batchSize < texts.length) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  return results;
}

// ── Cohere Embed ────────────────────────────────────────────
async function embedCohere(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.COHERE_API_KEY;
  if (!apiKey) throw new Error("COHERE_API_KEY not set");

  const batchSize = 96; // Cohere allows up to 96 texts per request
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    console.log(`  Cohere batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(texts.length / batchSize)} (${batch.length} texts)`);

    const response = await fetch("https://api.cohere.com/v1/embed", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "embed-multilingual-v3.0",
        texts: batch,
        input_type: "search_document",
        truncate: "END",
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Cohere API error ${response.status}: ${error}`);
    }

    const data = await response.json();
    results.push(...data.embeddings);

    // Rate limit: wait 500ms between batches
    if (i + batchSize < texts.length) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  return results;
}

// ── Main ────────────────────────────────────────────────────
async function main() {
  loadEnv();

  const modelArg = process.argv.find((a) => a.startsWith("--model="))?.split("=")[1]
    || process.argv[process.argv.indexOf("--model") + 1];

  if (!modelArg || !["mistral-embed", "cohere-v3"].includes(modelArg)) {
    console.error("Usage: npx tsx embed_api.ts --model mistral-embed|cohere-v3");
    process.exit(1);
  }

  // Load concepts
  const inputPath = path.resolve(__dirname, "concepts_input.json");
  if (!fs.existsSync(inputPath)) {
    console.error("concepts_input.json not found. Run extract_concepts.ts first.");
    process.exit(1);
  }
  const input: ConceptsFile = JSON.parse(fs.readFileSync(inputPath, "utf-8"));
  console.log(`Loaded ${input.concepts.length} concepts, ${input.languages.length} languages`);

  // Build text inputs: "{label}: {definition}" for each concept × language
  const texts: string[] = [];
  const keys: string[] = []; // "lang:conceptId"

  for (const lang of input.languages) {
    for (const concept of input.concepts) {
      const label = concept.labels[lang] || concept.labels["en"] || concept.id;
      const def = concept.definitions[lang] || concept.definitions["en"] || "";
      const text = def ? `${label}: ${def}` : label;
      texts.push(text);
      keys.push(`${lang}:${concept.id}`);
    }
  }

  console.log(`Total texts to embed: ${texts.length}`);
  console.log(`Model: ${modelArg}`);

  // Embed
  let vectors: number[][];
  if (modelArg === "mistral-embed") {
    vectors = await embedMistral(texts);
  } else {
    vectors = await embedCohere(texts);
  }

  console.log(`Got ${vectors.length} vectors, dimension: ${vectors[0]?.length}`);

  // Build output
  const embeddings: Record<string, number[]> = {};
  for (let i = 0; i < keys.length; i++) {
    embeddings[keys[i]] = vectors[i];
  }

  const output: RawOutput = {
    modelId: modelArg,
    modelName: modelArg === "mistral-embed" ? "Mistral Embed" : "Cohere embed-v3",
    dimension: vectors[0]?.length || 0,
    embeddings,
  };

  const outPath = path.resolve(__dirname, `${modelArg}-raw.json`);
  fs.writeFileSync(outPath, JSON.stringify(output));
  console.log(`\n✓ Saved ${outPath}`);
  console.log(`  ${Object.keys(embeddings).length} embeddings, ${output.dimension} dimensions each`);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
