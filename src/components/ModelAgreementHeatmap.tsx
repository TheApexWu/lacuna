"use client";

import { useMemo, useState, useEffect } from "react";
import { concepts, getLabel, CLUSTER_HEX } from "../data/versailles";
import { MODELS } from "../data/embeddings/models";
import type { EmbeddingData } from "../data/embeddings";
import { loadModelData } from "../data/embeddings";

interface ModelAgreementHeatmapProps {
  language: string;
  selectedConcept: string | null;
  onConceptClick: (id: string) => void;
  onClose: () => void;
}

export default function ModelAgreementHeatmap({
  language,
  selectedConcept,
  onConceptClick,
  onClose,
}: ModelAgreementHeatmapProps) {
  const [model1, setModel1] = useState("curated");
  const [model2, setModel2] = useState("bge-m3");
  const [data1, setData1] = useState<EmbeddingData | null>(null);
  const [data2, setData2] = useState<EmbeddingData | null>(null);
  const [hoveredCell, setHoveredCell] = useState<[number, number] | null>(null);

  useEffect(() => {
    loadModelData(model1).then(setData1);
  }, [model1]);

  useEffect(() => {
    loadModelData(model2).then(setData2);
  }, [model2]);

  const embeddingModels = MODELS.filter((m) => m.id !== "curated");

  // Compute agreement matrix
  const { matrix, conceptOrder, maxDisagreement } = useMemo(() => {
    if (!data1 || !data2) return { matrix: [], conceptOrder: [], maxDisagreement: 1 };

    const order = data1.conceptOrder || concepts.map((c) => c.id);
    const pw1 = data1.pairwise?.[language];
    const pw2 = data2.pairwise?.[language];

    if (!pw1 || !pw2) return { matrix: [], conceptOrder: order, maxDisagreement: 1 };

    const n = Math.min(pw1.length, pw2.length);
    const mat: number[][] = [];
    let maxD = 0;

    for (let i = 0; i < n; i++) {
      const row: number[] = [];
      for (let j = 0; j < n; j++) {
        const diff = Math.abs((pw1[i]?.[j] ?? 0) - (pw2[i]?.[j] ?? 0));
        row.push(diff);
        if (diff > maxD) maxD = diff;
      }
      mat.push(row);
    }

    return { matrix: mat, conceptOrder: order, maxDisagreement: maxD || 1 };
  }, [data1, data2, language]);

  const cellSize = Math.max(6, Math.min(12, 380 / (conceptOrder.length || 1)));
  const gridSize = cellSize * conceptOrder.length;

  return (
    <div className="absolute inset-x-4 top-20 bottom-16 z-40 bg-[#141414]/95 backdrop-blur-md border border-[#262626] rounded-lg flex flex-col font-mono text-[#e5e5e5] max-w-[520px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <span className="text-xs text-[#737373] tracking-wider">
          MODEL AGREEMENT
        </span>
        <button
          onClick={onClose}
          className="text-[#737373] hover:text-[#e5e5e5] transition-colors text-lg leading-none"
        >
          &times;
        </button>
      </div>

      {/* Model selectors */}
      <div className="flex items-center gap-2 px-4 pb-2">
        <select
          value={model1}
          onChange={(e) => setModel1(e.target.value)}
          className="bg-[#0a0a0a] border border-[#262626] rounded px-2 py-0.5 text-[10px] text-[#e5e5e5] tracking-wider cursor-pointer"
          style={{ outline: "none" }}
        >
          {MODELS.map((m) => (
            <option key={m.id} value={m.id}>{m.shortName}</option>
          ))}
        </select>
        <span className="text-[10px] text-[#737373]">vs</span>
        <select
          value={model2}
          onChange={(e) => setModel2(e.target.value)}
          className="bg-[#0a0a0a] border border-[#262626] rounded px-2 py-0.5 text-[10px] text-[#e5e5e5] tracking-wider cursor-pointer"
          style={{ outline: "none" }}
        >
          {MODELS.map((m) => (
            <option key={m.id} value={m.id}>{m.shortName}</option>
          ))}
        </select>
        <span className="text-[9px] text-[#525252] ml-2">
          {language.toUpperCase()} topology
        </span>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 px-4 pb-2">
        <div className="flex items-center gap-1">
          <span className="w-3 h-2 rounded-sm" style={{ background: "#22c55e" }} />
          <span className="text-[9px] text-[#737373]">Agree</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-2 rounded-sm" style={{ background: "#ef4444" }} />
          <span className="text-[9px] text-[#737373]">Disagree</span>
        </div>
      </div>

      {/* Heatmap */}
      <div
        className="flex-1 overflow-auto px-4 pb-4"
        style={{ scrollbarWidth: "thin", scrollbarColor: "#262626 transparent" }}
      >
        {matrix.length === 0 ? (
          <p className="text-[10px] text-[#737373] mt-4">Loading model data...</p>
        ) : (
          <div style={{ position: "relative" }}>
            <svg
              width={gridSize + 60}
              height={gridSize + 60}
              viewBox={`0 0 ${gridSize + 60} ${gridSize + 60}`}
            >
              {/* Row/column labels */}
              {conceptOrder.map((cid, i) => {
                const concept = concepts.find((c) => c.id === cid);
                const isSelected = cid === selectedConcept;
                const label = concept ? getLabel(concept, language) : cid;
                const shortLabel = label.length > 6 ? label.slice(0, 5) + "…" : label;

                return (
                  <g key={`label-${cid}`}>
                    {/* Top label */}
                    <text
                      x={60 + i * cellSize + cellSize / 2}
                      y={55}
                      textAnchor="end"
                      fontSize={Math.min(7, cellSize - 1)}
                      fill={isSelected ? "#f59e0b" : "#525252"}
                      transform={`rotate(-45, ${60 + i * cellSize + cellSize / 2}, 55)`}
                      style={{ cursor: "pointer" }}
                      onClick={() => onConceptClick(cid)}
                    >
                      {shortLabel}
                    </text>
                    {/* Left label */}
                    <text
                      x={56}
                      y={60 + i * cellSize + cellSize / 2 + 2}
                      textAnchor="end"
                      fontSize={Math.min(7, cellSize - 1)}
                      fill={isSelected ? "#f59e0b" : "#525252"}
                      style={{ cursor: "pointer" }}
                      onClick={() => onConceptClick(cid)}
                    >
                      {shortLabel}
                    </text>
                  </g>
                );
              })}

              {/* Cells */}
              {matrix.map((row, i) =>
                row.map((val, j) => {
                  if (i === j) return null;
                  const agreement = 1 - val / maxDisagreement;
                  // Green (agree) to Red (disagree)
                  const r = Math.round(34 + (239 - 34) * (1 - agreement));
                  const g = Math.round(197 + (68 - 197) * (1 - agreement));
                  const b = Math.round(94 + (68 - 94) * (1 - agreement));
                  const isHovered =
                    hoveredCell && hoveredCell[0] === i && hoveredCell[1] === j;

                  return (
                    <rect
                      key={`${i}-${j}`}
                      x={60 + j * cellSize}
                      y={60 + i * cellSize}
                      width={cellSize - 0.5}
                      height={cellSize - 0.5}
                      fill={`rgb(${r},${g},${b})`}
                      fillOpacity={isHovered ? 1 : 0.7}
                      rx={0.5}
                      style={{ cursor: "pointer" }}
                      onMouseEnter={() => setHoveredCell([i, j])}
                      onMouseLeave={() => setHoveredCell(null)}
                      onClick={() => onConceptClick(conceptOrder[i])}
                    />
                  );
                })
              )}

              {/* Diagonal */}
              {conceptOrder.map((_, i) => (
                <rect
                  key={`diag-${i}`}
                  x={60 + i * cellSize}
                  y={60 + i * cellSize}
                  width={cellSize - 0.5}
                  height={cellSize - 0.5}
                  fill="#262626"
                  rx={0.5}
                />
              ))}
            </svg>

            {/* Hover tooltip */}
            {hoveredCell && (
              <div
                className="absolute bg-[#0a0a0a] border border-[#262626] rounded px-2 py-1 text-[9px] pointer-events-none z-10"
                style={{
                  left: 60 + hoveredCell[1] * cellSize + cellSize,
                  top: 60 + hoveredCell[0] * cellSize,
                }}
              >
                <span className="text-[#a3a3a3]">
                  {getLabel(
                    concepts.find((c) => c.id === conceptOrder[hoveredCell[0]])!,
                    language
                  )}
                </span>
                <span className="text-[#525252] mx-1">×</span>
                <span className="text-[#a3a3a3]">
                  {getLabel(
                    concepts.find((c) => c.id === conceptOrder[hoveredCell[1]])!,
                    language
                  )}
                </span>
                <br />
                <span className="text-[#737373]">
                  Δ = {matrix[hoveredCell[0]][hoveredCell[1]].toFixed(3)}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
