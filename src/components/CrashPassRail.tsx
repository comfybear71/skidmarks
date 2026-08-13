"use client";

import { useEffect, useState } from "react";
import {
  CRASH_PASS_STEPS,
  emptyPassState,
  readPassState,
  writePassState,
  type CrashPassState,
  type CrashPassStepId,
  type CrashPassVerdict,
} from "@/lib/crashPassRail";

/**
 * Thin Pass → next episode rail. Scaffold only — no AI director.
 */
export function CrashPassRail() {
  const [state, setState] = useState<CrashPassState>(() => emptyPassState());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setState(readPassState());
    setReady(true);
  }, []);

  function setVerdict(id: CrashPassStepId, verdict: CrashPassVerdict) {
    setState((prev) => {
      const next = { ...prev, [id]: verdict };
      writePassState(next);
      return next;
    });
  }

  if (!ready) return null;

  return (
    <div className="flex flex-wrap items-center gap-1 border-t border-[var(--line)] bg-[var(--void)]/40 px-3 py-1">
      <span className="mr-1 text-[8px] uppercase tracking-[0.15em] text-[var(--mute)]">
        Pass rail
      </span>
      {CRASH_PASS_STEPS.map((step, i) => {
        const v = state[step.id];
        return (
          <div key={step.id} className="flex items-center gap-0.5">
            {i > 0 ? (
              <span className="px-0.5 text-[8px] text-[var(--mute)]">→</span>
            ) : null}
            <span
              className={`rounded-sm border px-1.5 py-0.5 text-[9px] ${
                v === "pass"
                  ? "border-[var(--acid)]/60 text-[var(--acid)]"
                  : v === "fail"
                    ? "border-[var(--magenta-hot)]/60 text-[var(--magenta-hot)]"
                    : "border-[var(--line)] text-[var(--chrome-dim)]"
              }`}
            >
              {step.label}
            </span>
            <button
              type="button"
              className="text-[8px] text-[var(--acid)] hover:underline"
              title="Pass (stub — saves in this browser)"
              onClick={() => setVerdict(step.id, "pass")}
            >
              P
            </button>
            <button
              type="button"
              className="text-[8px] text-[var(--magenta-hot)] hover:underline"
              title="Fail (stub — saves in this browser)"
              onClick={() => setVerdict(step.id, "fail")}
            >
              F
            </button>
          </div>
        );
      })}
      <span className="ml-auto text-[7px] text-[var(--mute)]">
        Stub — no auto director yet
      </span>
    </div>
  );
}
