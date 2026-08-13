"use client";

type Props = {
  /** Lit segments 0–10 (0 = all dim). */
  level: number;
  label?: string;
};

function segmentClass(n: number, lit: boolean): string {
  const base =
    "h-3 w-2 rounded-[1px] border transition-colors duration-75";
  if (!lit) {
    return `${base} border-[var(--line)] bg-[var(--void)] opacity-40`;
  }
  if (n <= 6) {
    return `${base} border-green-400 bg-green-500 shadow-[0_0_5px_rgba(74,222,128,0.55)]`;
  }
  if (n <= 8) {
    return `${base} border-orange-400 bg-orange-500 shadow-[0_0_5px_rgba(251,146,60,0.55)]`;
  }
  return `${base} border-red-400 bg-red-500 shadow-[0_0_5px_rgba(248,113,113,0.55)]`;
}

/** LED VU-style meter — green → orange → red while style syncs to Image gen. */
export function CrashStyleVuMeter({ level, label }: Props) {
  const lit = Math.max(0, Math.min(10, Math.round(level)));

  return (
    <div
      className="flex flex-col items-center gap-2 rounded-sm border border-[var(--line)] bg-[var(--void)]/95 px-3 py-2 shadow-lg backdrop-blur-sm"
      role="progressbar"
      aria-valuenow={lit}
      aria-valuemin={0}
      aria-valuemax={10}
      aria-label={label ? `Loading ${label}` : "Loading style"}
    >
      {label ? (
        <p className="text-[9px] uppercase tracking-wider text-[var(--acid)]">
          {label}
        </p>
      ) : null}
      <div className="flex items-end gap-0.5">
        {Array.from({ length: 10 }, (_, i) => {
          const n = i + 1;
          return (
            <span
              key={n}
              className={segmentClass(n, n <= lit)}
              style={{ height: `${10 + n * 1.5}px` }}
            />
          );
        })}
      </div>
      <p className="text-[8px] text-[var(--mute)]">Image gen</p>
    </div>
  );
}
