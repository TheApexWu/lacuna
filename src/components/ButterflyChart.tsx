"use client";

import { useMemo, useState, useEffect } from "react";
import { concepts, CLUSTER_HEX, getLabel, LANGUAGES, getClusterColor } from "../data/versailles";

const ROW_HEIGHT = 22;
const BAR_HEIGHT = 12;
const LABEL_AREA = 100; // px reserved for center label
const BAR_Y = (ROW_HEIGHT - BAR_HEIGHT) / 2;

interface ButterflyChartProps {
  language: string;
  showLacunae: boolean;
  selectedConcept: string | null;
  onConceptClick: (id: string) => void;
  onClose: () => void;
  weightOverride?: Record<string, Record<string, number>>;
  clusterOverride?: Record<string, Record<string, number | string>>;
  lacunaOverride?: Record<string, Record<string, boolean>>;
  clusterColors?: Record<string, string>;
}

export default function ButterflyChart({
  language,
  showLacunae,
  selectedConcept,
  onConceptClick,
  onClose,
  weightOverride,
  clusterOverride,
  lacunaOverride,
  clusterColors,
}: ButterflyChartProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [leftLang, setLeftLang] = useState("en");
  const [rightLang, setRightLang] = useState(language === "en" ? "de" : language);

  // Sync rightLang when the page's language changes
  useEffect(() => {
    if (language !== leftLang) {
      setRightLang(language);
    }
  }, [language, leftLang]);

  const rows = useMemo(() => {
    return concepts
      .filter((c) => {
        if (!showLacunae) {
          const lacunaL = lacunaOverride?.[c.id]?.[leftLang] ?? c.lacuna[leftLang] ?? false;
          const lacunaR = lacunaOverride?.[c.id]?.[rightLang] ?? c.lacuna[rightLang] ?? false;
          if (lacunaL && lacunaR) return false;
        }
        return true;
      })
      .map((c) => {
        const wL = weightOverride?.[c.id]?.[leftLang] ?? c.weight[leftLang] ?? 0;
        const wR = weightOverride?.[c.id]?.[rightLang] ?? c.weight[rightLang] ?? 0;
        const clusterLabel = clusterOverride?.[c.id]?.[language] ?? c.cluster;
        return {
          id: c.id,
          label: getLabel(c, language),
          cluster: clusterLabel,
          color: getClusterColor(clusterLabel, clusterColors),
          weightL: wL,
          weightR: wR,
          diff: Math.abs(wL - wR),
          lacunaL: lacunaOverride?.[c.id]?.[leftLang] ?? c.lacuna[leftLang] ?? false,
          lacunaR: lacunaOverride?.[c.id]?.[rightLang] ?? c.lacuna[rightLang] ?? false,
        };
      })
      .sort((a, b) => b.diff - a.diff);
  }, [language, leftLang, rightLang, showLacunae, weightOverride, clusterOverride, lacunaOverride, clusterColors]);

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

      {/* Language selectors */}
      <div className="flex items-center justify-between px-4 pb-2">
        <select
          value={leftLang}
          onChange={(e) => setLeftLang(e.target.value)}
          className="bg-[#0a0a0a] border border-[#262626] rounded px-2 py-0.5 text-[10px] text-[#e5e5e5] tracking-wider cursor-pointer"
          style={{ outline: "none" }}
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
        <span className="text-[10px] text-[#737373]">vs</span>
        <select
          value={rightLang}
          onChange={(e) => setRightLang(e.target.value)}
          className="bg-[#0a0a0a] border border-[#262626] rounded px-2 py-0.5 text-[10px] text-[#e5e5e5] tracking-wider cursor-pointer"
          style={{ outline: "none" }}
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
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

            const lBarW = row.weightL * maxBarWidth;
            const rBarW = row.weightR * maxBarWidth;

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

                {/* Left bar (extends left from center) */}
                {row.lacunaL ? (
                  <rect
                    x={centerX - lBarW}
                    y={BAR_Y}
                    width={Math.max(lBarW, 0)}
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
                    x={centerX - lBarW}
                    y={BAR_Y}
                    width={Math.max(lBarW, 0)}
                    height={BAR_HEIGHT}
                    fill={row.color}
                    fillOpacity={highlight ? 0.9 : 0.7}
                    rx={1}
                  />
                )}

                {/* Right bar (extends right from center) */}
                {row.lacunaR ? (
                  <rect
                    x={centerX}
                    y={BAR_Y}
                    width={Math.max(rBarW, 0)}
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
                    width={Math.max(rBarW, 0)}
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
