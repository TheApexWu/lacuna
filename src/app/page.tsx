"use client";

import dynamic from "next/dynamic";
import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import ConceptCard from "../components/ConceptCard";
import ButterflyChart from "../components/ButterflyChart";
import ConceptNetworkGraph from "../components/ConceptNetworkGraph";
import ModelSelector from "../components/ModelSelector";
import ModelMetricsPanel from "../components/ModelMetricsPanel";
import ModelAgreementHeatmap from "../components/ModelAgreementHeatmap";
import ConnectionCard from "../components/ConnectionCard";
import ClusterEditor from "../components/ClusterEditor";
import { CLUSTER_HEX, LANGUAGES, DYNAMIC_CLUSTER_PALETTE, concepts } from "../data/versailles";
import { useModelData } from "../hooks/useModelData";
import { getModel } from "../data/embeddings/models";
import { Leva } from "leva";

// DO NOT use SSR for Three.js
const TopologyTerrain = dynamic(
  () => import("../components/TopologyTerrain"),
  { ssr: false }
);

const CURATED_LEGEND = [
  { cluster: "core", label: "Core" },
  { cluster: "justice", label: "Justice" },
  { cluster: "victory", label: "Victory" },
  { cluster: "humiliation", label: "Humiliation" },
  { cluster: "lacuna-de", label: "Lacuna (DE)" },
  { cluster: "lacuna-en", label: "Lacuna (EN)" },
];

const DEMO_PROBES = [
  {
    label: "Art. 231",
    desc: "War Guilt Clause, 1919",
    lang_a: "en",
    lang_b: "de",
    text: "The Allied and Associated Governments affirm and Germany accepts the responsibility of Germany and her allies for causing all the loss and damage to which the Allied and Associated Governments and their nationals have been subjected as a consequence of the war imposed upon them by the aggression of Germany and her allies.",
  },
  {
    label: "Nanking",
    desc: "Treaty of Nanking, 1842",
    lang_a: "en",
    lang_b: "zh",
    text: "Her Majesty the Queen of the United Kingdom of Great Britain and Ireland and the Emperor of China agree that the Island of Hong Kong shall be ceded to Her Britannic Majesty, and shall be possessed in perpetuity.",
  },
  {
    label: "Potsdam",
    desc: "Potsdam Declaration, 1945",
    lang_a: "en",
    lang_b: "ja",
    text: "We call upon the Government of Japan to proclaim the unconditional surrender of all Japanese armed forces. The alternative for Japan is prompt and utter destruction.",
  },
  {
    label: "Sykes-Picot",
    desc: "Sykes-Picot Agreement, 1916",
    lang_a: "en",
    lang_b: "ar",
    text: "France and Great Britain are prepared to recognize and protect an independent Arab state or a confederation of Arab states under the suzerainty of an Arab chief.",
  },
  {
    label: "38th Parallel",
    desc: "Korean Partition, 1945",
    lang_a: "en",
    lang_b: "ko",
    text: "The Soviet Union shall occupy the area north of the 38th parallel and the United States shall occupy the area south of the 38th parallel for the purpose of accepting the surrender of Japanese forces.",
  },
];

