"use client";

import dynamic from "next/dynamic";
import { useState, useCallback, useMemo, useEffect } from "react";
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

  const currentLangName =
    LANGUAGES.find((l) => l.code === language)?.name ?? language.toUpperCase();

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0a0a0a]">
      {/* Header */}
      <header className="absolute top-0 left-0 z-40 p-6">
        <h1 className="text-2xl font-bold tracking-widest text-[#e5e5e5]">
          LACUNA
        </h1>
        <p className="text-xs text-[#737373] mt-1 tracking-wide">
          Conceptual Topology Mapper
        </p>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs text-[#737373]">viewing</span>
          <span
            className="text-xs font-bold tracking-wider text-[#f59e0b]"
          >
            {currentLangName.toUpperCase()}
          </span>
          <span className="text-xs text-[#737373]">topology</span>
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

      {/* Model status badge */}
      {activeModel !== "curated" && (
        <div className="absolute top-6 right-6 z-40 flex items-center gap-2 bg-[#141414]/90 backdrop-blur-md border border-[#262626] rounded px-3 py-1.5">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: modelData.status === "live" ? "#22c55e" : "#f59e0b" }}
          />
          <span className="text-[10px] text-[#a3a3a3] tracking-wider font-mono">
            {modelInfo?.shortName ?? activeModel.toUpperCase()}
          </span>
          {modelData.status === "stub" && (
            <span className="text-[9px] text-[#78716c] tracking-wider">STUB</span>
          )}
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
      />

      {/* Bottom control bar */}
      <div className="absolute bottom-0 left-0 right-0 z-40 p-4 flex items-center justify-between">
        {/* Left: language selector + toggles */}
        <div className="flex items-center gap-3">
          {/* Language selector */}
          <div className="flex items-center gap-1 bg-[#0a0a0a]/80 rounded px-1 py-1">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleLanguageSelect(lang.code)}
                className="px-2 py-1 text-[10px] font-bold tracking-wider rounded transition-all"
                style={{
                  color:
                    language === lang.code ? "#e5e5e5" : "#737373",
                  background:
                    language === lang.code
                      ? "rgba(245, 158, 11, 0.25)"
                      : "transparent",
                  borderBottom:
                    language === lang.code
                      ? "2px solid #f59e0b"
                      : "2px solid transparent",
                }}
              >
                {lang.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowLacunae((g) => !g)}
            className="px-4 py-2 text-xs tracking-wider rounded border transition-all"
            style={{
              borderColor: showLacunae ? "#78716c" : "#262626",
              color: showLacunae ? "#e5e5e5" : "#737373",
              background: showLacunae
                ? "rgba(120, 113, 108, 0.15)"
                : "rgba(10, 10, 10, 0.8)",
            }}
          >
            {showLacunae ? "HIDE LACUNAE" : "REVEAL LACUNAE"}
          </button>

          <button
            onClick={() => setShowButterfly((b) => !b)}
            className="px-4 py-2 text-xs tracking-wider rounded border transition-all"
            style={{
              borderColor: showButterfly ? "#f59e0b" : "#262626",
              color: showButterfly ? "#e5e5e5" : "#737373",
              background: showButterfly
                ? "rgba(245, 158, 11, 0.15)"
                : "rgba(10, 10, 10, 0.8)",
            }}
          >
            {showButterfly ? "HIDE DIVERGENCE" : "DIVERGENCE"}
          </button>

          <button
            onClick={() => setShowNetwork((n) => !n)}
            className="px-4 py-2 text-xs tracking-wider rounded border transition-all"
            style={{
              borderColor: showNetwork ? "#f59e0b" : "#262626",
              color: showNetwork ? "#e5e5e5" : "#737373",
              background: showNetwork
                ? "rgba(245, 158, 11, 0.15)"
                : "rgba(10, 10, 10, 0.8)",
            }}
          >
            {showNetwork ? "HIDE NETWORK" : "NETWORK"}
          </button>

          <button
            onClick={() => setShowMetrics((m) => !m)}
            className="px-4 py-2 text-xs tracking-wider rounded border transition-all"
            style={{
              borderColor: showMetrics ? "#3b82f6" : "#262626",
              color: showMetrics ? "#e5e5e5" : "#737373",
              background: showMetrics
                ? "rgba(59, 130, 246, 0.15)"
                : "rgba(10, 10, 10, 0.8)",
            }}
          >
            {showMetrics ? "HIDE METRICS" : "METRICS"}
          </button>

          <button
            onClick={() => setShowAgreement((a) => !a)}
            className="px-4 py-2 text-xs tracking-wider rounded border transition-all"
            style={{
              borderColor: showAgreement ? "#22c55e" : "#262626",
              color: showAgreement ? "#e5e5e5" : "#737373",
              background: showAgreement
                ? "rgba(34, 197, 94, 0.15)"
                : "rgba(10, 10, 10, 0.8)",
            }}
          >
            {showAgreement ? "HIDE AGREEMENT" : "AGREEMENT"}
          </button>

          <button
            onClick={() => setShowConnections((c) => !c)}
            className="px-4 py-2 text-xs tracking-wider rounded border transition-all"
            style={{
              borderColor: showConnections ? "#a78bfa" : "#262626",
              color: showConnections ? "#e5e5e5" : "#737373",
              background: showConnections
                ? "rgba(167, 139, 250, 0.15)"
                : "rgba(10, 10, 10, 0.8)",
            }}
          >
            {showConnections ? "HIDE CONNECT" : "CONNECT"}
          </button>

          <button
            onClick={() => setShowClusterEditor((c) => !c)}
            className="px-4 py-2 text-xs tracking-wider rounded border transition-all"
            style={{
              borderColor: showClusterEditor ? "#ec4899" : "#262626",
              color: showClusterEditor ? "#e5e5e5" : "#737373",
              background: showClusterEditor
                ? "rgba(236, 72, 153, 0.15)"
                : "rgba(10, 10, 10, 0.8)",
            }}
          >
            {showClusterEditor ? "HIDE CLUSTERS" : "CLUSTERS"}
          </button>

          <div className="w-px h-6 bg-[#262626]" />

          <ModelSelector
            activeModel={activeModel}
            onModelChange={setActiveModel}
          />
        </div>

        {/* Right: color legend */}
        <div className="flex items-center gap-4 bg-[#0a0a0a]/80 px-4 py-2 rounded">
          {legendItems.map((item) => (
            <div key={item.key} className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: item.color }}
              />
              <span className="text-[10px] text-[#737373]">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
