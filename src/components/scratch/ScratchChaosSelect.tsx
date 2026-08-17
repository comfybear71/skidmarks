"use client";

import { SCRATCH_CHAOS_PRESETS } from "@/lib/scratchBench/chaosPresets";
import type { ScratchChaosId } from "@/lib/scratchBench/types";

export function ScratchChaosSelect({
  value,
  onChange,
  disabled,
}: {
  value: ScratchChaosId;
  onChange: (id: ScratchChaosId) => void;
  disabled?: boolean;
}) {
  const active = SCRATCH_CHAOS_PRESETS.find((p) => p.id === value) || SCRATCH_CHAOS_PRESETS[0]!;
  return (
    <label className="scratch-chaos">
      <span className="scratch-chaos-label">Chaos</span>
      <select
        className="scratch-chaos-select"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as ScratchChaosId)}
      >
        {SCRATCH_CHAOS_PRESETS.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>
      {active.hint ? <span className="scratch-chaos-hint">{active.hint}</span> : null}
    </label>
  );
}
