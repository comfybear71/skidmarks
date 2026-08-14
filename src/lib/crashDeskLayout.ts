import type { CardGeom } from "@/components/CrashLabFloatingPanel";
import { CRASH_SCRIPT_MIN_W } from "./crashLabPanel";

export const CRASH_DESK_LAYOUT_VER = "19";
export const CRASH_DESK_MODE_KEY = "crashlab-desk-mode";
export const CRASH_DESK_MODE_EVENT = "crash-desk-mode";
/** One-shot unjam stamp — not show style / episode / scene kit. */
export const CRASH_DESK_UNJAM_KEY = "crashlab-desk-unjam";

export type CrashDeskMode = "stack" | "grid" | "free";

export const CRASH_PANEL_SHUT_KEY = "crashlab-panel-shut";
export const CRASH_PANEL_SHUT_EVENT = "crash-panel-shut";

/** One panel pulled open beside the left strip stack (STACK mode). */
export const CRASH_STACK_FOCUS_KEY = "crashlab-stack-focus";
export const CRASH_STACK_FOCUS_EVENT = "crash-stack-focus";

/** Panels pulled out in FREE FLOW (2/3/more at once). */
export const CRASH_FREE_FLOAT_KEY = "crashlab-free-float";
export const CRASH_FREE_FLOAT_EVENT = "crash-free-float";

/** Saved x/y/w/h per panel in free-flow mode. */
export const CRASH_FREE_GEOM_KEY = "crashlab-free-geom";

export type FreeGeomMap = Partial<Record<CrashPanelId, CardGeom>>;

/** Gap below layout toolbar / header. */
export const DESK_HEADER_GAP = 12;

export const CRASH_DESK_TOP_EVENT = "crash-desk-top";

export const DESK_PANEL_GAP = 8;
export const DESK_MARGIN = 12;
export const CRASH_STRIP_W = 340;
export const CRASH_STRIP_H = 32;
export const CRASH_STRIP_GAP = 6;

/** CSS pixel string — keeps server/client style objects identical (React hydration). */
export function px(n: number): string {
  return `${n}px`;
}

export type CrashPanelId =
  | "script"
  | "character"
  | "imageGen"
  | "voice"
  | "sceneKit"
  | "spx"
  | "morph"
  | "story"
  | "comfy"
  | "storyboard"
  | "script-upload"
  | "character-roster"
  | "script-storyboard";

/**
 * Stack strip order (Animate-first). Character → Image gen → Voice → Scene kit → Animate
 * sit together. Story is retired (type only) — not in this list so it doesn't leave a gap.
 */
export const CRASH_DESK_LIVE_PANELS: CrashPanelId[] = [
  "script",
  "character",
  "imageGen",
  "voice",
  "sceneKit",
  "comfy",
  "morph",
  "spx",
  "storyboard",
];

/** Full id list including retired Story (geom / old keys). Strip Y uses LIVE only. */
export const CRASH_PANEL_ORDER: CrashPanelId[] = [
  ...CRASH_DESK_LIVE_PANELS,
  "story",
];

/** Safe Stack focus when the stored panel is retired or not mounted. */
export const CRASH_STACK_FALLBACK: CrashPanelId = "comfy";

/**
 * Panel to open when putting the current stack focus away.
 * Prefer classic park-all (null). Kept for callers that want a handoff panel.
 */
export function stackFocusAfterClose(closingId: CrashPanelId): CrashPanelId {
  if (CRASH_STACK_FALLBACK !== closingId) return CRASH_STACK_FALLBACK;
  const other = CRASH_DESK_LIVE_PANELS.find((id) => id !== closingId);
  return other ?? CRASH_STACK_FALLBACK;
}

/** null = all strips parked (classic STACK). */
export function parkStackPanels(): void {
  writeStackFocusPanel(null);
}

export type PanelShutMap = Partial<Record<CrashPanelId, boolean>>;

function vw(): number {
  return typeof window !== "undefined" ? window.innerWidth : 1400;
}

