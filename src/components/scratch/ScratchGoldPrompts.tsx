"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  SCRATCH_GOLD_SCENARIOS,
  type ScratchGoldScenario,
} from "@/lib/scratchBench/goldScenarios";

/**
 * Gold prompts — one example per situation we incur.
 * Opens a short menu; pick fills Prompt or LTX Image motion.
 */
export function ScratchGoldPrompts({
  disabled,
  onPick,
}: {
  disabled?: boolean;
  onPick: (scenario: ScratchGoldScenario) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const el = rootRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="scratch-gold" ref={rootRef}>
      <button
        type="button"
        className={`scratch-gold-btn${open ? " is-open" : ""}`}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        Gold prompts
      </button>
      {open ? (
        <div id={menuId} className="scratch-gold-menu" role="menu">
          <p className="scratch-gold-menu-lead">
            One proven base per situation — pick to load. Refine after Pass.
          </p>
          {SCRATCH_GOLD_SCENARIOS.map((row) => (
            <button
              key={row.id}
              type="button"
              role="menuitem"
              className="scratch-gold-item"
              disabled={disabled}
              onClick={() => {
                onPick(row);
                setOpen(false);
              }}
            >
              <span className="scratch-gold-item-label">{row.label}</span>
              <span className="scratch-gold-item-for">{row.forWhat}</span>
              <span className="scratch-gold-item-meta">
                {row.target === "motion" ? "→ Image motion" : "→ Prompt"} · {row.provenOn}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
