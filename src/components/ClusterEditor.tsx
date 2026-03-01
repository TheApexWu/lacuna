"use client";

import { useState, useMemo } from "react";
import { concepts, getLabel } from "../data/versailles";

const PALETTE = [
  "#f59e0b", "#3b82f6", "#22c55e", "#ef4444",
  "#a78bfa", "#ec4899", "#14b8a6", "#f97316",
  "#6366f1", "#84cc16", "#78716c",
];

interface ClusterEditorProps {
  language: string;
  clusters: Record<string, Record<string, number | string>>;
  clusterColors: Record<string, string>;
  source: "curated" | "embedding";
  onAssign: (conceptId: string, newCluster: string, allLanguages: boolean) => void;
  onColorChange: (label: string, color: string) => void;
  onAddCluster: (label: string, color: string) => void;
  onReset: () => void;
  onClose: () => void;
  selectedConcept: string | null;
  onConceptClick: (id: string) => void;
  hasEdits: boolean;
}

export default function ClusterEditor({
  language,
  clusters,
  clusterColors,
  source,
  onAssign,
  onColorChange,
  onAddCluster,
  onReset,
  onClose,
  selectedConcept,
  onConceptClick,
  hasEdits,
}: ClusterEditorProps) {
  const [expandedClusters, setExpandedClusters] = useState<Set<string>>(
    () => new Set()
  );
  const [editingColor, setEditingColor] = useState<string | null>(null);
  const [newClusterName, setNewClusterName] = useState("");
  const [reassigning, setReassigning] = useState<string | null>(null);
  const [applyAll, setApplyAll] = useState(source === "curated");

  // Group concepts by cluster for current language
  const grouped = useMemo(() => {
    const groups: Record<string, { id: string; label: string }[]> = {};
    for (const concept of concepts) {
      const cluster = String(
        clusters[concept.id]?.[language] ?? concept.cluster
      );
      if (!groups[cluster]) groups[cluster] = [];
      groups[cluster].push({
        id: concept.id,
        label: getLabel(concept, language),
      });
    }
    for (const group of Object.values(groups)) {
      group.sort((a, b) => a.label.localeCompare(b.label));
    }
    return groups;
  }, [clusters, language]);

  const clusterLabels = useMemo(
    () =>
      Object.keys(grouped).sort((a, b) => {
        const aNum = Number(a);
        const bNum = Number(b);
        if (isNaN(aNum) && isNaN(bNum)) return a.localeCompare(b);
        if (isNaN(aNum)) return -1;
        if (isNaN(bNum)) return 1;
        if (aNum < 0) return 1;
        if (bNum < 0) return -1;
        return aNum - bNum;
      }),
    [grouped]
  );

  const toggleExpanded = (label: string) => {
    setExpandedClusters((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const handleAddCluster = () => {
    const name = newClusterName.trim();
    if (!name || grouped[name]) return;
    const usedColors = new Set(Object.values(clusterColors));
    const color =
      PALETTE.find((c) => !usedColors.has(c)) ||
      PALETTE[Object.keys(grouped).length % PALETTE.length];
    onAddCluster(name, color);
    setNewClusterName("");
  };

  const formatClusterName = (label: string) => {
    const n = Number(label);
    if (isNaN(n)) return label.charAt(0).toUpperCase() + label.slice(1);
    if (n < 0) return "Noise";
    return `Cluster ${label}`;
  };

  return (
    <div className="absolute left-4 top-20 bottom-16 w-[420px] z-40 bg-[#141414]/90 backdrop-blur-md border border-[#262626] rounded-lg flex flex-col font-mono text-[#e5e5e5]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div>
          <span className="text-xs text-[#737373] tracking-wider">
            CLUSTER EDITOR
          </span>
          <span className="text-[9px] text-[#525252] ml-2">
            {language.toUpperCase()}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-[#737373] hover:text-[#e5e5e5] transition-colors text-lg leading-none"
        >
          &times;
        </button>
      </div>

      {/* Toolbar */}
      <div className="px-4 pb-2 flex items-center gap-3">
        <button
          onClick={() => setApplyAll((a) => !a)}
          className="flex items-center gap-1.5 text-[9px] tracking-wider transition-colors"
          style={{ color: applyAll ? "#f59e0b" : "#525252" }}
        >
          <span
            className="w-3 h-3 rounded-sm border flex items-center justify-center text-[7px]"
            style={{
              borderColor: applyAll ? "#f59e0b" : "#525252",
              background: applyAll ? "rgba(245, 158, 11, 0.15)" : "transparent",
            }}
          >
            {applyAll ? "✓" : ""}
          </span>
          ALL LANGS
        </button>

        {hasEdits && (
          <>
            <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]" />
            <span className="text-[9px] text-[#f59e0b] tracking-wider">
              EDITED
            </span>
            <button
              onClick={onReset}
              className="ml-auto text-[9px] text-[#525252] hover:text-[#ef4444] transition-colors tracking-wider"
            >
              RESET
            </button>
          </>
        )}
      </div>

      {/* Content */}
      <div
        className="flex-1 overflow-y-auto px-4 pb-4"
        style={{ scrollbarWidth: "thin", scrollbarColor: "#262626 transparent" }}
      >
        {clusterLabels.map((label) => {
          const members = grouped[label];
          const color = clusterColors[label] || "#78716c";
          const isExpanded = expandedClusters.has(label);

          return (
            <div key={label} className="mb-1">
              {/* Cluster header */}
              <div
                className="flex items-center gap-2 py-1.5 cursor-pointer group"
                onClick={() => toggleExpanded(label)}
              >
                <span className="text-[9px] text-[#525252] w-3">
                  {isExpanded ? "▾" : "▸"}
                </span>

                <button
                  className="w-3 h-3 rounded-sm border border-[#262626] hover:border-[#525252] transition-colors flex-shrink-0"
                  style={{ background: color }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingColor(editingColor === label ? null : label);
                  }}
                  title="Change color"
                />

                <span className="text-[10px] text-[#a3a3a3] tracking-wider flex-1">
                  {formatClusterName(label)}
                </span>
                <span className="text-[9px] text-[#525252]">
                  {members.length}
                </span>
              </div>

              {/* Color picker */}
              {editingColor === label && (
                <div className="ml-6 mb-2 flex gap-1 flex-wrap p-2 bg-[#0a0a0a] border border-[#262626] rounded">
                  {PALETTE.map((c) => (
                    <button
                      key={c}
                      className="w-5 h-5 rounded-sm border transition-all"
                      style={{
                        background: c,
                        borderColor: c === color ? "#e5e5e5" : "#262626",
                        transform: c === color ? "scale(1.2)" : "scale(1)",
                      }}
                      onClick={() => {
                        onColorChange(label, c);
                        setEditingColor(null);
                      }}
                    />
                  ))}
                </div>
              )}

              {/* Concept list */}
              {isExpanded && (
                <div className="ml-6 mb-1">
                  {members.map((member) => {
                    const isSelected = member.id === selectedConcept;
                    const isReassigning = reassigning === member.id;

                    return (
                      <div key={member.id}>
                        <div
                          className="flex items-center gap-2 py-0.5 group/item"
                          style={{
                            background: isSelected
                              ? "rgba(245, 158, 11, 0.08)"
                              : "transparent",
                          }}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                            style={{ background: color }}
                          />
                          <button
                            className="text-[10px] text-[#a3a3a3] hover:text-[#e5e5e5] transition-colors text-left flex-1 truncate"
                            onClick={() => onConceptClick(member.id)}
                          >
                            {member.label}
                          </button>
                          <button
                            className="text-[8px] text-[#525252] hover:text-[#737373] transition-colors opacity-0 group-hover/item:opacity-100 tracking-wider px-1"
                            onClick={() =>
                              setReassigning(isReassigning ? null : member.id)
                            }
                          >
                            {isReassigning ? "CANCEL" : "MOVE"}
                          </button>
                        </div>

                        {/* Reassignment picker */}
                        {isReassigning && (
                          <div className="ml-4 mb-1 flex gap-1 flex-wrap p-1.5 bg-[#0a0a0a] border border-[#262626] rounded">
                            {clusterLabels
                              .filter((cl) => cl !== label)
                              .map((cl) => (
                                <button
                                  key={cl}
                                  className="flex items-center gap-1 px-1.5 py-0.5 text-[9px] text-[#a3a3a3] hover:text-[#e5e5e5] bg-[#141414] border border-[#262626] hover:border-[#525252] rounded transition-all"
                                  onClick={() => {
                                    onAssign(member.id, cl, applyAll);
                                    setReassigning(null);
                                  }}
                                >
                                  <span
                                    className="w-2 h-2 rounded-sm"
                                    style={{
                                      background:
                                        clusterColors[cl] || "#78716c",
                                    }}
                                  />
                                  {formatClusterName(cl)}
                                </button>
                              ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Add new cluster */}
        <div className="mt-3 pt-3 border-t border-[#262626]">
          <div className="text-[9px] text-[#525252] tracking-wider mb-2">
            ADD CLUSTER
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newClusterName}
              onChange={(e) => setNewClusterName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddCluster()}
              placeholder="cluster name..."
              className="flex-1 bg-[#0a0a0a] border border-[#262626] rounded px-2 py-1 text-[10px] text-[#e5e5e5] placeholder-[#525252] focus:border-[#525252] focus:outline-none"
            />
            <button
              onClick={handleAddCluster}
              disabled={!newClusterName.trim()}
              className="px-3 py-1 text-[9px] tracking-wider border border-[#262626] rounded text-[#737373] hover:text-[#e5e5e5] hover:border-[#525252] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              ADD
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