function vh(): number {
  return typeof window !== "undefined" ? window.innerHeight : 900;
}

/**
 * Phone/small-tablet viewport — panels go full-width instead of the desktop
 * strip+focus / 4-column layouts. Only call from live (post-mount) geometry
 * paths, never from crashPanelSsrGeom/openColumnsAt's literal SSR call.
 */
export function isNarrowViewport(): boolean {
  return typeof window !== "undefined" ? window.innerWidth < 768 : false;
}

/** Keep panels fully on screen — bottom stays above taskbar, top below desk toolbar. */
export function clampCardGeom(
  g: CardGeom,
  minW: number,
  minH: number,
): CardGeom {
  const top = deskTopY();
  const bottomPad = 28;
  const maxBottom = Math.max(top + minH, vh() - bottomPad);
  const maxW = Math.max(minW, vw() - DESK_MARGIN * 2);
  let w = Math.max(minW, Math.min(g.w, maxW));
  let h = Math.max(minH, g.h);
  let x = Math.max(DESK_MARGIN / 2, g.x);
  let y = Math.max(top, g.y);
  if (y + h > maxBottom) {
    h = Math.max(minH, maxBottom - y);
  }
  if (y + h > maxBottom) {
    y = Math.max(top, maxBottom - h);
  }
  if (x + w > vw() - DESK_MARGIN / 2) {
    x = Math.max(DESK_MARGIN / 2, vw() - DESK_MARGIN / 2 - w);
  }
  return { x, y, w, h };
}

let cachedDeskTop = 100;
let refreshQueued = false;
let deskTopObserver: ResizeObserver | null = null;

/** Bottom edge for panels — below toolbar when present, else header + gap. */
export function deskTopY(): number {
  if (typeof window !== "undefined") {
    const toolbar = document.getElementById("crash-desk-toolbar");
    if (toolbar) {
      cachedDeskTop =
        Math.ceil(toolbar.getBoundingClientRect().bottom) + DESK_HEADER_GAP;
      return cachedDeskTop;
    }
    const header = document.querySelector("header");
    if (header) {
      cachedDeskTop =
        Math.ceil(header.getBoundingClientRect().bottom) + DESK_HEADER_GAP;
      return cachedDeskTop;
    }
  }
  return cachedDeskTop;
}

function broadcastDeskTopIfChanged(before: number): void {
  const after = deskTopY();
  if (after !== before && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CRASH_DESK_TOP_EVENT));
  }
}

/** Re-measure once per frame — only notifies panels when Y actually changed. */
export function refreshDeskTop(): number {
  if (typeof window === "undefined") return cachedDeskTop;

  if (refreshQueued) return cachedDeskTop;
  refreshQueued = true;
  requestAnimationFrame(() => {
    refreshQueued = false;
    const before = cachedDeskTop;
    broadcastDeskTopIfChanged(before);
  });
  return deskTopY();
}

/** One shared observer for the whole desk (not one per panel). */
export function ensureDeskTopObserver(): void {
  if (typeof window === "undefined" || deskTopObserver) return;

  const onResize = () => refreshDeskTop();
  deskTopObserver = new ResizeObserver(onResize);

  const header = document.querySelector("header");
  if (header) {
    deskTopObserver.observe(header);
    header.querySelectorAll("img").forEach((img) => {
      if (!(img as HTMLImageElement).complete) {
        img.addEventListener("load", () => refreshDeskTop(), { once: true });
      }
    });
  }

  window.addEventListener("resize", onResize);
}

export function stackStripY(index: number): number {
  return deskTopY() + index * (CRASH_STRIP_H + CRASH_STRIP_GAP);
}

export function clampPanelY(y: number): number {
  return Math.max(deskTopY(), y);
}

export function clampPanelGeom(geom: CardGeom): CardGeom {
  return { ...geom, y: clampPanelY(geom.y) };
}

function deskHeightAt(viewH: number, top: number): number {
  return Math.min(720, Math.max(400, viewH - top - 12));
}

