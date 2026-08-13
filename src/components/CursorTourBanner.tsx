"use client";

import { useEffect, useState } from "react";
import {
  CRASH_CURSOR_TOUR_EVENT,
  dispatchCursorProceed,
  dispatchCursorReject,
  type CursorTourDetail,
} from "@/lib/crashCursorTour";

/** Above desk toolbar (z 5000) and floating panels — never buried. */
const TOUR_Z = 6000;

export function CursorTourBanner() {
  const [tour, setTour] = useState<CursorTourDetail | null>(null);

  useEffect(() => {
    const onTour = (e: Event) => {
      setTour((e as CustomEvent<CursorTourDetail>).detail);
    };
    window.addEventListener(CRASH_CURSOR_TOUR_EVENT, onTour);
    return () => window.removeEventListener(CRASH_CURSOR_TOUR_EVENT, onTour);
  }, []);

  if (!tour || tour.phase === "idle") return null;

  const buildPct =
    typeof tour.buildPct === "number"
      ? Math.max(0, Math.min(100, tour.buildPct))
      : null;
  const working = tour.phase === "running";
  const errored = tour.phase === "error";
  const canDecide =
    tour.phase === "awaiting" || tour.phase === "done" || errored;

  return (
    <div
      className={`fixed left-1/2 w-[min(440px,calc(100vw-2rem))] -translate-x-1/2 rounded-sm border px-4 py-3 shadow-2xl ${
        errored
          ? "border-red-500 bg-[var(--panel)]"
          : tour.phase === "done"
            ? "border-[var(--acid)] bg-[var(--panel)]"
            : "border-[var(--magenta-hot)] bg-[var(--panel)]"
      }`}
      style={{ top: "5.5rem", zIndex: TOUR_Z }}
    >
      <p className="text-[11px] font-medium text-[var(--chrome)]">
        {errored
          ? "CURSOR failed — read this"
          : tour.phase === "done"
            ? "CURSOR done"
            : working
              ? "CURSOR working…"
              : "CURSOR — your turn"}
      </p>
      <p
        className={`mt-0.5 text-[10px] ${
          errored ? "text-red-400" : "text-[var(--chrome-dim)]"
        }`}
      >
        {tour.label}
      </p>
      {tour.folderName ? (
        <p className="mt-0.5 font-mono text-[9px] text-[var(--mute)]">
          {tour.folderName}
        </p>
      ) : null}
      {buildPct !== null && !errored ? (
        <div className="mt-2">
          <div className="mb-1 flex justify-between text-[8px] text-[var(--mute)]">
            <span>{working ? "Working…" : "Ready"}</span>
            <span>
              {tour.buildCurrent != null && tour.buildTotal
                ? `${tour.buildCurrent}/${tour.buildTotal} · `
                : ""}
              {buildPct}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-sm border border-[var(--line)] bg-[var(--bg)]">
            <div
              className={`h-full transition-[width] duration-500 ease-out ${
                working ? "bg-[var(--magenta-hot)]" : "bg-[var(--acid)]"
              }`}
              style={{ width: `${buildPct}%` }}
            />
          </div>
        </div>
      ) : null}
      {tour.previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={tour.previewUrl}
          alt=""
          className="mt-2 max-h-28 w-full rounded-sm object-contain bg-[var(--void)]"
        />
      ) : null}
      {canDecide ? (
        errored ? (
          <button
            type="button"
            className="mt-3 w-full rounded-sm border border-red-500 bg-red-500/20 px-3 py-2 text-[12px] font-medium uppercase tracking-wide text-red-300 hover:bg-red-500/30"
            onClick={() => setTour(null)}
          >
            Dismiss
          </button>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              className="rounded-sm border border-[var(--fail)] bg-[var(--fail)]/15 px-3 py-2 text-[12px] font-medium uppercase tracking-wide text-[var(--fail)] hover:bg-[var(--fail)]/25"
              onClick={() => {
                dispatchCursorReject();
                setTour(null);
              }}
            >
              Reject
            </button>
            <button
              type="button"
              className="rounded-sm border border-[var(--acid)] bg-[var(--acid)]/20 px-3 py-2 text-[12px] font-medium uppercase tracking-wide text-[var(--acid)] hover:bg-[var(--acid)]/30"
              onClick={() => dispatchCursorProceed()}
            >
              Approve
            </button>
          </div>
        )
      ) : (
        <p className="mt-2 text-center text-[9px] text-[var(--mute)]">
          Wait for the meter…
        </p>
      )}
    </div>
  );
}
