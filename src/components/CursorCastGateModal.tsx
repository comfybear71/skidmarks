"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  CRASH_CURSOR_CAST_GATE_EVENT,
  dispatchCursorCastGateDone,
  resolveMainFromLookLine,
  type CursorCastGateDetail,
} from "@/lib/crashCursorSmoke";
import { px } from "@/lib/crashDeskLayout";

/**
 * CURSOR smoke gate 1 — main arsehole + cast names only.
 * Alter / Reject / Approve. No faces, no models.
 */
export function CursorCastGateModal() {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<CursorCastGateDetail | null>(null);
  const [mainName, setMainName] = useState("");
  const [castNames, setCastNames] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const onGate = (ev: Event) => {
      const d = (ev as CustomEvent<CursorCastGateDetail>).detail;
      if (!d?.castNames?.length) return;
      setDetail(d);
      setMainName(d.mainName || d.castNames[0] || "");
      setCastNames([...d.castNames]);
      setNotes("");
      setOpen(true);
    };
    window.addEventListener(CRASH_CURSOR_CAST_GATE_EVENT, onGate);
    return () => window.removeEventListener(CRASH_CURSOR_CAST_GATE_EVENT, onGate);
  }, []);

  function finish(ok: boolean) {
    if (!detail) return;
    const names = castNames.map((n) => n.trim()).filter(Boolean);
    const resolved = resolveMainFromLookLine(
      mainName.trim() || names[0] || "",
      notes,
      names,
    );
    dispatchCursorCastGateDone({
      ok,
      styleId: detail.styleId,
      mainName: resolved.mainName,
      castNames: resolved.castNames.length
        ? resolved.castNames
        : resolved.mainName
          ? [resolved.mainName]
          : [],
      notes: resolved.notes || undefined,
    });
    setOpen(false);
    setDetail(null);
  }

  function alterCastName(i: number, value: string) {
    setCastNames((prev) => prev.map((n, j) => (j === i ? value : n)));
  }

  function addCastRow() {
    setCastNames((prev) => [...prev, ""]);
  }

  if (!mounted || !open || !detail) return null;

  return createPortal(
    <div
      className="fixed inset-0 flex items-start justify-center bg-black/55 p-4"
      style={{ zIndex: 260 }}
      role="dialog"
      aria-label="CURSOR cast gate"
    >
      <div
        className="mt-16 w-full max-w-md rounded-sm border border-[var(--acid)] bg-[var(--panel)] shadow-xl"
        style={{ maxHeight: px(Math.min(560, typeof window !== "undefined" ? window.innerHeight - 80 : 560)) }}
      >
        <div className="border-b border-[var(--line)] px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--acid)]">
            CURSOR · Cast
          </p>
          <p className="text-[11px] text-[var(--chrome)]">
            {detail.gagLabel || "Next test gag"}
          </p>
          <p className="mt-0.5 text-[9px] text-[var(--mute)]">
            Names only — Alter / Reject / Approve. No faces yet.
          </p>
        </div>

        <div className="crash-tray-scroll max-h-[360px] space-y-3 overflow-y-auto px-3 py-3">
          <label className="block">
            <span className="text-[9px] uppercase tracking-wider text-[var(--magenta-hot)]">
              Main character (arsehole)
            </span>
            <div className="mt-1 space-y-1">
              {castNames
                .filter((n) => n.trim())
                .map((n) => (
                  <label
                    key={`main-${n}`}
                    className="flex cursor-pointer items-center gap-2 rounded-sm border border-[var(--line)] px-2 py-1.5 hover:border-[var(--acid)]/50"
                  >
                    <input
                      type="radio"
                      name="cursor-main"
                      checked={mainName === n}
                      onChange={() => setMainName(n)}
                      className="accent-[var(--magenta-hot)]"
                    />
                    <span className="text-[11px] text-[var(--chrome)]">{n}</span>
                  </label>
                ))}
            </div>
          </label>

          <div>
            <span className="text-[9px] uppercase tracking-wider text-[var(--chrome-dim)]">
              Episode cast
            </span>
            <div className="mt-1 space-y-1">
              {castNames.map((n, i) => (
                <input
                  key={`cast-${i}`}
                  type="text"
                  value={n}
                  onChange={(e) => alterCastName(i, e.target.value)}
                  className="w-full rounded-sm border border-[var(--line)] bg-[var(--void)]/40 px-2 py-1 text-[11px] text-[var(--chrome)]"
                  placeholder="Cast name"
                />
              ))}
              <button
                type="button"
                onClick={addCastRow}
                className="text-[9px] text-[var(--chrome-dim)] underline hover:text-[var(--acid)]"
              >
                + Add name
              </button>
            </div>
          </div>

          <label className="block">
            <span className="text-[9px] uppercase tracking-wider text-[var(--chrome-dim)]">
              Alter note (optional)
            </span>
            <textarea
              value={notes}
              onChange={(e) => {
                const next = e.target.value;
                setNotes(next);
                const resolved = resolveMainFromLookLine(
                  mainName,
                  next,
                  castNames,
                );
                if (
                  resolved.mainName &&
                  resolved.mainName.toLowerCase() !== mainName.trim().toLowerCase()
                ) {
                  setMainName(resolved.mainName);
                  setCastNames(resolved.castNames);
                }
              }}
              rows={2}
              placeholder="Deep Fried Terry is… — that name becomes main"
              className="mt-1 w-full rounded-sm border border-[var(--line)] bg-[var(--void)]/40 px-2 py-1 text-[11px] text-[var(--chrome)]"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--line)] px-3 py-2">
          <button
            type="button"
            onClick={() => finish(false)}
            className="rounded-sm border border-[var(--line)] px-3 py-1 text-[10px] uppercase tracking-wide text-[var(--chrome-dim)] hover:border-[var(--magenta-hot)] hover:text-[var(--magenta-hot)]"
          >
            Reject
          </button>
          <button
            type="button"
            onClick={() => finish(true)}
            className="rounded-sm border border-[var(--acid)] bg-[var(--acid)]/15 px-3 py-1 text-[10px] uppercase tracking-wide text-[var(--acid)] hover:bg-[var(--acid)]/25"
          >
            Approve
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
