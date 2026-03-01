"use client";

import { useState, useEffect, useRef } from "react";
import { concepts } from "../data/versailles";
import { loadModelData } from "../data/embeddings";
import type { EmbeddingData } from "../data/embeddings";

export interface ModelDataResult {
  positions: Record<string, Record<string, [number, number]>>; // conceptId → lang → [x,z]
  weights: Record<string, Record<string, number>>; // conceptId → lang → 0-1
  source: "curated" | "embedding";
  status: "live" | "stub";
  loading: boolean;
}

// Build curated data once (static, never changes)
let curatedCache: { positions: Record<string, Record<string, [number, number]>>; weights: Record<string, Record<string, number>> } | null = null;

function getCuratedData() {
  if (curatedCache) return curatedCache;
  const positions: Record<string, Record<string, [number, number]>> = {};
  const weights: Record<string, Record<string, number>> = {};
  for (const c of concepts) {
    positions[c.id] = c.position;
    weights[c.id] = c.weight;
  }
  curatedCache = { positions, weights };
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
    return { positions: {}, weights: {}, source: "embedding", status: "stub", loading: true };
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
  for (const [conceptId, cd] of Object.entries(emb.concepts)) {
    const concept = cd as { positions: Record<string, [number, number]>; weights: Record<string, number> };
    positions[conceptId] = concept.positions;
    weights[conceptId] = concept.weights;
  }
  return {
    positions,
    weights,
    source: "embedding",
    status: emb.status as "live" | "stub",
    loading: false,
  };
}
