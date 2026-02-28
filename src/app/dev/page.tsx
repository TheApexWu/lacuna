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

const CACHE_KEY = "lacuna_dev_cache";
const CACHE_MAX_AGE = 1000 * 60 * 60; // 1 hour

export default function DevPage() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<string>("");
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState("en");
  const [showGhosts, setShowGhosts] = useState(false);
  const [selectedConcept, setSelectedConcept] = useState<string | null>(null);
  const [cacheStatus, setCacheStatus] = useState<string>("");

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

  // Load concepts when dataset changes
  useEffect(() => {
    if (!selectedDataset) return;

    const loadData = async () => {
      setLoading(true);
      setError(null);

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
        const normalizedConcepts: Concept[] = data.concepts.map((c: Record<string, unknown>) => ({
          ...c,
          source: (c.source === "curated" ? "curated" : "embedding") as "curated" | "embedding",
          ghost: c.ghost || {},
          weight: c.weight || {},
        })) as Concept[];

        // Store in cache
        const cacheData: CachedData = {
          concepts: normalizedConcepts,
          hash: freshHash,
          timestamp: Date.now(),
        };
        localStorage.setItem(cacheKey, JSON.stringify(cacheData));

        setConcepts(normalizedConcepts);
        setCacheStatus(`Loaded fresh (${data.count} concepts)`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load concepts");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [selectedDataset]);

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

  return (
    <div className="flex h-screen bg-[#0a0a0a]">
      {/* Sidebar */}
      <div className="w-80 border-r border-[#262626] p-4 flex flex-col gap-4 overflow-y-auto">
        <div>
          <h1 className="text-lg font-bold text-[#e5e5e5] tracking-wide">
            LACUNA DEV
          </h1>
          <p className="text-xs text-[#737373] mt-1">Pipeline Test Visualizer</p>
        </div>

        {/* Dataset selector */}
        <div>
          <label className="text-xs text-[#737373] block mb-1">Dataset</label>
          <select
            value={selectedDataset}
            onChange={(e) => setSelectedDataset(e.target.value)}
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
                </>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
