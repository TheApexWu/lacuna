/**
 * generate_stubs.ts
 *
 * Generates synthetic embedding data for all 6 models + curated baseline.
 * Each model gets deterministically jittered positions and perturbed weights
 * so the UI can be fully built and tested before real embeddings arrive.
 *
 * Usage: npx tsx scripts/embeddings/generate_stubs.ts
 * Output: src/data/embeddings/{model}.json + metrics.json
 */

import * as fs from "fs";
import * as path from "path";

// ── Import concept data from versailles.ts ──────────────────
// We can't directly import TS with complex helpers, so we read and eval
// Instead, we define the concept IDs and pull from the source

// Simple seeded PRNG (mulberry32)
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Hash a string to a number for seeding
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h;
}

// ── Concept + language data ─────────────────────────────────
// Extracted from versailles.ts to avoid import complications

const LANGUAGES = ["en", "de", "fr", "es", "zh", "ko", "ar", "pt", "ru", "ja"];

interface ConceptStub {
  id: string;
  cluster: string;
  positions: Record<string, [number, number]>;
  weights: Record<string, number>;
  ghost: Record<string, boolean>;
}

// We'll read the actual data from the compiled versailles module
// For now, parse it from the source file
function loadConceptsFromSource(): ConceptStub[] {
  const srcPath = path.resolve(__dirname, "../../src/data/versailles.ts");
  const src = fs.readFileSync(srcPath, "utf-8");

  // Extract concept IDs, clusters, and basic data via regex
  const conceptBlocks: ConceptStub[] = [];
  // Match each concept object block
  const idRegex = /id:\s*"([^"]+)"/g;
  const clusterRegex = /cluster:\s*"([^"]+)"/g;

  const ids: string[] = [];
  const clusters: string[] = [];
  let m: RegExpExecArray | null;

  while ((m = idRegex.exec(src)) !== null) ids.push(m[1]);
  while ((m = clusterRegex.exec(src)) !== null) clusters.push(m[1]);

  // For positions and weights, we'll generate plausible curated baseline
  // based on cluster membership
  const clusterCenters: Record<string, [number, number]> = {
    core: [0, 0],
    justice: [-15, -10],
    victory: [15, -15],
    humiliation: [-10, 15],
    "ghost-de": [20, 20],
    "ghost-en": [-25, -20],
  };

  const clusterWeightRange: Record<string, [number, number]> = {
    core: [0.7, 1.0],
    justice: [0.5, 0.9],
    victory: [0.4, 0.85],
    humiliation: [0.4, 0.9],
    "ghost-de": [0.3, 0.85],
    "ghost-en": [0.3, 0.7],
  };

  // Ghost flags by concept
  const ghostDeConcepts = new Set([
    "dolchstoss",
    "schmach",
    "diktat",
    "kriegsschuld",
    "volkszorn",
    "revanchism",
  ]);
  const ghostEnConcepts = new Set(["magnanimity", "civilizing-mission", "mandate"]);

  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const cluster = clusters[i] || "core";
    const rng = mulberry32(hashStr(id + "curated"));
    const center = clusterCenters[cluster] || [0, 0];
    const wRange = clusterWeightRange[cluster] || [0.3, 0.8];

    const positions: Record<string, [number, number]> = {};
    const weights: Record<string, number> = {};
    const ghost: Record<string, boolean> = {};

    for (const lang of LANGUAGES) {
      const langRng = mulberry32(hashStr(id + lang + "curated"));
      // Position: cluster center + random spread
      const spread = 12;
      positions[lang] = [
        center[0] + (langRng() - 0.5) * spread * 2 + (langRng() - 0.5) * 5,
        center[1] + (langRng() - 0.5) * spread * 2 + (langRng() - 0.5) * 5,
      ];
      // Weight: range based on cluster
      weights[lang] = wRange[0] + langRng() * (wRange[1] - wRange[0]);

      // Ghost flags
      if (ghostDeConcepts.has(id)) {
        ghost[lang] = lang !== "de";
      } else if (ghostEnConcepts.has(id)) {
        ghost[lang] = !["en", "fr", "pt"].includes(lang);
        if (id === "civilizing-mission") {
          ghost[lang] = !["en", "fr", "ar", "ja", "ko"].includes(lang);
        }
        if (id === "mandate") {
          ghost[lang] = !["en", "fr", "ar", "zh"].includes(lang);
        }
      } else {
        ghost[lang] = false;
      }
    }

    conceptBlocks.push({ id, cluster, positions, weights, ghost });
  }

  return conceptBlocks;
}

