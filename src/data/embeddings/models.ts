// Model registry for LACUNA embedding benchmark framework

export interface ModelInfo {
  id: string;
  name: string;
  shortName: string;
  dimension: number;
  provider: "local" | "api";
  status: "live" | "stub" | "planned";
  description: string;
}

export const MODELS: ModelInfo[] = [
  {
    id: "curated",
    name: "Curated (Hand-placed)",
    shortName: "CURATED",
    dimension: 2,
    provider: "local",
    status: "live",
    description: "Hand-curated concept positions from domain expertise",
  },
  {
    id: "bge-m3",
    name: "BGE-M3",
    shortName: "BGE-M3",
    dimension: 1024,
    provider: "local",
    status: "stub",
    description: "BAAI General Embedding M3 — dense+sparse+ColBERT, 100+ languages",
  },
  {
    id: "e5-large",
    name: "multilingual-e5-large",
    shortName: "E5-L",
    dimension: 1024,
    provider: "local",
    status: "stub",
    description: "Microsoft E5 Large — contrastive multilingual embeddings",
  },
  {
    id: "mistral-embed",
    name: "Mistral Embed",
    shortName: "MISTRAL",
    dimension: 1024,
    provider: "api",
    status: "stub",
    description: "Mistral AI embedding endpoint",
  },
  {
    id: "cohere-v3",
    name: "Cohere embed-v3",
    shortName: "COHERE",
    dimension: 1024,
    provider: "api",
    status: "stub",
    description: "Cohere embed-multilingual-v3.0",
  },
  {
    id: "sonar",
    name: "SONAR (Meta)",
    shortName: "SONAR",
    dimension: 1024,
    provider: "local",
    status: "stub",
    description: "Meta SONAR — 200+ languages, sentence-level cross-lingual",
  },
  {
    id: "nv-embed-v2",
    name: "NV-Embed-v2",
    shortName: "NV-EMB",
    dimension: 4096,
    provider: "local",
    status: "stub",
    description: "NVIDIA NV-Embed v2 — 4096-dim decoder architecture",
  },
];

export function getModel(id: string): ModelInfo | undefined {
  return MODELS.find((m) => m.id === id);
}
