/** Shared resize limits for every Crash Lab floating card. */
export const CRASH_PANEL_MIN_W = 220;
/** Title bar + one line — panels can shrink to a strip. */
export const CRASH_PANEL_MIN_H = 88;

export const CRASH_SCRIPT_MIN_W = 320;
export const CRASH_SCRIPT_MIN_H = 200;

export const CRASH_GEN_MIN_W = 280;
export const CRASH_GEN_MIN_H = 240;

export const CRASH_MORPH_MIN_W = 280;
export const CRASH_MORPH_MIN_H = 160;

/** Side panels (Voice / Story / SPX) — start compact, grow if you drag. */
export const CRASH_SIDE_PANEL_DEFAULT_H = 260;

/** Shared title bar — fixed height so stacked strips line up evenly. */
export const CRASH_PANEL_TITLE_BAR =
  "flex h-8 shrink-0 cursor-grab items-center gap-2 border-b border-[var(--line)] bg-[var(--panel-2)] px-2 active:cursor-grabbing";

export const CRASH_PANEL_TITLE_COL =
  "display w-[5.75rem] shrink-0 text-sm leading-none";

export const CRASH_PANEL_SUBTITLE_COL =
  "min-w-0 flex-1 truncate text-[9px] uppercase tracking-[0.12em] text-[var(--acid-deep)]";