// ── Model definitions ───────────────────────────────────────

interface ModelDef {
  id: string;
  name: string;
  dimension: number;
  jitterScale: number; // how much to perturb from curated
  weightNoise: number; // how much to perturb weights
}

const EMBEDDING_MODELS: ModelDef[] = [
  { id: "bge-m3", name: "BGE-M3", dimension: 1024, jitterScale: 8, weightNoise: 0.15 },
  {
    id: "e5-large",
    name: "multilingual-e5-large",
    dimension: 1024,
    jitterScale: 10,
    weightNoise: 0.12,
  },
  {
    id: "mistral-embed",
    name: "Mistral Embed",
    dimension: 1024,
    jitterScale: 9,
    weightNoise: 0.18,
  },
  { id: "cohere-v3", name: "Cohere embed-v3", dimension: 1024, jitterScale: 7, weightNoise: 0.14 },
  { id: "sonar", name: "SONAR (Meta)", dimension: 1024, jitterScale: 12, weightNoise: 0.2 },
  {
    id: "nv-embed-v2",
    name: "NV-Embed-v2",
    dimension: 4096,
    jitterScale: 11,
    weightNoise: 0.16,
  },
];

// ── Cosine similarity helpers ───────────────────────────────

function cosineSim(a: [number, number], b: [number, number]): number {
  const dot = a[0] * b[0] + a[1] * b[1];
  const magA = Math.sqrt(a[0] * a[0] + a[1] * a[1]) || 1;
  const magB = Math.sqrt(b[0] * b[0] + b[1] * b[1]) || 1;
  return dot / (magA * magB);
}

function euclideanDist(a: [number, number], b: [number, number]): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return Math.sqrt(dx * dx + dy * dy);
}

// Normalize distance matrix to 0-1 range
function normalizePairwise(matrix: number[][]): number[][] {
  let max = 0;
  for (const row of matrix) for (const v of row) if (v > max) max = v;
  if (max === 0) return matrix;
  return matrix.map((row) => row.map((v) => v / max));
}

// ── Metric computation ──────────────────────────────────────

function computeCLAS(
  concepts: ConceptStub[],
  modelPositions: Record<string, Record<string, [number, number]>>
): { pairs: Record<string, number>; average: number } {
  const pairs: Record<string, number> = {};
  let sum = 0;
  let count = 0;
  for (const lang of LANGUAGES) {
    if (lang === "en") continue;
    const key = `en-${lang}`;
    let langSum = 0;
    let langCount = 0;
    for (const c of concepts) {
      const enPos = modelPositions[c.id]?.["en"];
      const langPos = modelPositions[c.id]?.[lang];
      if (enPos && langPos) {
        const sim = 0.5 + cosineSim(enPos, langPos) * 0.5; // map to 0-1
        langSum += sim;
        langCount++;
      }
    }
    const avg = langCount > 0 ? langSum / langCount : 0;
    pairs[key] = Math.round(avg * 1000) / 1000;
    sum += avg;
    count++;
  }
  return { pairs, average: Math.round((sum / Math.max(count, 1)) * 1000) / 1000 };
}