function openColumnsAt(
  viewW: number,
  viewH: number,
  top: number,
): Record<CrashPanelId, CardGeom> {
  const H = deskHeightAt(viewH, top);
  const gap = DESK_PANEL_GAP;
  const margin = DESK_MARGIN;
  const usable = viewW - margin * 2 - gap * 3;
  const colW = Math.max(CRASH_SCRIPT_MIN_W, Math.floor(usable / 4));

  let x = margin;
  const script: CardGeom = { x, y: top, w: colW, h: H };
  x += colW + gap;

  const charH = Math.floor((H - gap) * 0.42);
  const character: CardGeom = { x, y: top, w: colW, h: charH };
  const imageGen: CardGeom = {
    x,
    y: top + charH + gap,
    w: colW,
    h: H - charH - gap,
  };
  x += colW + gap;

  const stackH = Math.floor((H - gap * 3) / 4);
  const voice: CardGeom = { x, y: top, w: colW, h: stackH };
  const sceneKit: CardGeom = {
    x,
    y: top + stackH + gap,
    w: colW,
    h: stackH,
  };
  const spx: CardGeom = {
    x,
    y: top + (stackH + gap) * 2,
    w: colW,
    h: stackH,
  };
  const morph: CardGeom = {
    x,
    y: top + (stackH + gap) * 3,
    w: colW,
    h: H - (stackH + gap) * 3,
  };
  x += colW + gap;

  const comfyH = Math.floor((H - gap) * 0.58);
  const comfy: CardGeom = { x, y: top, w: colW, h: comfyH };
  const storyboard: CardGeom = {
    x,
    y: top + comfyH + gap,
    w: colW,
    h: H - comfyH - gap,
  };
  const story: CardGeom = { x, y: top, w: colW, h: CRASH_STRIP_H };

  // New script pipeline panels (positioned off-screen initially, user drags into view)
  const scriptUpload: CardGeom = {
    x: viewW - 380,
    y: top,
    w: 360,
    h: 320,
  };
  const characterRoster: CardGeom = {
    x: viewW - 380,
    y: top + 340,
    w: 360,
    h: 400,
  };
  const scriptStoryboard: CardGeom = {
    x: viewW - 760,
    y: top,
    w: 360,
    h: 500,
  };

  return {
    script,
    character,
    imageGen,
    voice,
    sceneKit,
    spx,
    morph,
    story,
    comfy,
    storyboard,
    "script-upload": scriptUpload,
    "character-roster": characterRoster,
    "script-storyboard": scriptStoryboard,
  };
}

function deskHeight(): number {
  return deskHeightAt(vh(), deskTopY());
}

function openColumns(): Record<CrashPanelId, CardGeom> {
  return openColumnsAt(vw(), vh(), deskTopY());
}

/** Fixed grid geom — identical on server and first client paint (no window). */
export function crashPanelSsrGeom(id: CrashPanelId): CardGeom {
  return openColumnsAt(1400, 900, 100)[id];
}

export function crashPanelOpenGeom(id: CrashPanelId): CardGeom {
  return openColumns()[id];
}

export function crashPanelClosedGeom(id: CrashPanelId): CardGeom {
  const live = CRASH_DESK_LIVE_PANELS.indexOf(id);
  const i = live >= 0 ? live : CRASH_DESK_LIVE_PANELS.length;
  const w = isNarrowViewport() ? vw() - DESK_MARGIN * 2 : CRASH_STRIP_W;
  return {
    x: DESK_MARGIN,
    y: stackStripY(i),
    w,
    h: CRASH_STRIP_H,
  };
}

/**
 * Stack mode — one panel expanded. Desktop: to the right of the left strip
 * column. Narrow (phone): full width below the toolbar — the strip column
 * doesn't fit beside it, so the focused panel takes the whole screen.
 */
