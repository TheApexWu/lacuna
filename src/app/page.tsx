"use client";

import dynamic from "next/dynamic";
import { useState, useCallback } from "react";
import ConceptCard from "../components/ConceptCard";
import ButterflyChart from "../components/ButterflyChart";
import ConceptNetworkGraph from "../components/ConceptNetworkGraph";
import { CLUSTER_HEX, LANGUAGES } from "../data/versailles";

// DO NOT use SSR for Three.js
const TopologyTerrain = dynamic(
  () => import("../components/TopologyTerrain"),
  { ssr: false }
);

const LEGEND = [
  { cluster: "core", label: "Core" },
  { cluster: "justice", label: "Justice" },
  { cluster: "victory", label: "Victory" },
  { cluster: "humiliation", label: "Humiliation" },
  { cluster: "ghost-de", label: "Ghost (DE)" },
  { cluster: "ghost-en", label: "Ghost (EN)" },
];

export default function Home() {
  const [language, setLanguage] = useState("en");
  const [showGhosts, setShowGhosts] = useState(false);
  const [selectedConcept, setSelectedConcept] = useState<string | null>(null);
  const [subtitle, setSubtitle] = useState<string | null>(null);
  const [hasFlipped, setHasFlipped] = useState(false);
  const [showButterfly, setShowButterfly] = useState(false);
  const [showNetwork, setShowNetwork] = useState(false);

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

      {/* Concept card */}
      {selectedConcept && (
        <ConceptCard
          conceptId={selectedConcept}
          language={language}
          onClose={() => setSelectedConcept(null)}
        />
      )}

      {/* Butterfly divergence chart */}
      {showButterfly && (
        <ButterflyChart
          language={language}
          showGhosts={showGhosts}
          selectedConcept={selectedConcept}
          onConceptClick={handleConceptClick}
          onClose={() => setShowButterfly(false)}
        />
      )}

      {/* Concept network graph */}
      {showNetwork && (
        <ConceptNetworkGraph
          language={language}
          showGhosts={showGhosts}
          selectedConcept={selectedConcept}
          onConceptClick={handleConceptClick}
          onClose={() => setShowNetwork(false)}
        />
      )}

      {/* 3D terrain (fullscreen) */}
      <TopologyTerrain
        language={language}
        showGhosts={showGhosts}
        onConceptClick={handleConceptClick}
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
            onClick={() => setShowGhosts((g) => !g)}
            className="px-4 py-2 text-xs tracking-wider rounded border transition-all"
            style={{
              borderColor: showGhosts ? "#78716c" : "#262626",
              color: showGhosts ? "#e5e5e5" : "#737373",
              background: showGhosts
                ? "rgba(120, 113, 108, 0.15)"
                : "rgba(10, 10, 10, 0.8)",
            }}
          >
            {showGhosts ? "HIDE LACUNAE" : "REVEAL LACUNAE"}
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
        </div>

        {/* Right: color legend */}
        <div className="flex items-center gap-4 bg-[#0a0a0a]/80 px-4 py-2 rounded">
          {LEGEND.map((item) => (
            <div key={item.cluster} className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: CLUSTER_HEX[item.cluster] || "#78716c" }}
              />
              <span className="text-[10px] text-[#737373]">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