function computeMantel(
  pairwise: Record<string, number[][]>
): { pairs: Record<string, { r: number; p: number }>; averageR: number } {
  const pairs: Record<string, { r: number; p: number }> = {};
  let sum = 0;
  let count = 0;
  const enMatrix = pairwise["en"];
  if (!enMatrix) return { pairs, averageR: 0 };

  for (const lang of LANGUAGES) {
    if (lang === "en") continue;
    const langMatrix = pairwise[lang];
    if (!langMatrix) continue;
    // Simplified Mantel: Pearson correlation of upper triangle
    const enVals: number[] = [];
    const langVals: number[] = [];
    for (let i = 0; i < enMatrix.length; i++) {
      for (let j = i + 1; j < enMatrix[i].length; j++) {
        enVals.push(enMatrix[i][j]);
        langVals.push(langMatrix[i][j]);
      }
    }
    const r = pearson(enVals, langVals);
    const key = `en-${lang}`;
    pairs[key] = { r: Math.round(r * 1000) / 1000, p: r > 0.5 ? 0.001 : 0.05 };
    sum += r;
    count++;
  }
  return { pairs, averageR: Math.round((sum / Math.max(count, 1)) * 1000) / 1000 };
}

function pearson(x: number[], y: number[]): number {
  const n = x.length;
  if (n === 0) return 0;
  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  return den === 0 ? 0 : num / den;
}

function computeSilhouette(
  concepts: ConceptStub[],
  positions: Record<string, Record<string, [number, number]>>
): Record<string, number> & { average: number } {
  const result: Record<string, number> & { average: number } = { average: 0 };
  let sum = 0;
  let count = 0;

  for (const lang of LANGUAGES) {
    // Simplified silhouette: avg (b - a) / max(a, b) per concept
    const clusters = new Map<string, number[]>();
    for (let i = 0; i < concepts.length; i++) {
      const c = concepts[i];
      if (!clusters.has(c.cluster)) clusters.set(c.cluster, []);
      clusters.get(c.cluster)!.push(i);
    }

    let langScore = 0;
    let langCount = 0;
    for (let i = 0; i < concepts.length; i++) {
      const ci = concepts[i];
      const pos = positions[ci.id]?.[lang];
      if (!pos) continue;

      // a = avg dist to same cluster
      const sameCluster = clusters.get(ci.cluster) || [];
      let a = 0;
      let aCount = 0;
      for (const j of sameCluster) {
        if (j === i) continue;
        const pj = positions[concepts[j].id]?.[lang];
        if (pj) {
          a += euclideanDist(pos, pj);
          aCount++;
        }
      }
      a = aCount > 0 ? a / aCount : 0;

      // b = min avg dist to other clusters
      let b = Infinity;
      for (const [clust, members] of clusters) {
        if (clust === ci.cluster) continue;
        let cDist = 0;
        let cCount = 0;
        for (const j of members) {
          const pj = positions[concepts[j].id]?.[lang];
          if (pj) {
            cDist += euclideanDist(pos, pj);
            cCount++;
          }
        }
        if (cCount > 0) b = Math.min(b, cDist / cCount);
      }
      if (b === Infinity) b = 0;

      const s = a === 0 && b === 0 ? 0 : (b - a) / Math.max(a, b);
      langScore += s;
      langCount++;
    }
    const avg = langCount > 0 ? langScore / langCount : 0;
    result[lang] = Math.round(avg * 1000) / 1000;
    sum += avg;
    count++;
  }
  result.average = Math.round((sum / Math.max(count, 1)) * 1000) / 1000;
  return result;
}

function computeGhostDetection(
  concepts: ConceptStub[],
  positions: Record<string, Record<string, [number, number]>>
): {
  perLanguage: Record<string, { rate: number; expected: number; detected: number }>;
  averageRate: number;
} {
  const perLanguage: Record<string, { rate: number; expected: number; detected: number }> = {};
  let sum = 0;
  let count = 0;

  for (const lang of LANGUAGES) {
    const expected: string[] = [];
    const detected: string[] = [];

    for (const c of concepts) {
      if (c.ghost[lang]) {
        expected.push(c.id);
        // Ghost detection: check if concept is far from cluster centroid
        const clusterConcepts = concepts.filter(
          (cc) => cc.cluster === c.cluster && !cc.ghost[lang]
        );
        if (clusterConcepts.length === 0) {
          detected.push(c.id); // no non-ghost peers = orphan
          continue;
        }
        const centroid: [number, number] = [0, 0];
        let cCount = 0;
        for (const cc of clusterConcepts) {
          const p = positions[cc.id]?.[lang];
          if (p) {
            centroid[0] += p[0];
            centroid[1] += p[1];
            cCount++;
          }
        }
        if (cCount > 0) {
          centroid[0] /= cCount;
          centroid[1] /= cCount;
        }
        const ghostPos = positions[c.id]?.[lang];
        if (ghostPos) {
          const dist = euclideanDist(ghostPos, centroid);
          if (dist > 15) detected.push(c.id); // threshold for "orphaned"
        }
      }
    }

    const rate = expected.length > 0 ? detected.length / expected.length : 1;
    perLanguage[lang] = {
      rate: Math.round(rate * 1000) / 1000,
      expected: expected.length,
      detected: detected.length,
    };
    if (expected.length > 0) {
      sum += rate;
      count++;
    }
  }

  return {
    perLanguage,
    averageRate: Math.round((sum / Math.max(count, 1)) * 1000) / 1000,
  };
}

