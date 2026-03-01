"use client";

import { useState, useEffect, useRef } from "react";
import {
  concepts,
  CLUSTER_HEX,
  DYNAMIC_CLUSTER_PALETTE,
  NOISE_CLUSTER_COLOR,
} from "../data/versailles";
import { loadModelData } from "../data/embeddings";
import type { EmbeddingData } from "../data/embeddings";

export interface ModelDataResult {
  positions: Record<string, Record<string, [number, number]>>; // conceptId → lang → [x,z]
  weights: Record<string, Record<string, number>>; // conceptId → lang → 0-1
  clusters: Record<string, Record<string, number | string>>; // conceptId → lang → cluster label
  lacunae: Record<string, Record<string, boolean>>; // conceptId → lang → isLacuna
  clusterColors: Record<string, string>; // cluster label → hex color
  source: "curated" | "embedding";
  status: "live" | "stub";
  loading: boolean;
}

// Curated cluster name → numeric index mapping
const CURATED_CLUSTER_INDEX: Record<string, number> = {
  core: 0,
  justice: 1,
  victory: 2,
  humiliation: 3,
  "lacuna-de": 4,
  "lacuna-en": 5,
};

// Build curated data once (static, never changes)
let curatedCache: {
  positions: Record<string, Record<string, [number, number]>>;
  weights: Record<string, Record<string, number>>;
  clusters: Record<string, Record<string, number | string>>;
  lacunae: Record<string, Record<string, boolean>>;
  clusterColors: Record<string, string>;
} | null = null;

function getCuratedData() {
  if (curatedCache) return curatedCache;
  const positions: Record<string, Record<string, [number, number]>> = {};
  const weights: Record<string, Record<string, number>> = {};
  const clusters: Record<string, Record<string, number | string>> = {};
  const lacunae: Record<string, Record<string, boolean>> = {};

  for (const c of concepts) {
    positions[c.id] = c.position;
    weights[c.id] = c.weight;
    // For curated: cluster is the same string for all languages
    const clusterMap: Record<string, string> = {};
    const lacunaMap: Record<string, boolean> = {};
    for (const lang of Object.keys(c.position)) {
      clusterMap[lang] = c.cluster;
      lacunaMap[lang] = c.lacuna[lang] ?? false;
    }
    clusters[c.id] = clusterMap;
    lacunae[c.id] = lacunaMap;
  }

  // Build curated cluster colors (string keys)
  const clusterColors: Record<string, string> = { ...CLUSTER_HEX };

  curatedCache = { positions, weights, clusters, lacunae, clusterColors };
  return curatedCache;
}

// Cache loaded embedding data to avoid re-importing
const embeddingCache = new Map<string, EmbeddingData>();

export function useModelData(modelId: string): ModelDataResult {
  const [data, setData] = useState<ModelDataResult>(() => {
    if (modelId === "curated") {
      const curated = getCuratedData();
      return { ...curated, source: "curated", status: "live", loading: false };
    }
    // Start loading
    return {
      positions: {},
      weights: {},
      clusters: {},
      lacunae: {},
      clusterColors: {},
      source: "embedding",
      status: "stub",
      loading: true,
    };
  });

  const currentModelRef = useRef(modelId);

  useEffect(() => {
    currentModelRef.current = modelId;

    if (modelId === "curated") {
      const curated = getCuratedData();
      setData({ ...curated, source: "curated", status: "live", loading: false });
      return;
    }

    // Check cache first
    const cached = embeddingCache.get(modelId);
    if (cached) {
      setData(extractFromEmbedding(cached));
      return;
    }

    // Load async
    setData((prev) => ({ ...prev, loading: true }));
    loadModelData(modelId).then((result) => {
      if (currentModelRef.current !== modelId) return; // stale
      if (!result) {
        // Fallback to curated
        const curated = getCuratedData();
        setData({ ...curated, source: "curated", status: "live", loading: false });
        return;
      }
      embeddingCache.set(modelId, result);
      setData(extractFromEmbedding(result));
    });
  }, [modelId]);

  return data;
}

function extractFromEmbedding(emb: EmbeddingData): ModelDataResult {
  const positions: Record<string, Record<string, [number, number]>> = {};
  const weights: Record<string, Record<string, number>> = {};
  const clusters: Record<string, Record<string, number | string>> = {};
  const lacunae: Record<string, Record<string, boolean>> = {};

  for (const [conceptId, cd] of Object.entries(emb.concepts)) {
    const concept = cd as {
      positions: Record<string, [number, number]>;
      weights: Record<string, number>;
      clusters?: Record<string, number>;
      lacuna?: Record<string, boolean>;
    };
    positions[conceptId] = concept.positions;
    weights[conceptId] = concept.weights;

    if (concept.clusters) {
      clusters[conceptId] = concept.clusters;
    }
    if (concept.lacuna) {
      lacunae[conceptId] = concept.lacuna;
    }
  }

  // Build cluster colors from embedding data or default palette
  const clusterColors: Record<string, string> = {};
  if (emb.clusterColors) {
    Object.assign(clusterColors, emb.clusterColors);
  } else {
    // Collect all unique cluster labels and assign palette colors
    const labels = new Set<number>();
    for (const cc of Object.values(clusters)) {
      for (const label of Object.values(cc)) {
        if (typeof label === "number") labels.add(label);
      }
    }
    for (const label of labels) {
      if (label < 0) {
        clusterColors[String(label)] = NOISE_CLUSTER_COLOR;
      } else {
        clusterColors[String(label)] = DYNAMIC_CLUSTER_PALETTE[label % DYNAMIC_CLUSTER_PALETTE.length];
      }
    }
  }

  return {
    positions,
    weights,
    clusters,
    lacunae,
    clusterColors,
    source: "embedding",
    status: emb.status as "live" | "stub",
    loading: false,
  };
}
