// Embedding data types, loaders, and barrel exports

export { MODELS, getModel } from "./models";
export type { ModelInfo } from "./models";

// ── Types ────────────────────────────────────────────────────

export interface ConceptEmbedding {
  positions: Record<string, [number, number]>; // lang → [x, z]
  weights: Record<string, number>; // lang → 0-1
  cosineToEN: Record<string, number>; // lang → similarity to EN embedding
  clusters?: Record<string, number>; // lang → cluster label (int, -1=noise)
  lacuna?: Record<string, boolean>; // lang → is lacuna (programmatic)
}

export interface EmbeddingData {
  modelId: string;
  modelName: string;
  dimension: number;
  status: "live" | "stub";
  concepts: Record<string, ConceptEmbedding>; // conceptId → data
  pairwise: Record<string, number[][]>; // lang → 43×43 cosine distance matrix
  conceptOrder: string[]; // row/col index for pairwise matrices
  clusterColors?: Record<string, string>; // cluster label → hex color
}

export interface ModelMetrics {
  modelId: string;
  clas: { pairs: Record<string, number>; average: number };
  topology: {
    pairs: Record<string, { r: number; p: number }>;
    averageR: number;
  };
  silhouette: Record<string, number> & { average: number };
  lacunaDetection: {
    perLanguage: Record<string, { rate: number; expected: number; detected: number }>;
    averageRate: number;
  };
}

export interface AllMetrics {
  models: ModelMetrics[];
}

// ── Loaders ──────────────────────────────────────────────────

const loaders: Record<string, () => Promise<EmbeddingData>> = {
  curated: () => import("./curated.json").then((m) => m.default as unknown as EmbeddingData),
  "bge-m3": () => import("./bge-m3.json").then((m) => m.default as unknown as EmbeddingData),
  "e5-large": () => import("./e5-large.json").then((m) => m.default as unknown as EmbeddingData),
  "mistral-embed": () => import("./mistral-embed.json").then((m) => m.default as unknown as EmbeddingData),
  "cohere-v3": () => import("./cohere-v3.json").then((m) => m.default as unknown as EmbeddingData),
  sonar: () => import("./sonar.json").then((m) => m.default as unknown as EmbeddingData),
  "nv-embed-v2": () => import("./nv-embed-v2.json").then((m) => m.default as unknown as EmbeddingData),
};

export async function loadModelData(modelId: string): Promise<EmbeddingData | null> {
  const loader = loaders[modelId];
  if (!loader) return null;
  return loader();
}

export async function loadMetrics(): Promise<AllMetrics> {
  const m = await import("./metrics.json");
  return m.default as unknown as AllMetrics;
}