// ── Generate embedding data for a model ─────────────────────

function generateModelData(
  model: ModelDef,
  baseConcepts: ConceptStub[]
): {
  embedding: object;
  positions: Record<string, Record<string, [number, number]>>;
} {
  const rng = mulberry32(hashStr(model.id));
  const conceptOrder = baseConcepts.map((c) => c.id);
  const conceptData: Record<string, object> = {};
  const modelPositions: Record<string, Record<string, [number, number]>> = {};

  for (const c of baseConcepts) {
    const positions: Record<string, [number, number]> = {};
    const weights: Record<string, number> = {};
    const cosineToEN: Record<string, number> = {};

    for (const lang of LANGUAGES) {
      const langRng = mulberry32(hashStr(model.id + c.id + lang));
      const base = c.positions[lang] || [0, 0];

      // Jitter position
      positions[lang] = [
        base[0] + (langRng() - 0.5) * model.jitterScale * 2,
        base[1] + (langRng() - 0.5) * model.jitterScale * 2,
      ];

      // Perturb weight
      const baseW = c.weights[lang] || 0.5;
      weights[lang] = Math.max(0, Math.min(1, baseW + (langRng() - 0.5) * model.weightNoise * 2));
      weights[lang] = Math.round(weights[lang] * 1000) / 1000;

      // Cosine to EN
      if (lang === "en") {
        cosineToEN[lang] = 1.0;
      } else {
        // Plausible ranges by language family
        const familyBonus =
          {
            de: 0.15,
            fr: 0.1,
            es: 0.1,
            pt: 0.12,
            ru: 0.05,
            zh: -0.05,
            ko: -0.05,
            ar: -0.08,
            ja: -0.03,
          }[lang] || 0;
        cosineToEN[lang] =
          Math.round((0.6 + langRng() * 0.3 + familyBonus) * 1000) / 1000;
      }
    }

    modelPositions[c.id] = positions;
    conceptData[c.id] = { positions, weights, cosineToEN };
  }

  // Compute pairwise distance matrices
  const pairwise: Record<string, number[][]> = {};
  for (const lang of LANGUAGES) {
    const matrix: number[][] = [];
    for (let i = 0; i < baseConcepts.length; i++) {
      const row: number[] = [];
      for (let j = 0; j < baseConcepts.length; j++) {
        if (i === j) {
          row.push(0);
        } else {
          const pi = modelPositions[baseConcepts[i].id]?.[lang] || [0, 0];
          const pj = modelPositions[baseConcepts[j].id]?.[lang] || [0, 0];
          row.push(Math.round(euclideanDist(pi, pj) * 100) / 100);
        }
      }
      matrix.push(row);
    }
    pairwise[lang] = normalizePairwise(matrix);
    // Round for JSON size
    pairwise[lang] = pairwise[lang].map((row) =>
      row.map((v) => Math.round(v * 1000) / 1000)
    );
  }

  const embedding = {
    modelId: model.id,
    modelName: model.name,
    dimension: model.dimension,
    status: "stub",
    concepts: conceptData,
    pairwise,
    conceptOrder,
  };

  return { embedding, positions: modelPositions };
}