export function crashPanelFocusGeom(id: CrashPanelId): CardGeom {
  const top = deskTopY();
  const H = deskHeight();
  if (isNarrowViewport()) {
    const w = Math.max(CRASH_SCRIPT_MIN_W, vw() - DESK_MARGIN * 2);
    return { x: DESK_MARGIN, y: top, w, h: H };
  }
  const x = DESK_MARGIN + CRASH_STRIP_W + DESK_PANEL_GAP;
  const w = Math.max(CRASH_SCRIPT_MIN_W, vw() - x - DESK_MARGIN);
  return { x, y: top, w, h: H };
}

/** First pull in free-flow — cascade so 2/3 don't land on the same spot. */
export function crashPanelFreePullGeom(
  id: CrashPanelId,
  floatIndex: number,
): CardGeom {
  const base = crashPanelFocusGeom(id);
  const step = 28;
  return clampPanelGeom({
    ...base,
    x: base.x + floatIndex * step,
    y: base.y + floatIndex * step,
  });
}

/**
 * True when this mode+viewport combo uses Stack's single-focus strip list
 * (Stack always; Grid too once the viewport is too narrow for 4 columns).
 * Shared by snapPanelGeom and useCrashDeskMode so focus read/write/collapse
 * all agree on which storage key drives the layout.
 */
export function isDrilldownMode(mode: CrashDeskMode): boolean {
  return mode === "stack" || (mode === "grid" && isNarrowViewport());
}

export function snapPanelGeom(
  id: CrashPanelId,
  mode: CrashDeskMode,
  panelShut = false,
  stackFocus: CrashPanelId | null = null,
  freeFloat: CrashPanelId[] = [],
): CardGeom {
  if (mode === "free") {
    const i = freeFloat.indexOf(id);
    if (i >= 0) {
      return readFreePanelGeom(id) ?? crashPanelFreePullGeom(id, i);
    }
    return crashPanelClosedGeom(id);
  }
  // Grid's 4-column layout can't fit a phone — reuse Stack's single-focus
  // strip list there too instead of inventing a third narrow layout.
  if (isDrilldownMode(mode)) {
    // null focus = all strips (classic STACK). Do not force Animate open.
    if (stackFocus && CRASH_DESK_LIVE_PANELS.includes(stackFocus)) {
      if (stackFocus === id) return crashPanelFocusGeom(id);
    }
    return crashPanelClosedGeom(id);
  }
  const open = crashPanelOpenGeom(id);
  if (panelShut) return { ...open, h: CRASH_STRIP_H };
  return open;
}

export function readFreeGeomMap(): FreeGeomMap {
  try {
    const raw = localStorage.getItem(CRASH_FREE_GEOM_KEY);
    if (raw) return JSON.parse(raw) as FreeGeomMap;
  } catch {
    /* ignore */
  }
  return {};
}

export function writeFreeGeomMap(map: FreeGeomMap): void {
  try {
    localStorage.setItem(CRASH_FREE_GEOM_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function readFreePanelGeom(id: CrashPanelId): CardGeom | null {
  const g = readFreeGeomMap()[id];
  if (!g || typeof g.x !== "number" || typeof g.y !== "number") return null;
  return g;
}

export function writeFreePanelGeom(id: CrashPanelId, geom: CardGeom): void {
  const map = readFreeGeomMap();
  map[id] = geom;
  writeFreeGeomMap(map);
}

export function readPanelShutMap(): PanelShutMap {
  try {
    const raw = localStorage.getItem(CRASH_PANEL_SHUT_KEY);
    if (raw) return JSON.parse(raw) as PanelShutMap;
  } catch {
    /* ignore */
  }
  return {};
}

export function isPanelShut(id: CrashPanelId): boolean {
  return readPanelShutMap()[id] === true;
}

export function writePanelShut(id: CrashPanelId, shut: boolean): void {
  try {
    const map = readPanelShutMap();
    if (shut) map[id] = true;
    else delete map[id];
    localStorage.setItem(CRASH_PANEL_SHUT_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CRASH_PANEL_SHUT_EVENT));
  }
}

export function clearAllPanelShut(): void {
  try {
    localStorage.removeItem(CRASH_PANEL_SHUT_KEY);
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CRASH_PANEL_SHUT_EVENT));
  }
}

