"use client";

import { useState } from "react";
import { CRASH_SHOT_KITS, type CrashShotKitId } from "@/lib/crashShotKits";

/**
 * Shot-type presets — labels + kit. No auto-router yet.
 */
export function CrashShotKitStrip() {
  const [active, setActive] = useState<CrashShotKitId>("boom");
  const hit = CRASH_SHOT_KITS.find((k) => k.id === active) || CRASH_SHOT_KITS[0];

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-t border-[var(--line)] bg-[var(--panel-2)]/80 px-3 py-1">
      <span className="text-[8px] uppercase tracking-[0.15em] text-[var(--mute)]">
        Shot type
      </span>
      {CRASH_SHOT_KITS.map((k) => (
        <button
          key={k.id}
          type="button"
          onClick={() => {
            setActive(k.id);
            if (k.id === "boom") {
              window.dispatchEvent(new CustomEvent("crash-wan-fx-focus"));
              document
                .getElementById("wan-fx-baby")
                ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
            }
          }}
          className={`rounded-sm border px-2 py-0.5 text-[9px] ${
            active === k.id
              ? "border-[var(--acid)] bg-[var(--acid)]/15 text-[var(--acid)]"
              : "border-[var(--line)] text-[var(--chrome-dim)] hover:text-[var(--chrome)]"
          }`}
          title={k.blurb}
        >
          {k.label}
          {k.status === "stub" ? (
            <span className="ml-1 text-[7px] text-[var(--mute)]">stub</span>
          ) : null}
        </button>
      ))}
      <span className="min-w-0 flex-1 truncate text-[8px] text-[var(--mute)]">
        {hit.kit} — {hit.blurb}
      </span>
    </div>
  );
}
