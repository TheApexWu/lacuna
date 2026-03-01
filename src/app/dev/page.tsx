"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useCallback } from "react";
import { CLUSTER_HEX, type Concept } from "../../data/versailles";

const DevTerrain = dynamic(() => import("../../components/DevTerrain"), {
  ssr: false,
});

interface Dataset {
  id: string;
  name: string;
  path: string;
  source: string;
}

interface ModelInfo {
  key: string;
  name: string;
  dimensions: number;
  type: string;
  notes: string;
  available: boolean;
  hasData: boolean;
}

interface BenchmarkMetrics {
  model_key: string;
  clas: { score: number; per_concept: Record<string, number> };
  topology: { preservation: number; p_value: number };
  cluster_coherence: { per_cluster: Record<string, Record<string, number>>; average: number };
  ghost_detection: { rate: number; per_ghost: Record<string, Record<string, number>> };
}

interface CachedData {
  concepts: Concept[];
  hash: string;
  timestamp: number;
}

// Simple hash function for cache invalidation
function hashData(data: unknown): string {
  const str = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

// Normalize positions across all languages to fit terrain
// Uses global bounds so language switching is coherent
function normalizePositions(concepts: Concept[], targetRange = 40): Concept[] {
  if (concepts.length === 0) return concepts;

  // Find global bounds across ALL languages
  let minX = Infinity, maxX = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  for (const concept of concepts) {
    for (const lang of Object.keys(concept.position)) {
      const [x, z] = concept.position[lang];
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
    }
  }

  // Calculate scale to fit within targetRange while preserving aspect ratio
  const rangeX = maxX - minX || 1;
  const rangeZ = maxZ - minZ || 1;
  const maxRange = Math.max(rangeX, rangeZ);
  const scale = (targetRange * 2) / maxRange;

  // Center offsets
  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;

  // Apply normalization to all concepts
  return concepts.map((concept) => {
    const newPosition: Record<string, [number, number]> = {};
    for (const [lang, pos] of Object.entries(concept.position)) {
      const [x, z] = pos as [number, number];
      newPosition[lang] = [(x - centerX) * scale, (z - centerZ) * scale];
    }
    return { ...concept, position: newPosition };
  });
}

const CACHE_KEY = "lacuna_dev_cache";
const CACHE_MAX_AGE = 1000 * 60 * 60; // 1 hour

export default function DevPage() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [metrics, setMetrics] = useState<BenchmarkMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState("en");
  const [showGhosts, setShowGhosts] = useState(false);
  const [selectedConcept, setSelectedConcept] = useState<string | null>(null);
  const [cacheStatus, setCacheStatus] = useState<string>("");
  const [showMetrics, setShowMetrics] = useState(true);

  // Load available models on mount
  useEffect(() => {
    fetch("/api/concepts?action=list-models")
      .then((r) => r.json())
      .then((data) => {
        setModels(data.models || []);
      })
      .catch((e) => console.error("Failed to load models:", e));
  }, []);

  // Load available datasets on mount
  useEffect(() => {
    fetch("/api/concepts?action=list")
      .then((r) => r.json())
      .then((data) => {
        setDatasets(data.datasets || []);
        // Auto-select first dataset
        if (data.datasets?.length > 0) {
          setSelectedDataset(data.datasets[0].path);
        }
      })
      .catch((e) => setError("Failed to load datasets"));
  }, []);

  // Load concepts when model changes (takes priority over dataset)
  useEffect(() => {
    if (!selectedModel) return;

    const loadModelData = async () => {
      setLoading(true);
      setError(null);
      setMetrics(null);

      try {
        const response = await fetch(
          `/api/concepts?action=load-model&model=${encodeURIComponent(selectedModel)}`
        );
        const data = await response.json();

        if (data.error) {
          throw new Error(data.error);
        }

        // Normalize concepts
        const typedConcepts: Concept[] = data.concepts.map((c: Record<string, unknown>) => ({
          ...c,
          source: (c.source === "curated" ? "curated" : "embedding") as "curated" | "embedding",
          ghost: c.lacuna || c.ghost || {},
          weight: c.weight || {},
        })) as Concept[];

        const normalizedConcepts = normalizePositions(typedConcepts);
        setConcepts(normalizedConcepts);

        // Set metrics if available
        if (data.metrics) {
          setMetrics(data.metrics);
        }

        setCacheStatus(`Loaded ${selectedModel} (${data.count} concepts)`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load model data");
      } finally {
        setLoading(false);
      }
    };

    loadModelData();
  }, [selectedModel]);

  // Load concepts when dataset changes (only if no model selected)
  useEffect(() => {
    if (!selectedDataset || selectedModel) return;

    const loadData = async () => {
      setLoading(true);
      setError(null);
      setMetrics(null);

      try {
        // Fetch fresh data from server
        const response = await fetch(
          `/api/concepts?action=load&file=${encodeURIComponent(selectedDataset)}`
        );
        const data = await response.json();

        if (data.error) {
          throw new Error(data.error);
        }

        const freshHash = hashData(data.concepts);

        // Check cache
        const cacheKey = `${CACHE_KEY}_${selectedDataset}`;
        const cached = localStorage.getItem(cacheKey);

        if (cached) {
          try {
            const cachedData: CachedData = JSON.parse(cached);
            const age = Date.now() - cachedData.timestamp;

            // Use cache if hash matches and not expired
            if (cachedData.hash === freshHash && age < CACHE_MAX_AGE) {
              setConcepts(cachedData.concepts);
              setCacheStatus(`Loaded from cache (${Math.round(age / 1000)}s ago)`);
              setLoading(false);
              return;
            } else if (cachedData.hash !== freshHash) {
              setCacheStatus("Data changed - regenerating");
            } else {
              setCacheStatus("Cache expired - reloading");
            }
          } catch {
            // Invalid cache, ignore
          }
        }

        // Normalize concepts to match Concept type
        const typedConcepts: Concept[] = data.concepts.map((c: Record<string, unknown>) => ({
          ...c,
          source: (c.source === "curated" ? "curated" : "embedding") as "curated" | "embedding",
          ghost: c.lacuna || c.ghost || {},
          weight: c.weight || {},
        })) as Concept[];

        // Normalize positions across all languages for consistent visualization
        const normalizedConcepts = normalizePositions(typedConcepts);

        // Store in cache
        const cacheData: CachedData = {
          concepts: normalizedConcepts,
          hash: freshHash,
          timestamp: Date.now(),
        };
        localStorage.setItem(cacheKey, JSON.stringify(cacheData));

        setConcepts(normalizedConcepts);
        setCacheStatus(`Loaded fresh (${data.count} concepts)`);

        // Set metrics if available (for benchmark datasets)
        if (data.metrics) {
          setMetrics(data.metrics);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load concepts");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [selectedDataset, selectedModel]);

  // Get available languages from loaded concepts
  const availableLanguages = concepts.length > 0
    ? Object.keys(concepts[0].position)
    : ["en"];

  // Clear cache for current dataset
  const clearCache = useCallback(() => {
    if (selectedDataset) {
      localStorage.removeItem(`${CACHE_KEY}_${selectedDataset}`);
      setCacheStatus("Cache cleared");
      // Trigger reload
      setSelectedDataset("");
      setTimeout(() => setSelectedDataset(selectedDataset), 100);
    }
  }, [selectedDataset]);

  // Get cluster distribution
  const clusterCounts = concepts.reduce((acc, c) => {
    acc[c.cluster] = (acc[c.cluster] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Models with data available
  const modelsWithData = models.filter((m) => m.hasData);

  return (
    <div className="flex h-screen bg-[#0a0a0a]">
      {/* Sidebar */}
      <div className="w-80 border-r border-[#262626] p-4 flex flex-col gap-4 overflow-y-auto">
        <div>
          <h1 className="text-lg font-bold text-[#e5e5e5] tracking-wide">
            LACUNA DEV
          </h1>
          <p className="text-xs text-[#737373] mt-1">Multi-Model Embedding Benchmark</p>
        </div>

        {/* Model selector */}
        {modelsWithData.length > 0 && (
          <div>
            <label className="text-xs text-[#737373] block mb-1">
              Embedding Model
              <span className="text-[#525252] ml-1">({modelsWithData.length} benchmarked)</span>
            </label>
            <select
              value={selectedModel}
              onChange={(e) => {
                setSelectedModel(e.target.value);
                if (e.target.value) {
                  setSelectedDataset(""); // Clear dataset when model selected
                }
              }}
              className="w-full bg-[#1a1a1a] border border-[#333] text-[#e5e5e5] text-sm px-3 py-2 rounded"
            >
              <option value="">Select model...</option>
              {modelsWithData.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.name}
                </option>
              ))}
            </select>
            {selectedModel && (
              <p className="text-xs text-[#525252] mt-1">
                {models.find((m) => m.key === selectedModel)?.notes}
              </p>
            )}
          </div>
        )}

        {/* Dataset selector */}
        <div>
          <label className="text-xs text-[#737373] block mb-1">Dataset</label>
          <select
            value={selectedDataset}
            onChange={(e) => {
              setSelectedDataset(e.target.value);
              if (e.target.value) {
                setSelectedModel(""); // Clear model when dataset selected
              }
            }}
            className="w-full bg-[#1a1a1a] border border-[#333] text-[#e5e5e5] text-sm px-3 py-2 rounded"
          >
            <option value="">Select dataset...</option>
            {datasets.map((d) => (
              <option key={d.id} value={d.path}>
                {d.name} ({d.source})
              </option>
            ))}
          </select>
        </div>

        {/* Language selector */}
        <div>
          <label className="text-xs text-[#737373] block mb-1">Language</label>
          <div className="flex gap-2">
            {availableLanguages.map((lang) => (
              <button
                key={lang}
                onClick={() => setLanguage(lang)}
                className={`px-3 py-1 text-xs font-bold tracking-wider rounded border transition-all ${
                  language === lang
                    ? "border-[#3b82f6] text-[#3b82f6] bg-[#3b82f6]/10"
                    : "border-[#333] text-[#737373] hover:border-[#555]"
                }`}
              >
                {lang.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Ghost toggle */}
        <div>
          <button
            onClick={() => setShowGhosts((g) => !g)}
            className={`w-full px-3 py-2 text-xs tracking-wider rounded border transition-all ${
              showGhosts
                ? "border-[#78716c] text-[#e5e5e5] bg-[#78716c]/15"
                : "border-[#333] text-[#737373]"
            }`}
          >
            {showGhosts ? "HIDE GHOSTS" : "SHOW GHOSTS"}
          </button>
        </div>

        {/* Metrics panel */}
        {metrics && (
          <div className="border-t border-[#262626] pt-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs text-[#737373]">Benchmark Metrics</h3>
              <button
                onClick={() => setShowMetrics((s) => !s)}
                className="text-xs text-[#525252] hover:text-[#737373]"
              >
                {showMetrics ? "Hide" : "Show"}
              </button>
            </div>
            {showMetrics && (
              <div className="space-y-2 text-xs">
                <div className="bg-[#1a1a1a] rounded p-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[#a3a3a3]">CLAS</span>
                    <span className={`font-mono ${metrics.clas.score > 0.8 ? "text-[#ef4444]" : metrics.clas.score > 0.6 ? "text-[#f59e0b]" : "text-[#22c55e]"}`}>
                      {metrics.clas.score.toFixed(4)}
                    </span>
                  </div>
                  <p className="text-[#525252] text-[10px] mt-1">
                    Cross-lingual alignment (lower = preserves differences)
                  </p>
                </div>

                <div className="bg-[#1a1a1a] rounded p-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[#a3a3a3]">Topology</span>
                    <span className={`font-mono ${metrics.topology.preservation > 0.7 ? "text-[#22c55e]" : metrics.topology.preservation > 0.4 ? "text-[#f59e0b]" : "text-[#ef4444]"}`}>
                      {metrics.topology.preservation.toFixed(4)}
                    </span>
                  </div>
                  <p className="text-[#525252] text-[10px] mt-1">
                    Structure preservation across languages
                  </p>
                </div>

                <div className="bg-[#1a1a1a] rounded p-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[#a3a3a3]">Coherence</span>
                    <span className={`font-mono ${metrics.cluster_coherence.average > 0.3 ? "text-[#22c55e]" : metrics.cluster_coherence.average > 0 ? "text-[#f59e0b]" : "text-[#ef4444]"}`}>
                      {metrics.cluster_coherence.average.toFixed(4)}
                    </span>
                  </div>
                  <p className="text-[#525252] text-[10px] mt-1">
                    Cluster silhouette score
                  </p>
                </div>

                <div className="bg-[#1a1a1a] rounded p-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[#a3a3a3]">Ghost Detection</span>
                    <span className={`font-mono ${metrics.ghost_detection.rate > 0.5 ? "text-[#22c55e]" : metrics.ghost_detection.rate > 0.2 ? "text-[#f59e0b]" : "text-[#ef4444]"}`}>
                      {(metrics.ghost_detection.rate * 100).toFixed(1)}%
                    </span>
                  </div>
                  <p className="text-[#525252] text-[10px] mt-1">
                    Lacunae correctly identified
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Stats */}
        {concepts.length > 0 && (
          <div className="border-t border-[#262626] pt-4">
            <h3 className="text-xs text-[#737373] mb-2">Stats</h3>
            <div className="text-sm text-[#e5e5e5] space-y-1">
              <div className="flex justify-between">
                <span>Concepts</span>
                <span className="text-[#f59e0b]">{concepts.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Languages</span>
                <span className="text-[#3b82f6]">{availableLanguages.length}</span>
              </div>
            </div>

            <h3 className="text-xs text-[#737373] mt-4 mb-2">Clusters</h3>
            <div className="space-y-1">
              {Object.entries(clusterCounts).map(([cluster, count]) => (
                <div key={cluster} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ background: CLUSTER_HEX[cluster] || "#78716c" }}
                    />
                    <span className="text-[#a3a3a3]">{cluster}</span>
                  </div>
                  <span className="text-[#737373]">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cache controls */}
        <div className="border-t border-[#262626] pt-4 mt-auto">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#737373]">Cache</span>
            <button
              onClick={clearCache}
              className="text-xs text-[#ef4444] hover:text-[#f87171]"
            >
              Clear
            </button>
          </div>
          {cacheStatus && (
            <p className="text-xs text-[#525252] mt-1">{cacheStatus}</p>
          )}
        </div>

        {/* Error display */}
        {error && (
          <div className="bg-[#ef4444]/10 border border-[#ef4444]/30 rounded p-2">
            <p className="text-xs text-[#ef4444]">{error}</p>
          </div>
        )}
      </div>

      {/* Main visualization area */}
      <div className="flex-1 relative">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0a]">
            <div className="text-[#737373] text-sm">Loading...</div>
          </div>
        ) : (
          <DevTerrain
            concepts={concepts}
            language={language}
            showGhosts={showGhosts}
            onConceptClick={setSelectedConcept}
          />
        )}

        {/* Selected concept info */}
        {selectedConcept && concepts.length > 0 && (
          <div className="absolute top-4 right-4 bg-[#0a0a0a]/90 border border-[#262626] rounded-lg p-4 max-w-xs">
            <button
              onClick={() => setSelectedConcept(null)}
              className="absolute top-2 right-2 text-[#737373] hover:text-[#e5e5e5]"
            >
              ×
            </button>
            {(() => {
              const c = concepts.find((c) => c.id === selectedConcept);
              if (!c) return null;
              return (
                <>
                  <h3 className="text-sm font-bold text-[#e5e5e5]">
                    {c.labels[language] || c.id}
                  </h3>
                  <p className="text-xs text-[#737373] mt-1">{c.id}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ background: CLUSTER_HEX[c.cluster] || "#78716c" }}
                    />
                    <span className="text-xs text-[#a3a3a3]">{c.cluster}</span>
                  </div>
                  {c.definitions?.[language] && (
                    <p className="text-xs text-[#a3a3a3] mt-2 leading-relaxed">
                      {c.definitions[language]}
                    </p>
                  )}
                  <div className="mt-2 text-xs text-[#525252]">
                    pos: [{c.position[language]?.map((n) => n.toFixed(1)).join(", ")}]
                  </div>
                  {/* Show CLAS for this concept if metrics available */}
                  {metrics?.clas?.per_concept?.[c.id] !== undefined && (
                    <div className="mt-2 text-xs">
                      <span className="text-[#525252]">CLAS: </span>
                      <span className={`font-mono ${metrics.clas.per_concept[c.id] > 0.9 ? "text-[#ef4444]" : "text-[#22c55e]"}`}>
                        {metrics.clas.per_concept[c.id].toFixed(4)}
                      </span>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
