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
  ghost: Record<string, boolean>;
  hero?: boolean;
  definition?: string;
  neighbors: Record<string, { id: string; label: string; distance: number }[]>;
  interpretation: string | null;
}

export default function ConceptCard({
  conceptId,
  language,
  onClose,
}: {
  conceptId: string;
  language: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<ConceptData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!conceptId) return;
    setLoading(true);
    fetch(`/api/concept/${conceptId}?lang=${language}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [conceptId, language]);

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
        <p className="text-[#a3a3a3] text-xs leading-relaxed mb-4">
          {data.definition}
        </p>
      )}

      {/* Metadata rows */}
      <div className="space-y-1.5 mb-4 text-xs">
        <Row label="cluster" value={data.cluster} />
        <Row label="source" value={data.source} />
        {data.hero && <Row label="hero" value="true" accent />}
        {Object.entries(data.weight).map(([lang, w]) => (
          <Row key={lang} label={`weight.${lang}`} value={w.toFixed(2)} />
        ))}
        {Object.entries(data.position).map(([lang, pos]) => (
          <Row
            key={lang}
            label={`pos.${lang}`}
            value={`[${pos[0].toFixed(1)}, ${pos[1].toFixed(1)}]`}
          />
        ))}
        {Object.entries(data.ghost).map(
          ([lang, isGhost]) =>
            isGhost && (
              <Row key={lang} label={`ghost.${lang}`} value="true" accent />
            )
        )}
      </div>

      {/* Nearest neighbors per language */}
      {data.neighbors &&
        Object.entries(data.neighbors).map(([lang, neighbors]) => (
          <div key={lang} className="mb-3">
            <p className="text-[#737373] text-xs mb-1">nearest ({lang})</p>
            <div className="space-y-0.5">
              {neighbors.slice(0, 5).map((n) => (
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

      {/* Interpretation placeholder */}
      {data.interpretation ? (
        <div className="mt-3 pt-3 border-t border-[#262626]">
          <p className="text-[#737373] text-xs mb-1">interpretation</p>
          <p className="text-[#a3a3a3] text-xs leading-relaxed">
            {data.interpretation}
          </p>
        </div>
      ) : (
        <div className="mt-3 pt-3 border-t border-[#262626]">
          <p className="text-[#737373] text-xs italic">
            Interpretation pending agent connection
          </p>
        </div>
      )}
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
