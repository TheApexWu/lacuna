"use client";

import { useEffect, useState } from "react";
import { CLUSTER_HEX } from "../data/versailles";

interface ConceptData {
  id: string;
  label: string;
  cluster: string;
  clusterColor: string;
  source: string;
  weight: Record<string, number>;
  position: Record<string, [number, number]>;
  lacuna: Record<string, boolean>;
  hero?: boolean;
  definition?: string;
  neighbors: Record<string, { id: string; label: string; distance: number }[]>;
  interpretation: string | null;
}

export default function ConceptCard({
  conceptId,
  language,
  onClose,
  activeModel,
}: {
  conceptId: string;
  language: string;
  onClose: () => void;
  activeModel?: string;
}) {
  const [data, setData] = useState<ConceptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [interpretation, setInterpretation] = useState<string | null>(null);
  const [interpreting, setInterpreting] = useState(false);

  useEffect(() => {
    if (!conceptId) return;
    setLoading(true);
    setInterpretation(null);
    const modelParam = activeModel && activeModel !== "curated" ? `&model=${activeModel}` : "";
    fetch(`/api/concept/${conceptId}?lang=${language}${modelParam}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [conceptId, language, activeModel]);

  // Fire interpretation request after concept data loads
  useEffect(() => {
    if (!data || !conceptId) return;
    setInterpreting(true);
    fetch("/api/interpret", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conceptId, language }),
    })
      .then((r) => r.json())
      .then((d) => {
        setInterpretation(d.interpretation || null);
        setInterpreting(false);
      })
      .catch(() => {
        setInterpretation(null);
        setInterpreting(false);
      });
  }, [data, conceptId, language]);

  if (loading) {
    return (
      <div className="absolute top-4 right-4 w-80 bg-[#141414]/90 backdrop-blur-md border border-[#262626] rounded-lg p-5 text-sm font-mono text-[#e5e5e5] z-50">
        <span className="text-[#737373]">Loading...</span>
      </div>
    );
  }

  if (!data) return null;

  const clusterDot = CLUSTER_HEX[data.cluster] || "#f59e0b";

  return (
    <div className="absolute top-4 right-4 w-80 bg-[#141414]/90 backdrop-blur-md border border-[#262626] rounded-lg p-5 text-sm font-mono text-[#e5e5e5] z-50">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className="w-3 h-3 rounded-full inline-block"
            style={{ background: clusterDot }}
          />
          <span className="text-lg font-bold">{data.label}</span>
          {activeModel && activeModel !== "curated" && (
            <span className="text-[9px] text-[#737373] bg-[#1a1a1a] border border-[#262626] rounded px-1.5 py-0.5 tracking-wider">
              {activeModel.toUpperCase()}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-[#737373] hover:text-[#e5e5e5] transition-colors text-lg leading-none"
        >
          &times;
        </button>
      </div>

      {/* Definition */}
      {data.definition && (
        <p className="text-[#a3a3a3] text-xs leading-relaxed mb-3">
          {data.definition}
        </p>
      )}

      {/* Interpretation from Mistral agent (lead with this) */}
      <div className="mb-3 pb-3 border-b border-[#262626]">
        {interpreting ? (
          <p className="text-[#f59e0b] text-xs animate-pulse">
            interpreting...
          </p>
        ) : interpretation ? (
          <p className="text-[#a3a3a3] text-xs leading-relaxed">
            {interpretation}
          </p>
        ) : (
          <p className="text-[#737373] text-xs italic">
            Interpretation unavailable
          </p>
        )}
      </div>

      {/* Key metadata */}
      <div className="space-y-1.5 mb-3 text-xs">
        <Row label="cluster" value={data.cluster} />
        {data.hero && <Row label="hero" value="true" accent />}
        {(["en", "de"] as const).map((lang) => {
          const w = data.weight[lang];
          if (w === undefined || w === 0) return null;
          return <Row key={lang} label={`weight.${lang}`} value={w.toFixed(2)} />;
        })}
        {(["en", "de"] as const).map((lang) =>
          data.lacuna[lang] ? (
            <Row key={lang} label={`lacuna.${lang}`} value="true" accent />
          ) : null
        )}
      </div>

      {/* Nearest neighbors (EN and DE only) */}
      {data.neighbors &&
        (["en", "de"] as const)
          .filter((lang) => data.neighbors[lang])
          .map((lang) => (
            <div key={lang} className="mb-3">
              <p className="text-[#737373] text-xs mb-1">nearest ({lang})</p>
              <div className="space-y-0.5">
                {data.neighbors[lang].slice(0, 5).map((n) => (
                  <div
                    key={n.id}
                    className="flex justify-between text-xs"
                  >
                    <span className="text-[#a3a3a3]">{n.label}</span>
                    <span className="text-[#737373] tabular-nums">
                      {n.distance.toFixed(3)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
    </div>
  );
}

function Row({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-[#737373]">{label}</span>
      <span className={accent ? "text-[#f59e0b]" : "text-[#e5e5e5]"}>
        {value}
      </span>
    </div>
  );
}