// ── Main ────────────────────────────────────────────────────

function main() {
  const outDir = path.resolve(__dirname, "../../src/data/embeddings");

  console.log("Loading concepts from versailles.ts...");
  const baseConcepts = loadConceptsFromSource();
  console.log(`  Found ${baseConcepts.length} concepts`);

  // Generate curated.json (baseline)
  console.log("\nGenerating curated.json...");
  const curatedData: Record<string, object> = {};
  const curatedPositions: Record<string, Record<string, [number, number]>> = {};
  const conceptOrder = baseConcepts.map((c) => c.id);

  for (const c of baseConcepts) {
    curatedPositions[c.id] = c.positions;
    curatedData[c.id] = {
      positions: c.positions,
      weights: Object.fromEntries(
        Object.entries(c.weights).map(([k, v]) => [k, Math.round(v * 1000) / 1000])
      ),
      cosineToEN: Object.fromEntries(LANGUAGES.map((l) => [l, l === "en" ? 1.0 : 0.85])),
    };
  }

  // Curated pairwise
  const curatedPairwise: Record<string, number[][]> = {};
  for (const lang of LANGUAGES) {
    const matrix: number[][] = [];
    for (let i = 0; i < baseConcepts.length; i++) {
      const row: number[] = [];
      for (let j = 0; j < baseConcepts.length; j++) {
        if (i === j) {
          row.push(0);
        } else {
          const pi = baseConcepts[i].positions[lang] || [0, 0];
          const pj = baseConcepts[j].positions[lang] || [0, 0];
          row.push(Math.round(euclideanDist(pi, pj) * 100) / 100);
        }
      }
      matrix.push(row);
    }
    curatedPairwise[lang] = normalizePairwise(matrix).map((row) =>
      row.map((v) => Math.round(v * 1000) / 1000)
    );
  }

  const curatedJSON = {
    modelId: "curated",
    modelName: "Curated (Hand-placed)",
    dimension: 2,
    status: "live",
    concepts: curatedData,
    pairwise: curatedPairwise,
    conceptOrder,
  };
  fs.writeFileSync(path.join(outDir, "curated.json"), JSON.stringify(curatedJSON, null, 2));
  console.log("  ✓ curated.json");

  // Generate model stubs
  const allMetrics: { models: object[] } = { models: [] };

  // Curated metrics
  const curatedMetrics = {
    modelId: "curated",
    clas: computeCLAS(baseConcepts, curatedPositions),
    topology: computeMantel(curatedPairwise),
    silhouette: computeSilhouette(baseConcepts, curatedPositions),
    ghostDetection: computeGhostDetection(baseConcepts, curatedPositions),
  };
  allMetrics.models.push(curatedMetrics);

  for (const model of EMBEDDING_MODELS) {
    console.log(`\nGenerating ${model.id}.json...`);
    const { embedding, positions } = generateModelData(model, baseConcepts);
    fs.writeFileSync(
      path.join(outDir, `${model.id}.json`),
      JSON.stringify(embedding, null, 2)
    );
    console.log(`  ✓ ${model.id}.json`);

    // Compute metrics for this model
    const modelPairwise = (embedding as { pairwise: Record<string, number[][]> }).pairwise;
    const metrics = {
      modelId: model.id,
      clas: computeCLAS(baseConcepts, positions),
      topology: computeMantel(modelPairwise),
      silhouette: computeSilhouette(baseConcepts, positions),
      ghostDetection: computeGhostDetection(baseConcepts, positions),
    };
    allMetrics.models.push(metrics);
  }

  // Write metrics.json
  console.log("\nGenerating metrics.json...");
  fs.writeFileSync(path.join(outDir, "metrics.json"), JSON.stringify(allMetrics, null, 2));
  console.log("  ✓ metrics.json");

  console.log("\n✓ All stubs generated successfully!");
  console.log(`  Output directory: ${outDir}`);
  console.log(`  Files: curated.json, ${EMBEDDING_MODELS.map((m) => m.id + ".json").join(", ")}, metrics.json`);
}

main();