export function readStackFocusPanel(): CrashPanelId | null {
  try {
    const raw = localStorage.getItem(CRASH_STACK_FOCUS_KEY);
    if (!raw) return null; // all strips
    if (CRASH_DESK_LIVE_PANELS.includes(raw as CrashPanelId)) {
      return raw as CrashPanelId;
    }
    // Retired / unknown → park all (don't force Animate)
  } catch {
    /* ignore */
  }
  return null;
}

export function writeStackFocusPanel(id: CrashPanelId | null): void {
  try {
    if (id && CRASH_DESK_LIVE_PANELS.includes(id)) {
      localStorage.setItem(CRASH_STACK_FOCUS_KEY, id);
    } else {
      localStorage.removeItem(CRASH_STACK_FOCUS_KEY);
    }
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CRASH_STACK_FOCUS_EVENT));
  }
}

/** Drop focus key when leaving stack (grid / free). Stack mode must use FALLBACK. */
export function clearStackFocusPanel(): void {
  try {
    localStorage.removeItem(CRASH_STACK_FOCUS_KEY);
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CRASH_STACK_FOCUS_EVENT));
  }
}

export function readFreeFloatPanels(): CrashPanelId[] {
  try {
    const raw = localStorage.getItem(CRASH_FREE_FLOAT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (id): id is CrashPanelId =>
        typeof id === "string" && CRASH_PANEL_ORDER.includes(id as CrashPanelId),
    );
  } catch {
    /* ignore */
  }
  return [];
}

export function writeFreeFloatPanels(ids: CrashPanelId[]): void {
  const ordered = CRASH_PANEL_ORDER.filter((id) => ids.includes(id));
  try {
    if (ordered.length === 0) localStorage.removeItem(CRASH_FREE_FLOAT_KEY);
    else localStorage.setItem(CRASH_FREE_FLOAT_KEY, JSON.stringify(ordered));
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CRASH_FREE_FLOAT_EVENT));
  }
}

export function clearFreeFloatPanels(): void {
  writeFreeFloatPanels([]);
}

export function isFreeFloatPanel(id: CrashPanelId): boolean {
  return readFreeFloatPanels().includes(id);
}

/** Pull out or park one panel in FREE FLOW (others stay floated). */
export function toggleFreeFloatPanel(id: CrashPanelId): CrashPanelId[] {
  const cur = readFreeFloatPanels();
  const next = cur.includes(id)
    ? cur.filter((x) => x !== id)
    : [...cur, id];
  writeFreeFloatPanels(next);
  return next;
}

export function readCrashDeskMode(): CrashDeskMode {
  try {
    const raw = localStorage.getItem(CRASH_DESK_MODE_KEY);
    if (raw === "grid") return "grid";
    if (raw === "free") return "free";
  } catch {
    /* ignore */
  }
  return "stack";
}

export function writeCrashDeskMode(mode: CrashDeskMode): void {
  // Don't wipe stack focus every time we re-assert "stack" — that races
  // focusPanel(id) and leaves Script desk open during CURSOR smoke.
  if (mode === "grid") {
    clearStackFocusPanel();
    clearFreeFloatPanels();
  } else if (mode === "stack") {
    clearFreeFloatPanels();
    // Classic STACK: park every panel as a strip. Tours open a panel after.
    clearStackFocusPanel();
  }
  try {
    localStorage.setItem(CRASH_DESK_MODE_KEY, mode);
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(CRASH_DESK_MODE_EVENT, { detail: mode }),
    );
  }
}

/**
 * /crash cold open — STACK strips every visit.
 * Call once from Crash Lab page before children read localStorage.
 */
let crashColdStackArmed = false;
export function forceCrashColdOpenStack(): void {
  if (typeof window === "undefined") return;
  if (crashColdStackArmed) return;
  crashColdStackArmed = true;
  writeCrashDeskMode("stack");
  refreshDeskTop();
}

