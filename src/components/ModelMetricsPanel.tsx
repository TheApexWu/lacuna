"use client";

import { useState, useEffect } from "react";
import { MODELS } from "../data/embeddings/models";
import type { AllMetrics, ModelMetrics } from "../data/embeddings";

interface ModelMetricsPanelProps {
  activeModel: string;
  language: string;
  onClose: () => void;
}

export default function ModelMetricsPanel({
  activeModel,
  language,
  onClose,
}: ModelMetricsPanelProps) {
  const [metrics, setMetrics] = useState<AllMetrics | null>(null);

  useEffect(() => {
    import("../data/embeddings/metrics.json").then((m) => {
      setMetrics(m.default as AllMetrics);
    });
  }, []);

  const activeMetrics = metrics?.models.find((m) => m.modelId === activeModel);

  return (
    <div className="absolute left-4 top-20 bottom-16 w-[420px] z-40 bg-[#141414]/90 backdrop-blur-md border border-[#262626] rounded-lg flex flex-col font-mono text-[#e5e5e5]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <span className="text-xs text-[#737373] tracking-wider">
          MODEL BENCHMARK METRICS
        </span>
        <button
          onClick={onClose}
          className="text-[#737373] hover:text-[#e5e5e5] transition-colors text-lg leading-none"
        >
          &times;
        </button>
      </div>

      {/* Content */}
      <div
        className="flex-1 overflow-y-auto px-4 pb-4"
        style={{ scrollbarWidth: "thin", scrollbarColor: "#262626 transparent" }}
      >
        {!metrics ? (
          <p className="text-[10px] text-[#737373] mt-4">Loading metrics...</p>
        ) : (
          <>
            {/* Active model detail */}
            {activeMetrics && (
              <div className="mb-4">
                <div className="text-[11px] text-[#f59e0b] tracking-wider mb-3">
                  {MODELS.find((m) => m.id === activeModel)?.name ?? activeModel}
                </div>
                <MetricCard
                  name="CLAS"
                  subtitle="Cross-Lingual Alignment"
                  value={activeMetrics.clas.average}
                  detail={`avg cosine sim between EN and other languages for same concept. High = model collapses differences.`}
                  pairs={activeMetrics.clas.pairs}
                  language={language}
                  color="#3b82f6"
                />
                <MetricCard
                  name="TOPOLOGY"
                  subtitle="Topology Preservation (Mantel)"
                  value={activeMetrics.topology.averageR}
                  detail="Correlation between EN and other distance matrices. High = same structure both languages."
                  pairs={Object.fromEntries(
                    Object.entries(activeMetrics.topology.pairs).map(([k, v]) => [
                      k,
                      (v as { r: number }).r,
                    ])
                  )}
                  language={language}
                  color="#22c55e"
                />
                <MetricCard
                  name="SILHOUETTE"
                  subtitle="Cluster Coherence"
                  value={(activeMetrics.silhouette as Record<string, number>).average ?? 0}
                  detail="Do the 6 concept clusters hold together? Higher = better-defined clusters."
                  pairs={Object.fromEntries(
                    Object.entries(activeMetrics.silhouette).filter(
                      ([k]) => k !== "average"
                    )
                  ) as Record<string, number>}
                  language={language}
                  color="#f59e0b"
                />
                <MetricCard
                  name="LACUNA DETECT"
                  subtitle="Lacuna Detection Rate"
                  value={activeMetrics.lacunaDetection.averageRate}
                  detail="Are lacuna concepts orphaned in foreign languages? Higher = model sees lacunae."
                  pairs={Object.fromEntries(
                    Object.entries(activeMetrics.lacunaDetection.perLanguage).map(
                      ([k, v]) => [k, (v as { rate: number }).rate]
                    )
                  )}
                  language={language}
                  color="#ef4444"
                />
              </div>
            )}

            {/* Comparison table */}
            <div className="border-t border-[#262626] pt-3 mt-2">
              <div className="text-[10px] text-[#737373] tracking-wider mb-2">
                ALL MODELS COMPARISON
              </div>
              <table className="w-full text-[9px]">
                <thead>
                  <tr className="text-[#737373]">
                    <th className="text-left py-1 pr-2">Model</th>
                    <th className="text-right py-1 px-1">CLAS</th>
                    <th className="text-right py-1 px-1">Topo</th>
                    <th className="text-right py-1 px-1">Silh</th>
                    <th className="text-right py-1 px-1">Lacuna</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.models.map((m) => {
                    const info = MODELS.find((mm) => mm.id === m.modelId);
                    const isActive = m.modelId === activeModel;
                    return (
                      <tr
                        key={m.modelId}
                        className={isActive ? "text-[#e5e5e5]" : "text-[#a3a3a3]"}
                        style={
                          isActive
                            ? { background: "rgba(245, 158, 11, 0.06)" }
                            : undefined
                        }
                      >
                        <td className="py-1 pr-2 truncate max-w-[100px]">
                          {info?.shortName ?? m.modelId}
                        </td>
                        <td className="text-right py-1 px-1">
                          <ScoreCell value={m.clas.average} />
                        </td>
                        <td className="text-right py-1 px-1">
                          <ScoreCell value={m.topology.averageR} />
                        </td>
                        <td className="text-right py-1 px-1">
                          <ScoreCell
                            value={
                              (m.silhouette as Record<string, number>).average ?? 0
                            }
                          />
                        </td>
                        <td className="text-right py-1 px-1">
                          <ScoreCell value={m.lacunaDetection.averageRate} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Subcomponents ────────────────────────────────────────────

function MetricCard({
  name,
  subtitle,
  value,
  detail,
  pairs,
  language,
  color,
}: {
  name: string;
  subtitle: string;
  value: number;
  detail: string;
  pairs: Record<string, number>;
  language: string;
  color: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const pct = Math.max(0, Math.min(1, Math.abs(value))) * 100;

  return (
    <div className="mb-3 border border-[#262626] rounded p-3">
      <div className="flex items-center justify-between mb-1">
        <div>
          <span className="text-[10px] tracking-wider" style={{ color }}>
            {name}
          </span>
          <span className="text-[9px] text-[#737373] ml-2">{subtitle}</span>
        </div>
        <span className="text-sm font-bold" style={{ color }}>
          {value.toFixed(3)}
        </span>
      </div>

      {/* Bar */}
      <div className="w-full h-1.5 bg-[#0a0a0a] rounded-full mb-1.5">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color, opacity: 0.7 }}
        />
      </div>

      <p className="text-[9px] text-[#737373] leading-relaxed">{detail}</p>

      {/* Expandable per-language breakdown */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="text-[9px] text-[#525252] mt-1 hover:text-[#737373] transition-colors"
      >
        {expanded ? "▾ collapse" : "▸ per-language"}
      </button>
      {expanded && (
        <div className="mt-1.5 grid grid-cols-3 gap-1">
          {Object.entries(pairs).map(([key, val]) => {
            const isCurrentLang = key === language || key.includes(language);
            return (
              <div
                key={key}
                className="flex items-center justify-between text-[9px] px-1.5 py-0.5 rounded"
                style={{
                  background: isCurrentLang ? "rgba(245, 158, 11, 0.08)" : "transparent",
                }}
              >
                <span className="text-[#737373]">{key}</span>
                <span style={{ color: isCurrentLang ? "#f59e0b" : "#a3a3a3" }}>
                  {typeof val === "number" ? val.toFixed(3) : String(val)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ScoreCell({ value }: { value: number }) {
  const hue = value > 0.7 ? 120 : value > 0.4 ? 40 : 0;
  return (
    <span style={{ color: `hsl(${hue}, 60%, 55%)` }}>{value.toFixed(2)}</span>
  );
}
