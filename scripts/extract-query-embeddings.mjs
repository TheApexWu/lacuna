#!/usr/bin/env node
// Extract all language concept vectors from mistral-embed-raw.json
// into a compact file for the /api/query endpoint.
// Structure: { dimension, languages: { en: { concept: vector }, de: {...}, ... } }

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rawPath = join(__dirname, "embeddings", "mistral-embed-raw.json");
const outPath = join(__dirname, "..", "src", "data", "concept-embeddings.json");

const raw = JSON.parse(readFileSync(rawPath, "utf-8"));
const embeddings = raw.embeddings;

const result = { dimension: raw.dimension, languages: {} };

for (const [key, vector] of Object.entries(embeddings)) {
  const [lang, ...rest] = key.split(":");
  const conceptId = rest.join(":");
  if (!result.languages[lang]) result.languages[lang] = {};
  result.languages[lang][conceptId] = vector;
}

const langs = Object.keys(result.languages);
const counts = langs.map(l => `${l.toUpperCase()}:${Object.keys(result.languages[l]).length}`);

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(result));

console.log(`Extracted ${langs.length} languages: ${counts.join(", ")}`);
console.log(`Written to ${outPath} (${(Buffer.byteLength(JSON.stringify(result)) / 1024).toFixed(0)} KB)`);