export default function Home() {
  const [language, setLanguage] = useState("en");
  const [showLacunae, setShowLacunae] = useState(false);
  const [selectedConcept, setSelectedConcept] = useState<string | null>(null);
  const [subtitle, setSubtitle] = useState<string | null>(null);
  const [hasFlipped, setHasFlipped] = useState(false);
  const [showButterfly, setShowButterfly] = useState(false);
  const [showNetwork, setShowNetwork] = useState(false);
  const [showMetrics, setShowMetrics] = useState(false);
  const [showAgreement, setShowAgreement] = useState(false);
  const [showConnections, setShowConnections] = useState(false);
  const [activeModel, setActiveModel] = useState("curated");
  const [showClusterEditor, setShowClusterEditor] = useState(false);
  const [showQuery, setShowQuery] = useState(true);
  const [showMore, setShowMore] = useState(false);

  // Explicit query language pair (user can override)
  const [queryLangAOverride, setQueryLangAOverride] = useState<string | null>(null);
  const [queryLangBOverride, setQueryLangBOverride] = useState<string | null>(null);

  // Query probe state
  type QueryActivation = {
    conceptId: string;
    divergence: number;
    direction: string;
    [key: string]: string | number;
  };
  type QueryResult = {
    query: string;
    lang_a: string;
    lang_b: string;
    activations: QueryActivation[];
  };
  const [queryText, setQueryText] = useState("");
  const [queryResults, setQueryResults] = useState<QueryResult | null>(null);
  const [querying, setQuerying] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);
  const queryInputRef = useRef<HTMLInputElement>(null);

  // Cluster editor state: user overrides layered on top of model data
  const [clusterEdits, setClusterEdits] = useState<
    Record<string, Record<string, string>>
  >({});
  const [colorEdits, setColorEdits] = useState<Record<string, string>>({});
  const [customClusters, setCustomClusters] = useState<string[]>([]);

  const modelData = useModelData(activeModel);
  const modelInfo = getModel(activeModel);

  const isEmbedding = activeModel !== "curated";
  const hasClusterEdits =
    Object.keys(clusterEdits).length > 0 ||
    Object.keys(colorEdits).length > 0 ||
    customClusters.length > 0;

  // Clear cluster edits when switching models
  useEffect(() => {
    setClusterEdits({});
    setColorEdits({});
    setCustomClusters([]);
  }, [activeModel]);

  // Merge model clusters with user edits
  const effectiveClusters = useMemo(() => {
    if (!hasClusterEdits && !isEmbedding) return undefined;
    const result: Record<string, Record<string, number | string>> = {};
    for (const [cid, langMap] of Object.entries(modelData.clusters)) {
      result[cid] = { ...langMap };
    }
    for (const [cid, langMap] of Object.entries(clusterEdits)) {
      if (!result[cid]) result[cid] = {};
      result[cid] = { ...result[cid], ...langMap };
    }
    return Object.keys(result).length > 0 ? result : undefined;
  }, [modelData.clusters, clusterEdits, hasClusterEdits, isEmbedding]);

  // Merge model cluster colors with user edits + custom clusters
  const effectiveClusterColors = useMemo(() => {
    const result: Record<string, string> = { ...modelData.clusterColors };
    for (const label of customClusters) {
      if (!result[label]) {
        const idx = Object.keys(result).length;
        result[label] =
          DYNAMIC_CLUSTER_PALETTE[idx % DYNAMIC_CLUSTER_PALETTE.length];
      }
    }
    Object.assign(result, colorEdits);
    return result;
  }, [modelData.clusterColors, colorEdits, customClusters]);

  const legendItems = useMemo(() => {
    if (!isEmbedding && !hasClusterEdits) {
      return CURATED_LEGEND.map((item) => ({
        key: item.cluster,
        label: item.label,
        color: effectiveClusterColors[item.cluster] || CLUSTER_HEX[item.cluster] || "#78716c",
      }));
    }
    // Collect all cluster labels actually in use
    const labelsInUse = new Set<string>();
    const source = effectiveClusters ?? modelData.clusters;
    for (const langMap of Object.values(source)) {
      for (const label of Object.values(langMap)) {
        labelsInUse.add(String(label));
      }
    }
    for (const label of customClusters) labelsInUse.add(label);

    return Array.from(labelsInUse)
      .sort((a, b) => {
        const aN = Number(a), bN = Number(b);
        if (isNaN(aN) && isNaN(bN)) return a.localeCompare(b);
        if (isNaN(aN)) return -1;
        if (isNaN(bN)) return 1;
        if (aN < 0) return 1;
        if (bN < 0) return -1;
        return aN - bN;
      })
      .map((label) => {
        const n = Number(label);
        const displayName = isNaN(n)
          ? label.charAt(0).toUpperCase() + label.slice(1)
          : n < 0
            ? "Noise"
            : `Cluster ${label}`;
        return {
          key: label,
          label: displayName,
          color: effectiveClusterColors[label] || "#78716c",
        };
      });
  }, [isEmbedding, hasClusterEdits, effectiveClusters, modelData.clusters, effectiveClusterColors, customClusters]);

  const handleLanguageSelect = useCallback(
    (code: string) => {
      if (code === language) return;
      setLanguage(code);

      if (!hasFlipped && code === "de") {
        setHasFlipped(true);
        setTimeout(() => {
          setSubtitle("This topology gap started a world war");
        }, 800);
        setTimeout(() => {
          setSubtitle(null);
        }, 3200);
      }
    },
    [language, hasFlipped]
  );

  const handleConceptClick = useCallback((id: string) => {
    setSelectedConcept(id);
  }, []);

  const handleAssignCluster = useCallback(
    (conceptId: string, newCluster: string, allLanguages: boolean) => {
      setClusterEdits((prev) => {
        const next = { ...prev };
        if (allLanguages) {
          const concept = concepts.find((c) => c.id === conceptId);
          if (concept) {
            const langMap: Record<string, string> = {};
            for (const lang of Object.keys(concept.position)) {
              langMap[lang] = newCluster;
            }
            next[conceptId] = { ...(prev[conceptId] || {}), ...langMap };
          }
        } else {
          next[conceptId] = { ...(prev[conceptId] || {}), [language]: newCluster };
        }
        return next;
      });
    },
    [language]
  );

  const handleClusterColorChange = useCallback(
    (label: string, color: string) => {
      setColorEdits((prev) => ({ ...prev, [label]: color }));
    },
    []
  );

  const handleAddCluster = useCallback(
    (label: string, color: string) => {
      setCustomClusters((prev) => [...prev, label]);
      setColorEdits((prev) => ({ ...prev, [label]: color }));
    },
    []
  );

  const handleResetClusters = useCallback(() => {
    setClusterEdits({});
    setColorEdits({});
    setCustomClusters([]);
  }, []);

  const queryLangA = queryLangAOverride || language;
  const queryLangB = queryLangBOverride || (language === "en" ? "de" : "en");

  const fireProbe = useCallback(async (text: string, langA: string, langB: string) => {
    if (!text.trim() || querying) return;
    setQueryText(text);
    setQueryLangAOverride(langA);
    setQueryLangBOverride(langB);
    setQuerying(true);
    setQueryError(null);

    // Switch terrain to lang_b so the audience sees the landscape shift
    if (language !== langB) {
      setLanguage(langB);
    }

    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim(),
          lang_a: langA,
          lang_b: langB,
        }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || `HTTP ${res.status}`);
      }
      setQueryResults(await res.json());
    } catch (err) {
      setQueryError(err instanceof Error ? err.message : "Query failed");
    } finally {
      setQuerying(false);
    }
  }, [querying, language]);

  const handleProbe = useCallback(() => {
    fireProbe(queryText, queryLangA, queryLangB);
  }, [fireProbe, queryText, queryLangA, queryLangB]);

  const handleClearQuery = useCallback(() => {
    setQueryText("");
    setQueryResults(null);
    setQueryError(null);
    setQueryLangAOverride(null);
    setQueryLangBOverride(null);
    setLanguage("en");
    queryInputRef.current?.focus();
  }, []);

  // Highlight top 10 concepts by divergence
  // Filter out lacuna concepts when their home language isn't in the probe
  const highlightedConcepts = useMemo(() => {
    if (!queryResults) return undefined;
    const { lang_a, lang_b } = queryResults;
    const probeLangs = new Set([lang_a, lang_b]);

    // German-only lacuna concepts should only highlight when DE is in the probe
    const lacunaHomeLangs: Record<string, string> = {
      dolchstoss: "de", schmach: "de", diktat: "de", kriegsschuld: "de", volkszorn: "de",
    };

    const filtered = queryResults.activations.filter((act) => {
      const home = lacunaHomeLangs[act.conceptId];
      if (home && !probeLangs.has(home)) return false;
      return true;
    });

    const top = filtered.slice(0, 10);
    const result: Record<string, { similarity: number; divergence: number }> = {};
    for (const act of top) {
      const simA = (act[`similarity_${lang_a}`] as number) ?? 0;
      const simB = (act[`similarity_${lang_b}`] as number) ?? 0;
      result[act.conceptId] = {
        similarity: Math.max(simA, simB),
        divergence: act.divergence,
      };
    }
    return result;
  }, [queryResults]);

  // Filter activations for the results panel (remove irrelevant lacuna concepts)
  const filteredActivations = useMemo(() => {
    if (!queryResults) return [];
    const probeLangs = new Set([queryResults.lang_a, queryResults.lang_b]);
    const lacunaHomeLangs: Record<string, string> = {
      dolchstoss: "de", schmach: "de", diktat: "de", kriegsschuld: "de", volkszorn: "de",
    };
    return queryResults.activations.filter((act) => {
      const home = lacunaHomeLangs[act.conceptId];
      if (home && !probeLangs.has(home)) return false;
      return true;
    });
  }, [queryResults]);

  const currentLangName =
    LANGUAGES.find((l) => l.code === language)?.name ?? language.toUpperCase();

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0a0a0a]">
      <Leva />
      {/* Header */}
      <header className="absolute top-0 left-0 z-40 p-6">
        <h1 className="text-2xl font-bold tracking-widest text-[#e5e5e5]">
          LACUNA
        </h1>
        <p className="text-xs text-[#737373] mt-1 tracking-wide">
          Cross-Lingual Divergence Explorer
        </p>
        <div className="flex items-center gap-2 mt-2">
          <span
            className="text-xs font-bold tracking-wider text-[#f59e0b]"
          >
            {currentLangName.toUpperCase()}
          </span>
          <span className="text-xs text-[#737373]">embeddings</span>
        </div>
      </header>

      {/* Subtitle flash */}
      {subtitle && (
        <div className="absolute top-24 left-0 right-0 z-40 text-center">
          <p className="text-sm text-[#f59e0b] tracking-wide animate-pulse">
            {subtitle}
          </p>
        </div>
      )}

      {/* Query input bar */}
      {showQuery && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-1.5">
          <div className="flex items-center bg-[#141414]/90 backdrop-blur-md border border-[#262626] rounded-lg overflow-hidden">
            <input
              ref={queryInputRef}
              type="text"
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleProbe(); }}
              placeholder={`Probe ${queryLangA.toUpperCase()} vs ${queryLangB.toUpperCase()} topology...`}
              className="bg-transparent text-sm text-[#e5e5e5] placeholder-[#525252] px-4 py-2.5 w-[400px] outline-none font-mono tracking-wide"
            />
            <select
              value={queryLangA}
              onChange={(e) => setQueryLangAOverride(e.target.value)}
              className="bg-transparent text-[10px] text-[#3b82f6] font-bold tracking-wider border-l border-[#262626] px-2 py-2.5 outline-none cursor-pointer"
            >
              {LANGUAGES.map((l) => <option key={l.code} value={l.code} className="bg-[#141414]">{l.label}</option>)}
            </select>
            <span className="text-[10px] text-[#525252] px-1">vs</span>
            <select
              value={queryLangB}
              onChange={(e) => setQueryLangBOverride(e.target.value)}
              className="bg-transparent text-[10px] text-[#ef4444] font-bold tracking-wider border-r border-[#262626] px-2 py-2.5 outline-none cursor-pointer"
            >
              {LANGUAGES.map((l) => <option key={l.code} value={l.code} className="bg-[#141414]">{l.label}</option>)}
            </select>
            <button
              onClick={handleProbe}
              disabled={querying || !queryText.trim()}
              className="px-4 py-2.5 text-xs font-bold tracking-widest border-l border-[#262626] transition-all"
              style={{
                color: querying ? "#525252" : "#f59e0b",
                background: querying ? "transparent" : "rgba(245, 158, 11, 0.1)",
              }}
            >
              {querying ? "..." : "PROBE"}
            </button>
            {queryResults && (
              <button
                onClick={handleClearQuery}
                className="px-3 py-2.5 text-xs text-[#525252] hover:text-[#737373] border-l border-[#262626] transition-colors"
              >
                CLEAR
              </button>
            )}
          </div>
          {queryError && (
            <span className="text-xs text-red-400 font-mono">{queryError}</span>
          )}
          {!queryResults && !querying && (
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-[#404040] tracking-wider mr-1">PROBES</span>
              {DEMO_PROBES.map((probe) => (
                <button
                  key={probe.label}
                  onClick={() => fireProbe(probe.text, probe.lang_a, probe.lang_b)}
                  className="group flex items-center gap-1.5 px-2.5 py-1 rounded border border-[#262626] hover:border-[#404040] transition-all"
                  title={probe.desc}
                >
                  <span className="text-[10px] text-[#737373] group-hover:text-[#a3a3a3] tracking-wide">{probe.label}</span>
                  <span className="text-[8px] text-[#333] group-hover:text-[#525252]">{probe.lang_a.toUpperCase()}/{probe.lang_b.toUpperCase()}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Query results panel */}
      {showQuery && queryResults && (
        <div className="absolute right-4 top-16 bottom-16 w-[340px] z-40 bg-[#141414]/90 backdrop-blur-md border border-[#262626] rounded-lg flex flex-col font-mono overflow-hidden">
          <div className="px-4 py-3 border-b border-[#262626]">
            <p className="text-[10px] text-[#737373] tracking-widest">QUERY ACTIVATIONS <span className="text-[#404040]">/ 43 concepts</span></p>
            <p className="text-xs text-[#a3a3a3] mt-1 truncate">
              &ldquo;{queryResults.query}&rdquo;
            </p>
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="px-4 py-2 flex items-center gap-2 text-[9px] text-[#525252] tracking-wider border-b border-[#1a1a1a]">
              <span className="w-[18px]">#</span>
              <span className="w-[76px]">CONCEPT</span>
              <span className="w-[36px] text-right text-[#3b82f6]">{queryResults.lang_a.toUpperCase()}</span>
              <span className="w-[36px] text-right text-[#ef4444]">{queryResults.lang_b.toUpperCase()}</span>
              <span className="flex-1 text-right">DIVERGENCE</span>
            </div>
            {filteredActivations.slice(0, 15).map((act, i) => {
              const simA = (act[`similarity_${queryResults.lang_a}`] as number) ?? 0;
              const simB = (act[`similarity_${queryResults.lang_b}`] as number) ?? 0;
              const isNeutral = act.direction === "neutral";
              const aLeaning = act.direction === queryResults.lang_a;
              const maxDiv = filteredActivations[0]?.divergence || 1;
              return (
                <button
                  key={act.conceptId}
                  onClick={() => handleConceptClick(act.conceptId)}
                  className="w-full px-4 py-2 flex items-center gap-2 text-left hover:bg-[#1a1a1a] transition-colors border-b border-[#1a1a1a]/50"
                >
                  <span className="w-[18px] text-[10px] text-[#404040] tabular-nums">
                    {i + 1}
                  </span>
                  <span className="w-[76px] text-[11px] truncate text-[#f59e0b]">
                    {act.conceptId}
                  </span>
                  <span className="w-[36px] text-[11px] text-right" style={{ color: isNeutral ? "#525252" : aLeaning ? "#3b82f6" : "#1e3a5f" }}>
                    {simA.toFixed(2)}
                  </span>
                  <span className="w-[36px] text-[11px] text-right" style={{ color: isNeutral ? "#525252" : !aLeaning ? "#ef4444" : "#5f1e1e" }}>
                    {simB.toFixed(2)}
                  </span>
                  <div className="flex-1 flex items-center gap-1.5">
                    <div className="flex-1 h-2 bg-[#1a1a1a] rounded overflow-hidden relative">
                      <div
                        className="absolute inset-y-0 left-0 rounded"
                        style={{
                          width: `${maxDiv > 0 ? (act.divergence / maxDiv) * 100 : 0}%`,
                          background: isNeutral
                            ? "rgba(82, 82, 82, 0.5)"
                            : aLeaning
                              ? "rgba(59, 130, 246, 0.7)"
                              : "rgba(239, 68, 68, 0.7)",
                        }}
                      />
                    </div>
                    <span
                      className="text-[10px] w-[28px] text-right font-mono"
                      style={{ color: act.divergence > 0.04 ? '#f59e0b' : act.divergence > 0.02 ? '#a3a3a3' : '#525252' }}
                    >
                      {act.divergence.toFixed(2)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="px-4 py-2 border-t border-[#262626] space-y-1.5">
            <div className="flex items-center gap-4 text-[9px]">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#3b82f6]" />
                <span className="text-[#525252]">{queryResults.lang_a.toUpperCase()}-leaning</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#ef4444]" />
                <span className="text-[#525252]">{queryResults.lang_b.toUpperCase()}-leaning</span>
              </span>
              <span className="text-[#404040] ml-auto">sorted by divergence</span>
            </div>
          </div>
        </div>
      )}


      {/* Concept card */}
      {selectedConcept && (
        <ConceptCard
          conceptId={selectedConcept}
          language={language}
          onClose={() => setSelectedConcept(null)}
          activeModel={activeModel}
        />
      )}

      {/* Butterfly divergence chart */}
      {showButterfly && (
        <ButterflyChart
          language={language}
          showLacunae={showLacunae}
          selectedConcept={selectedConcept}
          onConceptClick={handleConceptClick}
          onClose={() => setShowButterfly(false)}
          weightOverride={isEmbedding ? modelData.weights : undefined}
          clusterOverride={effectiveClusters}
          lacunaOverride={isEmbedding ? modelData.lacunae : undefined}
          clusterColors={effectiveClusterColors}
        />
      )}

      {/* Concept network graph */}
      {showNetwork && (
        <ConceptNetworkGraph
          language={language}
          showLacunae={showLacunae}
          selectedConcept={selectedConcept}
          onConceptClick={handleConceptClick}
          onClose={() => setShowNetwork(false)}
          positionOverride={isEmbedding ? modelData.positions : undefined}
          clusterOverride={effectiveClusters}
          lacunaOverride={isEmbedding ? modelData.lacunae : undefined}
          clusterColors={effectiveClusterColors}
        />
      )}

      {/* Metrics panel */}
      {showMetrics && (
        <ModelMetricsPanel
          activeModel={activeModel}
          language={language}
          onClose={() => setShowMetrics(false)}
        />
      )}

      {/* Agreement heatmap */}
      {showAgreement && (
        <ModelAgreementHeatmap
          language={language}
          selectedConcept={selectedConcept}
          onConceptClick={handleConceptClick}
          onClose={() => setShowAgreement(false)}
        />
      )}

      {/* Cluster editor */}
      {showClusterEditor && (
        <ClusterEditor
          language={language}
          clusters={effectiveClusters ?? modelData.clusters}
          clusterColors={effectiveClusterColors}
          source={isEmbedding ? "embedding" : "curated"}
          onAssign={handleAssignCluster}
          onColorChange={handleClusterColorChange}
          onAddCluster={handleAddCluster}
          onReset={handleResetClusters}
          onClose={() => setShowClusterEditor(false)}
          selectedConcept={selectedConcept}
          onConceptClick={handleConceptClick}
          hasEdits={hasClusterEdits}
        />
      )}

      {/* Connection card */}
      {showConnections && (
        selectedConcept ? (
          <ConnectionCard
            conceptId={selectedConcept}
            language={language}
            onClose={() => setShowConnections(false)}
          />
        ) : (
          <div className="absolute left-4 top-20 bottom-16 w-[420px] z-40 bg-[#141414]/90 backdrop-blur-md border border-[#262626] rounded-lg flex flex-col items-center justify-center font-mono">
            <p className="text-xs text-[#737373] tracking-wider">
              Click a concept on the terrain to view connections
            </p>
            <button
              onClick={() => setShowConnections(false)}
              className="mt-3 text-[10px] text-[#525252] hover:text-[#737373] transition-colors"
            >
              close
            </button>
          </div>
        )
      )}

      {/* Terrain legend */}
      <div className="absolute top-6 left-6 z-30 mt-24 bg-[#0a0a0a]/70 backdrop-blur-sm rounded px-3 py-2 space-y-1 pointer-events-none">
        <p className="text-[9px] text-[#737373] tracking-wider mb-1">READING THE TERRAIN</p>
        <p className="text-[9px] text-[#525252]"><span className="text-[#a3a3a3]">height</span> = conceptual weight / centrality</p>
        <p className="text-[9px] text-[#525252]"><span className="text-[#a3a3a3]">position</span> = semantic proximity (UMAP)</p>
        <p className="text-[9px] text-[#525252]"><span className="text-[#a3a3a3]">color</span> = concept cluster</p>
        <p className="text-[9px] text-[#525252]"><span className="text-[#a3a3a3]">depression</span> = lacuna (absent concept)</p>
      </div>

      {/* 3D terrain (fullscreen) */}
      <TopologyTerrain
        language={language}
        showLacunae={showLacunae}
        onConceptClick={handleConceptClick}
        onBackgroundClick={() => setSelectedConcept(null)}
        positionOverride={isEmbedding ? modelData.positions : undefined}
        weightOverride={isEmbedding ? modelData.weights : undefined}
        clusterOverride={effectiveClusters}
        lacunaOverride={isEmbedding ? modelData.lacunae : undefined}
        clusterColors={effectiveClusterColors}
        highlightedConcepts={highlightedConcepts}
      />

      {/* Bottom control bar */}
      <div className="absolute bottom-0 left-0 right-0 z-40 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Language selector */}
          <div className="flex items-center gap-1 bg-[#0a0a0a]/80 rounded px-1 py-1">
            {LANGUAGES.filter((l) => ["en","de","fr","es","zh","ja","ar","ko","ru"].includes(l.code)).map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleLanguageSelect(lang.code)}
                className="px-2 py-1 text-[10px] font-bold tracking-wider rounded transition-all"
                style={{
                  color: language === lang.code ? "#e5e5e5" : "#737373",
                  background: language === lang.code ? "rgba(245, 158, 11, 0.25)" : "transparent",
                  borderBottom: language === lang.code ? "2px solid #f59e0b" : "2px solid transparent",
                }}
              >
                {lang.label}
              </button>
            ))}
          </div>

          {/* MORE dropdown: research tools */}
          <div className="relative">
            <button
              onClick={() => setShowMore((m) => !m)}
              className="px-4 py-2 text-xs tracking-wider rounded border transition-all"
              style={{
                borderColor: showMore ? "#525252" : "#262626",
                color: showMore ? "#e5e5e5" : "#525252",
                background: showMore ? "rgba(82, 82, 82, 0.15)" : "rgba(10, 10, 10, 0.8)",
              }}
            >
              {showMore ? "LESS" : "MORE"}
            </button>
            {showMore && (
              <div className="absolute bottom-full left-0 mb-2 flex items-center gap-2 bg-[#0a0a0a]/95 backdrop-blur-md border border-[#262626] rounded-lg px-2 py-2">
                {[
                  { key: "lacunae", label: "LACUNAE", state: showLacunae, set: setShowLacunae, color: "#78716c" },
                  { key: "butterfly", label: "DIVERGENCE", state: showButterfly, set: setShowButterfly, color: "#f59e0b" },
                  { key: "network", label: "NETWORK", state: showNetwork, set: setShowNetwork, color: "#f59e0b" },
                  { key: "metrics", label: "METRICS", state: showMetrics, set: setShowMetrics, color: "#3b82f6" },
                  { key: "agreement", label: "AGREEMENT", state: showAgreement, set: setShowAgreement, color: "#22c55e" },
                  { key: "connections", label: "CONNECT", state: showConnections, set: setShowConnections, color: "#a78bfa" },
                  { key: "clusters", label: "CLUSTERS", state: showClusterEditor, set: setShowClusterEditor, color: "#ec4899" },
                ].map((item) => (
                  <button
                    key={item.key}
                    onClick={() => item.set((v: boolean) => !v)}
                    className="px-3 py-1.5 text-[10px] tracking-wider rounded border transition-all whitespace-nowrap"
                    style={{
                      borderColor: item.state ? item.color : "#262626",
                      color: item.state ? "#e5e5e5" : "#737373",
                      background: item.state ? `${item.color}22` : "transparent",
                    }}
                  >
                    {item.state ? `HIDE ${item.label}` : item.label}
                  </button>
                ))}
                <div className="w-px h-5 bg-[#262626]" />
                <ModelSelector activeModel={activeModel} onModelChange={setActiveModel} />
              </div>
            )}
          </div>
        </div>

        {/* Right: color legend */}
        <div className="flex items-center gap-4 bg-[#0a0a0a]/80 px-4 py-2 rounded">
          {legendItems.map((item) => (
            <div key={item.key} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: item.color }} />
              <span className="text-[10px] text-[#737373]">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
