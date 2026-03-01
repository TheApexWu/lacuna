/**
 * extract_concepts.ts
 *
 * Exports concept data from versailles.ts into a JSON file
 * that can be consumed by the Python and Node.js embedding scripts.
 *
 * Usage: npx tsx scripts/embeddings/extract_concepts.ts
 * Output: scripts/embeddings/concepts_input.json
 */

import * as fs from "fs";
import * as path from "path";

// We parse the source file to extract concepts since versailles.ts
// uses helper functions that don't work in a simple import context.
// Instead, we dynamically import.

async function main() {
  // Use dynamic import to load the TS module
  const versailles = await import("../../src/data/versailles");
  const { concepts, LANGUAGES } = versailles;

  const output = {
    languages: LANGUAGES.map((l: { code: string }) => l.code),
    concepts: concepts.map(
      (c: {
        id: string;
        labels: Record<string, string>;
        definitions?: Record<string, string>;
        cluster: string;
        lacuna: Record<string, boolean>;
        hero?: boolean;
      }) => ({
        id: c.id,
        labels: c.labels,
        definitions: c.definitions || {},
        cluster: c.cluster,
        lacuna: c.lacuna,
        hero: c.hero || false,
      })
    ),
  };

  const outPath = path.resolve(__dirname, "concepts_input.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`✓ Exported ${output.concepts.length} concepts to ${outPath}`);
  console.log(`  Languages: ${output.languages.join(", ")}`);
}

main().catch(console.error);
