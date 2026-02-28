"use client";

import { useMemo, useState } from "react";
import { concepts, CLUSTER_HEX, getLabel } from "../data/versailles";

const ROW_HEIGHT = 22;
const BAR_HEIGHT = 12;
const LABEL_AREA = 100; // px reserved for center label
const BAR_Y = (ROW_HEIGHT - BAR_HEIGHT) / 2;

interface ButterflyChartProps {
  language: string;
  showGhosts: boolean;
  selectedConcept: string | null;
  onConceptClick: (id: string) => void;
  onClose: () => void;
}

export default function ButterflyChart({
  language,
  showGhosts,
  selectedConcept,
  onConceptClick,
  onClose,
}: ButterflyChartProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const rows = useMemo(() => {
    return concepts
      .filter((c) => {
        if (!showGhosts && (c.ghost.en || c.ghost.de)) return false;
        return true;
      })
      .map((c) => ({
        id: c.id,
        label: getLabel(c, language),
        cluster: c.cluster,
        color: CLUSTER_HEX[c.cluster] || "#f59e0b",
        weightEN: c.weight.en ?? 0,
        weightDE: c.weight.de ?? 0,
        diff: Math.abs((c.weight.en ?? 0) - (c.weight.de ?? 0)),
        ghostEN: c.ghost.en ?? false,
        ghostDE: c.ghost.de ?? false,
      }))
      .sort((a, b) => b.diff - a.diff);
  }, [language, showGhosts]);

  // SVG dimensions
  const svgWidth = 396; // panel inner width (420 - padding)
  const svgHeight = rows.length * ROW_HEIGHT;
  const centerX = svgWidth / 2;
  const maxBarWidth = (svgWidth - LABEL_AREA) / 2;

  return (
    <div className="absolute left-4 top-20 bottom-16 w-[420px] z-40 bg-[#141414]/90 backdrop-blur-md border border-[#262626] rounded-lg flex flex-col font-mono text-[#e5e5e5]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-1">
        <span className="text-xs text-[#737373] tracking-wider">
          WEIGHT DIVERGENCE
        </span>
        <button
          onClick={onClose}
          className="text-[#737373] hover:text-[#e5e5e5] transition-colors text-lg leading-none"
        >
          &times;
        </button>
      </div>

      {/* Column headers */}
      <div className="flex items-center justify-between px-5 pb-2">
        <span className="text-[10px] text-[#3b82f6] tracking-wider">EN</span>
        <span className="text-[10px] text-[#ef4444] tracking-wider">DE</span>
      </div>

      {/* Scrollable chart */}
      <div
        className="flex-1 overflow-y-auto px-3 pb-3"
        style={{
          scrollbarWidth: "thin",
          scrollbarColor: "#262626 transparent",
        }}
      >
        <svg
          width={svgWidth}
          height={svgHeight}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        >
          {/* Center axis */}
          <line
            x1={centerX}
            y1={0}
            x2={centerX}
            y2={svgHeight}
            stroke="#262626"
            strokeWidth={1}
          />

          {rows.map((row, i) => {
            const y = i * ROW_HEIGHT;
            const isSelected = row.id === selectedConcept;
            const isHovered = row.id === hoveredId;
            const highlight = isSelected || isHovered;

            const enBarW = row.weightEN * maxBarWidth;
            const deBarW = row.weightDE * maxBarWidth;

            return (
              <g
                key={row.id}
                transform={`translate(0, ${y})`}
                onClick={() => onConceptClick(row.id)}
                onMouseEnter={() => setHoveredId(row.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{ cursor: "pointer" }}
              >
                {/* Hover/select background */}
                {highlight && (
                  <rect
                    x={0}
                    y={0}
                    width={svgWidth}
                    height={ROW_HEIGHT}
                    fill={isSelected ? "#f59e0b" : "#ffffff"}
                    opacity={isSelected ? 0.06 : 0.03}
                  />
                )}

                {/* EN bar (extends left from center) */}
                {row.ghostEN ? (
                  <rect
                    x={centerX - enBarW}
                    y={BAR_Y}
                    width={Math.max(enBarW, 0)}
                    height={BAR_HEIGHT}
                    fill={row.color}
                    fillOpacity={0.1}
                    stroke={row.color}
                    strokeWidth={1}
                    strokeDasharray="4,3"
                    strokeOpacity={0.5}
                    rx={1}
                  />
                ) : (
                  <rect
                    x={centerX - enBarW}
                    y={BAR_Y}
                    width={Math.max(enBarW, 0)}
                    height={BAR_HEIGHT}
                    fill={row.color}
                    fillOpacity={highlight ? 0.9 : 0.7}
                    rx={1}
                  />
                )}

                {/* DE bar (extends right from center) */}
                {row.ghostDE ? (
                  <rect
                    x={centerX}
                    y={BAR_Y}
                    width={Math.max(deBarW, 0)}
                    height={BAR_HEIGHT}
                    fill={row.color}
                    fillOpacity={0.1}
                    stroke={row.color}
                    strokeWidth={1}
                    strokeDasharray="4,3"
                    strokeOpacity={0.5}
                    rx={1}
                  />
                ) : (
                  <rect
                    x={centerX}
                    y={BAR_Y}
                    width={Math.max(deBarW, 0)}
                    height={BAR_HEIGHT}
                    fill={row.color}
                    fillOpacity={highlight ? 0.9 : 0.7}
                    rx={1}
                  />
                )}

                {/* Concept label (centered) */}
                <text
                  x={centerX}
                  y={ROW_HEIGHT - 5}
                  textAnchor="middle"
                  fill={
                    isSelected
                      ? "#f59e0b"
                      : isHovered
                        ? "#e5e5e5"
                        : "#a3a3a3"
                  }
                  fontSize={9}
                  fontFamily="monospace"
                >
                  {row.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
