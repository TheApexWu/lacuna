"use client";

import {
  useMemo,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { concepts, CLUSTER_HEX, getLabel } from "../data/versailles";

// ── Constants ────────────────────────────────────────────────
const MIN_RADIUS = 4;
const MAX_RADIUS = 16;
const PADDING = 35;
const MAX_NEIGHBORS = 5;
const EDGE_THRESHOLD_RATIO = 0.22; // 22% of bounding-box diagonal
const ANIM_DURATION = 1000; // ms

function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

// ── Types ────────────────────────────────────────────────────
interface Node {
  id: string;
  label: string;
  cluster: string;
  color: string;
  radius: number;
  weight: number;
  isGhost: boolean;
  x: number;
  y: number;
}

interface Edge {
  key: string;
  sourceId: string;
  targetId: string;
}

interface ConceptNetworkGraphProps {
  language: string;
  showGhosts: boolean;
  selectedConcept: string | null;
  onConceptClick: (id: string) => void;
  onClose: () => void;
}

// ── Component ────────────────────────────────────────────────
export default function ConceptNetworkGraph({
  language,
  showGhosts,
  selectedConcept,
  onConceptClick,
  onClose,
}: ConceptNetworkGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const nodesRef = useRef<Map<string, SVGGElement>>(new Map());
  const edgeLinesRef = useRef<Map<string, SVGLineElement>>(new Map());
  const currentPositions = useRef<Record<string, { x: number; y: number }>>({});
  const animRef = useRef({
    active: false,
    startTime: 0,
    from: {} as Record<string, { x: number; y: number }>,
    to: {} as Record<string, { x: number; y: number }>,
  });
  const prevLanguageRef = useRef(language);

  const [dimensions, setDimensions] = useState({ width: 460, height: 500 });
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Measure container
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(([entry]) => {
      setDimensions({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Compute visible concepts
  const visibleConcepts = useMemo(() => {
    return concepts.filter((c) => {
      const pos = c.position[language];
      if (!pos) return false;
      const isGhost = c.ghost[language] ?? false;
      return !isGhost || showGhosts;
    });
  }, [language, showGhosts]);

  // Compute node positions scaled to panel
  const computePositions = useCallback(
    (lang: string, width: number, height: number) => {
      const visible = concepts.filter((c) => {
        const pos = c.position[lang];
        if (!pos) return false;
        const isGhost = c.ghost[lang] ?? false;
        return !isGhost || showGhosts;
      });

      if (visible.length === 0) return {};

      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const c of visible) {
        const [x, z] = c.position[lang]!;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (z < minZ) minZ = z;
        if (z > maxZ) maxZ = z;
      }

      const rangeX = maxX - minX || 1;
      const rangeZ = maxZ - minZ || 1;
      const scaleX = (width - 2 * PADDING) / rangeX;
      const scaleZ = (height - 2 * PADDING) / rangeZ;
      const scale = Math.min(scaleX, scaleZ);
      const offsetX = PADDING + (width - 2 * PADDING - rangeX * scale) / 2;
      const offsetZ = PADDING + (height - 2 * PADDING - rangeZ * scale) / 2;

      const positions: Record<string, { x: number; y: number }> = {};
      for (const c of visible) {
        const [cx, cz] = c.position[lang]!;
        positions[c.id] = {
          x: (cx - minX) * scale + offsetX,
          y: (cz - minZ) * scale + offsetZ,
        };
      }
      return positions;
    },
    [showGhosts]
  );

  // Build node data for rendering (used for initial render and structure)
  const nodes: Node[] = useMemo(() => {
    const positions = computePositions(language, dimensions.width, dimensions.height);
    return visibleConcepts.map((c) => {
      const w = c.weight[language] ?? 0;
      const pos = positions[c.id] || { x: dimensions.width / 2, y: dimensions.height / 2 };
      return {
        id: c.id,
        label: getLabel(c, language),
        cluster: c.cluster,
        color: CLUSTER_HEX[c.cluster] || "#f59e0b",
        radius: MIN_RADIUS + w * (MAX_RADIUS - MIN_RADIUS),
        weight: w,
        isGhost: c.ghost[language] ?? false,
        x: pos.x,
        y: pos.y,
      };
    });
  }, [language, visibleConcepts, dimensions, computePositions]);

  // Compute edges
  const edges: Edge[] = useMemo(() => {
    const positions = computePositions(language, dimensions.width, dimensions.height);
    const ids = visibleConcepts.map((c) => c.id);

    // Compute bounding box diagonal for adaptive threshold
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const id of ids) {
      const p = positions[id];
      if (!p) continue;
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    const diagonal = Math.sqrt((maxX - minX) ** 2 + (maxY - minY) ** 2) || 1;
    const threshold = diagonal * EDGE_THRESHOLD_RATIO;

    // Pairwise distances
    const neighborCount: Record<string, number> = {};
    const edgeSet = new Set<string>();
    const result: Edge[] = [];

    // For each node, find nearest neighbors within threshold
    for (let i = 0; i < ids.length; i++) {
      const srcId = ids[i];
      const srcPos = positions[srcId];
      if (!srcPos) continue;

      const dists: { targetId: string; dist: number }[] = [];
      for (let j = 0; j < ids.length; j++) {
        if (i === j) continue;
        const tgtId = ids[j];
        const tgtPos = positions[tgtId];
        if (!tgtPos) continue;
        const dx = srcPos.x - tgtPos.x;
        const dy = srcPos.y - tgtPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < threshold) {
          dists.push({ targetId: tgtId, dist });
        }
      }

      dists.sort((a, b) => a.dist - b.dist);
      const neighbors = dists.slice(0, MAX_NEIGHBORS);

      for (const n of neighbors) {
        const key =
          srcId < n.targetId
            ? `${srcId}-${n.targetId}`
            : `${n.targetId}-${srcId}`;
        if (edgeSet.has(key)) continue;

        // Cap per-node edge count
        const srcCount = neighborCount[srcId] || 0;
        const tgtCount = neighborCount[n.targetId] || 0;
        if (srcCount >= MAX_NEIGHBORS && tgtCount >= MAX_NEIGHBORS) continue;

        edgeSet.add(key);
        neighborCount[srcId] = srcCount + 1;
        neighborCount[n.targetId] = tgtCount + 1;
        result.push({ key, sourceId: srcId, targetId: n.targetId });
      }
    }

    return result;
  }, [language, visibleConcepts, dimensions, computePositions]);

  // Connected edges for highlighting
  const connectedEdges = useMemo(() => {
    const active = hoveredId || selectedConcept;
    if (!active) return new Set<string>();
    return new Set(
      edges
        .filter((e) => e.sourceId === active || e.targetId === active)
        .map((e) => e.key)
    );
  }, [edges, hoveredId, selectedConcept]);

  const connectedNodes = useMemo(() => {
    const active = hoveredId || selectedConcept;
    if (!active) return new Set<string>();
    const set = new Set<string>();
    for (const e of edges) {
      if (e.sourceId === active) set.add(e.targetId);
      if (e.targetId === active) set.add(e.sourceId);
    }
    return set;
  }, [edges, hoveredId, selectedConcept]);

  // Initialize current positions on first render
  useEffect(() => {
    const positions = computePositions(language, dimensions.width, dimensions.height);
    for (const [id, pos] of Object.entries(positions)) {
      if (!currentPositions.current[id]) {
        currentPositions.current[id] = { ...pos };
      }
    }
  }, [language, dimensions, computePositions]);

  // Animate on language switch
  useEffect(() => {
    if (prevLanguageRef.current === language) {
      // Not a language switch — just snap positions (e.g., dimension change)
      const positions = computePositions(language, dimensions.width, dimensions.height);
      for (const [id, pos] of Object.entries(positions)) {
        currentPositions.current[id] = { ...pos };
      }
      return;
    }

    prevLanguageRef.current = language;

    const newPositions = computePositions(language, dimensions.width, dimensions.height);

    // Snapshot "from" as current animated positions
    const from: Record<string, { x: number; y: number }> = {};
    for (const id of Object.keys(newPositions)) {
      from[id] = currentPositions.current[id]
        ? { ...currentPositions.current[id] }
        : { ...newPositions[id] };
    }

    animRef.current = {
      active: true,
      startTime: performance.now(),
      from,
      to: newPositions,
    };

    let rafId: number;

    function tick() {
      const anim = animRef.current;
      if (!anim.active) return;

      const elapsed = performance.now() - anim.startTime;
      const raw = Math.min(elapsed / ANIM_DURATION, 1);
      const t = easeOutQuad(raw);

      // Interpolate node positions via direct DOM mutation
      for (const [id, gEl] of nodesRef.current) {
        const from = anim.from[id];
        const to = anim.to[id];
        if (!from || !to) continue;

        const x = from.x + (to.x - from.x) * t;
        const y = from.y + (to.y - from.y) * t;
        gEl.setAttribute("transform", `translate(${x}, ${y})`);
        currentPositions.current[id] = { x, y };
      }

      // Interpolate edge endpoints
      for (const [key, lineEl] of edgeLinesRef.current) {
        const [srcId, tgtId] = key.split("-");
        const src = currentPositions.current[srcId];
        const tgt = currentPositions.current[tgtId];
        if (!src || !tgt) continue;
        lineEl.setAttribute("x1", String(src.x));
        lineEl.setAttribute("y1", String(src.y));
        lineEl.setAttribute("x2", String(tgt.x));
        lineEl.setAttribute("y2", String(tgt.y));
      }

      if (raw < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        anim.active = false;
      }
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [language, dimensions, computePositions]);

  // Build position lookup for initial SVG render
  const nodePositions = useMemo(() => {
    const map: Record<string, { x: number; y: number }> = {};
    for (const n of nodes) {
      map[n.id] = { x: n.x, y: n.y };
    }
    return map;
  }, [nodes]);

  return (
    <div className="absolute right-4 top-20 bottom-16 w-[500px] z-40 bg-[#141414]/90 backdrop-blur-md border border-[#262626] rounded-lg flex flex-col font-mono text-[#e5e5e5]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <span className="text-xs text-[#737373] tracking-wider">
          CONCEPT NETWORK
        </span>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-[#737373]">
            {language === "en" ? "EN" : "DE"} topology
          </span>
          <button
            onClick={onClose}
            className="text-[#737373] hover:text-[#e5e5e5] transition-colors text-lg leading-none"
          >
            &times;
          </button>
        </div>
      </div>

      {/* SVG container */}
      <div className="flex-1 relative" ref={containerRef}>
        <svg
          ref={svgRef}
          width={dimensions.width}
          height={dimensions.height}
          className="absolute inset-0"
        >
          {/* Edges */}
          {edges.map((edge) => {
            const srcPos = nodePositions[edge.sourceId];
            const tgtPos = nodePositions[edge.targetId];
            if (!srcPos || !tgtPos) return null;
            const isHighlighted = connectedEdges.has(edge.key);

            return (
              <line
                key={edge.key}
                ref={(el) => {
                  if (el) edgeLinesRef.current.set(edge.key, el);
                  else edgeLinesRef.current.delete(edge.key);
                }}
                x1={srcPos.x}
                y1={srcPos.y}
                x2={tgtPos.x}
                y2={tgtPos.y}
                stroke={isHighlighted ? "#404040" : "#262626"}
                strokeWidth={isHighlighted ? 1.5 : 0.5}
                opacity={isHighlighted ? 0.6 : 0.15}
              />
            );
          })}

          {/* Nodes */}
          {nodes.map((node) => {
            const isSelected = node.id === selectedConcept;
            const isHovered = node.id === hoveredId;
            const isConnected = connectedNodes.has(node.id);
            const highlight = isSelected || isHovered;

            return (
              <g
                key={node.id}
                ref={(el) => {
                  if (el) nodesRef.current.set(node.id, el);
                  else nodesRef.current.delete(node.id);
                }}
                transform={`translate(${node.x}, ${node.y})`}
                onClick={() => onConceptClick(node.id)}
                onMouseEnter={() => setHoveredId(node.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{ cursor: "pointer" }}
              >
                {/* Selection glow */}
                {isSelected && (
                  <circle
                    r={node.radius + 5}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    opacity={0.4}
                  />
                )}

                {/* Main node */}
                {node.isGhost ? (
                  <circle
                    r={node.radius}
                    fill={node.color}
                    fillOpacity={0.08}
                    stroke={node.color}
                    strokeWidth={1.5}
                    strokeDasharray="3,2"
                    opacity={0.5}
                  />
                ) : (
                  <circle
                    r={highlight ? node.radius * 1.15 : node.radius}
                    fill={node.color}
                    fillOpacity={
                      highlight ? 0.9 : isConnected ? 0.75 : 0.65
                    }
                    stroke={highlight ? "#e5e5e5" : "none"}
                    strokeWidth={highlight ? 1 : 0}
                  />
                )}

                {/* Label */}
                <text
                  y={node.radius + 12}
                  textAnchor="middle"
                  fill={
                    isSelected
                      ? "#f59e0b"
                      : isHovered
                        ? "#e5e5e5"
                        : isConnected
                          ? "#a3a3a3"
                          : "#737373"
                  }
                  fontSize={9}
                  fontFamily="monospace"
                >
                  {node.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
