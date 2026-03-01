"use client";

import { MODELS } from "../data/embeddings/models";

interface ModelSelectorProps {
  activeModel: string;
  onModelChange: (modelId: string) => void;
}

export default function ModelSelector({
  activeModel,
  onModelChange,
}: ModelSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-[#737373] tracking-wider">MODEL</span>
      <select
        value={activeModel}
        onChange={(e) => onModelChange(e.target.value)}
        className="bg-[#0a0a0a] border border-[#262626] rounded px-2 py-1 text-[10px] text-[#e5e5e5] tracking-wider cursor-pointer font-mono"
        style={{ outline: "none" }}
      >
        {MODELS.map((m) => (
          <option key={m.id} value={m.id}>
            {m.shortName}
            {m.status === "stub" ? " ◌" : m.status === "live" ? " ●" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
