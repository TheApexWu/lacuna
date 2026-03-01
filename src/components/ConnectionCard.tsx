"use client";

import { useState, useEffect, useMemo } from "react";
import { concepts, getLabel, CLUSTER_HEX } from "../data/versailles";
import { MODELS } from "../data/embeddings/models";
import type { EmbeddingData } from "../data/embeddings";
import { loadModelData } from "../data/embeddings";

interface ConnectionCardProps {
  conceptId: string;
  language: string;
  onClose: () => void;
}

interface ModelDistance {
  modelId: string;
  modelName: string;
  status: string;
  distances: Record<string, number>; // otherConceptId → distance
}

export default function ConnectionCard({
  conceptId,
  language,
  onClose,
}: ConnectionCardProps) {
  const [modelDistances, setModelDistances] = useState<ModelDistance[]>([]);
  const [loading, setLoading] = useState(true);

  const concept = concepts.find((c) => c.id === conceptId);

  useEffect(() => {
    if (!conceptId) return;
    setLoading(true);

    const modelIds = MODELS.map((m) => m.id);
    Promise.all(
      modelIds.map(async (modelId) => {
        const data = await loadModelData(modelId);
        if (!data) return null;

        const order = data.conceptOrder || concepts.map((c) => c.id);
        const idx = order.indexOf(conceptId);
        if (idx === -1) return null;

        const pw = data.pairwise?.[language];
        if (!pw || !pw[idx]) return null;

        const distances: Record<string, number> = {};
        for (let j = 0; j < order.length; j++) {
          if (j !== idx) {
            distances[order[j]] = pw[idx][j];
          }
        }

        return {
          modelId: data.modelId,
          modelName: data.modelName,
          status: data.status,
          distances,
        };
      })
    ).then((results) => {
      setModelDistances(results.filter(Boolean) as ModelDistance[]);
      setLoading(false);
    });
  }, [conceptId, language]);

  // Find top divergent pairs (concepts where models disagree most)
  const divergentPairs = useMemo(() => {
    if (modelDistances.length < 2) return [];

    const otherIds = concepts
      .filter((c) => c.id !== conceptId)
      .map((c) => c.id);

    const scored = otherIds.map((otherId) => {
      const dists = modelDistances
        .map((md) => md.distances[otherId])
        .filter((d) => d !== undefined);

      if (dists.length < 2) return { otherId, disagreement: 0, dists: [] };

      const mean = dists.reduce((a, b) => a + b, 0) / dists.length;
      const variance = dists.reduce((a, d) => a + (d - mean) ** 2, 0) / dists.length;

      return {
        otherId,
        disagreement: Math.sqrt(variance),
        dists: modelDistances.map((md) => ({
          model: md.modelId,
          dist: md.distances[otherId] ?? 0,
        })),
      };
    });

    return scored.sort((a, b) => b.disagreement - a.disagreement).slice(0, 8);
  }, [modelDistances, conceptId]);

  if (!concept) return null;

  return (
    <div className="absolute left-4 top-20 bottom-16 w-[420px] z-40 bg-[#141414]/90 backdrop-blur-md border border-[#262626] rounded-lg flex flex-col font-mono text-[#e5e5e5]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: CLUSTER_HEX[concept.cluster] || "#78716c" }}
          />
          <span className="text-xs text-[#e5e5e5] tracking-wider">
            {getLabel(concept, language).toUpperCase()}
          </span>
          <span className="text-[9px] text-[#737373]">CONNECTIONS</span>
        </div>
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
        {loading ? (
          <p className="text-[10px] text-[#737373] mt-4">
            Loading model comparisons...
          </p>
        ) : (
          <>
            {/* Model distance overview */}
            <div className="mb-4">
              <div className="text-[10px] text-[#737373] tracking-wider mb-2">
                PER-MODEL DISTANCES ({language.toUpperCase()})
              </div>
              <table className="w-full text-[9px]">
                <thead>
                  <tr className="text-[#525252]">
                    <th className="text-left py-1">Model</th>
                    <th className="text-right py-1">Status</th>
                    <th className="text-right py-1">Avg Dist</th>
                  </tr>
                </thead>
                <tbody>
                  {modelDistances.map((md) => {
                    const dists = Object.values(md.distances);
                    const avg = dists.length > 0
                      ? dists.reduce((a, b) => a + b, 0) / dists.length
                      : 0;
                    return (
                      <tr key={md.modelId} className="text-[#a3a3a3]">
                        <td className="py-1">{md.modelName}</td>
                        <td className="text-right py-1">
                          <span
                            className="inline-block w-1.5 h-1.5 rounded-full mr-1"
                            style={{
                              background: md.status === "live" ? "#22c55e" : "#f59e0b",
                            }}
                          />
                          <span className="text-[#525252]">{md.status}</span>
                        </td>
                        <td className="text-right py-1 tabular-nums">
                          {avg.toFixed(3)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Most divergent connections */}
            <div className="border-t border-[#262626] pt-3">
              <div className="text-[10px] text-[#737373] tracking-wider mb-2">
                HIGHEST MODEL DISAGREEMENT
              </div>
              <p className="text-[9px] text-[#525252] mb-2">
                Concepts where models disagree most about distance to{" "}
                {getLabel(concept, language)}
              </p>

              {divergentPairs.map((pair) => {
                const otherConcept = concepts.find((c) => c.id === pair.otherId);
                if (!otherConcept) return null;

                return (
                  <div
                    key={pair.otherId}
                    className="mb-2 p-2 border border-[#1a1a1a] rounded hover:border-[#262626] transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{
                            background:
                              CLUSTER_HEX[otherConcept.cluster] || "#78716c",
                          }}
                        />
                        <span className="text-[10px] text-[#e5e5e5]">
                          {getLabel(otherConcept, language)}
                        </span>
                      </div>
                      <span className="text-[9px] text-[#ef4444]">
                        σ={pair.disagreement.toFixed(3)}
                      </span>
                    </div>

                    {/* Per-model distances */}
                    <div className="flex gap-1 flex-wrap">
                      {pair.dists.map((d) => {
                        const info = MODELS.find((m) => m.id === d.model);
                        return (
                          <span
                            key={d.model}
                            className="text-[8px] bg-[#0a0a0a] border border-[#1a1a1a] rounded px-1.5 py-0.5"
                          >
                            <span className="text-[#525252]">
                              {info?.shortName ?? d.model}
                            </span>
                            <span className="text-[#a3a3a3] ml-1">
                              {d.dist.toFixed(2)}
                            </span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
