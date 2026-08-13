"use client";

export type AnimateTab = "ltx" | "lipsync" | "boom";

const TAB_KEY = "crash-animate-tab-v1";

const TABS: { id: AnimateTab; label: string }[] = [
  { id: "ltx", label: "LTX" },
  { id: "lipsync", label: "Lipsync" },
  { id: "boom", label: "Boom" },
];

export function readAnimateTab(): AnimateTab {
  try {
    const raw = localStorage.getItem(TAB_KEY);
    if (raw === "ltx" || raw === "lipsync" || raw === "boom") return raw;
  } catch {
    /* ignore */
  }
  return "ltx";
}

export function writeAnimateTab(tab: AnimateTab): void {
  try {
    localStorage.setItem(TAB_KEY, tab);
  } catch {
    /* ignore */
  }
}

export function animateTabSubtitle(tab: AnimateTab): string {
  switch (tab) {
    case "ltx":
      return "Plate + mp3 → LTX mp4";
    case "lipsync":
      return "MuseTalk on LTX mp4";
    case "boom":
      return "Pick picture → Go → Keep";
  }
}

type Props = {
  active: AnimateTab;
  onChange: (tab: AnimateTab) => void;
  ltxRunning?: boolean;
  lipsyncRunning?: boolean;
  boomRunning?: boolean;
};

export function AnimateModeTabs({
  active,
  onChange,
  ltxRunning = false,
  lipsyncRunning = false,
  boomRunning = false,
}: Props) {
  function pick(tab: AnimateTab) {
    onChange(tab);
    writeAnimateTab(tab);
  }

  function dot(tab: AnimateTab): boolean {
    if (tab === active) return false;
    if (tab === "ltx") return ltxRunning;
    if (tab === "lipsync") return lipsyncRunning;
    return boomRunning;
  }

  return (
    <div className="mb-2 flex shrink-0 border-b border-[var(--line)] bg-[var(--panel-2)]">
      {TABS.map(({ id, label }) => {
        const on = active === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => pick(id)}
            className={`relative flex-1 px-2 py-1.5 text-[10px] uppercase tracking-wider transition-colors ${
              on
                ? "bg-[var(--magenta-hot)] font-medium text-[var(--void)]"
                : "text-[var(--chrome-dim)] hover:bg-[var(--magenta-hot)]/10 hover:text-[var(--chrome)]"
            }`}
          >
            {label}
            {dot(id) ? (
              <span
                className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[var(--acid)] animate-pulse"
                title="Job running"
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