/** Free flow — strips stay; pull 2/3/more with +. STACK parks all. */
export function enterFreeFlowMode(): void {
  clearAllPanelShut();
  const was = readCrashDeskMode();
  if (was !== "free") {
    clearStackFocusPanel();
    clearFreeFloatPanels();
  }
  writeCrashDeskMode("free");
}

/** Open the 4-column desk with every panel expanded. */
export function openCrashDeskGrid(): void {
  clearAllPanelShut();
  writeCrashDeskMode("grid");
  refreshDeskTop();
}

/** Snap every panel back — open full grid so the desk is never blank. */
export function resetCrashDeskLayout(): void {
  clearAllPanelShut();
  clearFreeFloatPanels();
  try {
    localStorage.removeItem(CRASH_FREE_GEOM_KEY);
  } catch {
    /* ignore */
  }
  writeStackFocusPanel(CRASH_STACK_FALLBACK);
  openCrashDeskGrid();
  refreshDeskTop();
}

function writeWorkingGridKeys(): void {
  try {
    localStorage.setItem(CRASH_DESK_MODE_KEY, "grid");
    localStorage.removeItem(CRASH_STACK_FOCUS_KEY);
    localStorage.removeItem(CRASH_PANEL_SHUT_KEY);
    localStorage.removeItem(CRASH_FREE_FLOAT_KEY);
    localStorage.removeItem(CRASH_FREE_GEOM_KEY);
    localStorage.setItem(CRASH_DESK_UNJAM_KEY, CRASH_DESK_LAYOUT_VER);
  } catch {
    /* ignore */
  }
}

/** True when saved panel positions would hide the desk or eat clicks. */
export function crashDeskLayoutLooksJammed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const mode = localStorage.getItem(CRASH_DESK_MODE_KEY);
    if (mode && mode !== "stack" && mode !== "grid" && mode !== "free") {
      return true;
    }
    const shutRaw = localStorage.getItem(CRASH_PANEL_SHUT_KEY);
    if (shutRaw) JSON.parse(shutRaw);
    const floatRaw = localStorage.getItem(CRASH_FREE_FLOAT_KEY);
    if (floatRaw) {
      const parsed = JSON.parse(floatRaw) as unknown;
      if (!Array.isArray(parsed)) return true;
    }
    const geomRaw = localStorage.getItem(CRASH_FREE_GEOM_KEY);
    if (!geomRaw) return false;
    const map = JSON.parse(geomRaw) as Record<string, { x?: number; y?: number }>;
    const pts = Object.values(map).filter(
      (g) => g && typeof g.x === "number" && typeof g.y === "number",
    );
    if (
      pts.some(
        (g) =>
          !Number.isFinite(g.x) ||
          !Number.isFinite(g.y) ||
          (g.x as number) < -200 ||
          (g.y as number) < -200 ||
          (g.x as number) > window.innerWidth + 80 ||
          (g.y as number) > window.innerHeight + 80,
      )
    ) {
      return true;
    }
    if (mode === "free" && pts.length >= 2) {
      const a = pts[0];
      if (
        pts.every(
          (g) =>
            Math.abs((g.x as number) - (a.x as number)) < 12 &&
            Math.abs((g.y as number) - (a.y as number)) < 12,
        )
      ) {
        return true;
      }
    }
  } catch {
    return true;
  }
  return false;
}

let unjamRan = false;
let unjamDidWrite = false;

/**
 * Reset layout keys to an open clickable grid on Crash Lab mount.
 * Does not touch show style, active episode, scene kit, or script fields.
 */
export function unjamCrashDeskLayoutOnce(): boolean {
  if (typeof window === "undefined") return false;
  if (unjamRan) return unjamDidWrite;
  unjamRan = true;
  writeWorkingGridKeys();
  unjamDidWrite = true;
  return true;
}

export function crashScriptDeskGeom(): CardGeom {
  return crashPanelOpenGeom("script");
}

export function crashImageGenGeom(): CardGeom {
  return crashPanelOpenGeom("imageGen");
}

export function crashMorphGeom(): CardGeom {
  return crashPanelOpenGeom("morph");
}
