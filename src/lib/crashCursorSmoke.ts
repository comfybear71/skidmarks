import type { ShowStyleId } from "./showStylePresets";

/** CURSOR smoke: cast gate → Image Gen → Character panel → stop. */
export const CRASH_CURSOR_CAST_GATE_EVENT = "crash-cursor-cast-gate";
export const CRASH_CURSOR_CAST_GATE_DONE_EVENT = "crash-cursor-cast-gate-done";
export const CRASH_CURSOR_IMAGE_GATE_EVENT = "crash-cursor-image-gate";
export const CRASH_CURSOR_IMAGE_GATE_DONE_EVENT = "crash-cursor-image-gate-done";
export const CRASH_CURSOR_SMOKE_STOP_EVENT = "crash-cursor-smoke-stop";

export const CURSOR_SMOKE_SESSION_KEY = "crashlab-cursor-smoke";

export type CursorCastGateDetail = {
  styleId: ShowStyleId;
  gagLabel: string;
  mainName: string;
  castNames: string[];
};

export type CursorCastGateDoneDetail = {
  ok: boolean;
  styleId: ShowStyleId;
  mainName: string;
  castNames: string[];
  /** Optional alter notes (name tweaks). */
  notes?: string;
};

export type CursorImageGateDetail = {
  styleId: ShowStyleId;
  mainName: string;
  castNames: string[];
};

export type CursorSmokeSession = {
  styleId: ShowStyleId;
  gagLabel: string;
  mainName: string;
  castNames: string[];
  notes: string;
  imageApproved: boolean;
  imageThumbKey?: string;
  imageLabel?: string;
};

export function readCursorSmokeSession(): CursorSmokeSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CURSOR_SMOKE_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CursorSmokeSession;
  } catch {
    return null;
  }
}

export function writeCursorSmokeSession(session: CursorSmokeSession): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CURSOR_SMOKE_SESSION_KEY, JSON.stringify(session));
  } catch {
    /* ignore */
  }
}

export function clearCursorSmokeSession(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(CURSOR_SMOKE_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

/** Image Gen → Character (Deep Fried path). Always opens Character panel. */
export const CRASH_CHARACTER_OPEN_EVENT = "crash-character-open";

export function openCharacterSession(session: CursorSmokeSession): void {
  armCursorImageGate(false);
  writeCursorSmokeSession(session);
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(CRASH_CHARACTER_OPEN_EVENT, { detail: session }),
  );
  window.dispatchEvent(new CustomEvent("crash-style-thumb-saved"));
}

/**
 * Look line wins the name.
 * "Deep Fried Terry is a low life…" → main = Deep Fried Terry (not leftover Jum).
 */
export function resolveMainFromLookLine(
  mainName: string,
  notes?: string,
  castNames: string[] = [],
): { mainName: string; notes: string; castNames: string[] } {
  const note = (notes || "").trim();
  let main = mainName.trim();
  const names = castNames.map((n) => n.trim()).filter(Boolean);

  const fromIs = note.match(
    /^([A-Za-z][A-Za-z0-9 .'\-]{1,48}?)\s+is\b/i,
  );
  if (fromIs) {
    const who = fromIs[1].trim().replace(/\s+/g, " ");
    if (who) main = who;
  } else {
    // Note names a cast member that isn't the locked main → prefer them.
    const hit = names.find(
      (n) =>
        n.length > 2 &&
        note.toLowerCase().includes(n.toLowerCase()) &&
        n.toLowerCase() !== main.toLowerCase(),
    );
    if (hit) main = hit;
  }

  if (!main) main = names[0] || "Arsehole";

  const cast = names.includes(main)
    ? names
    : [main, ...names.filter((n) => n.toLowerCase() !== main.toLowerCase())];

  return { mainName: main, notes: note, castNames: cast };
}

export function dispatchCursorCastGate(detail: CursorCastGateDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(CRASH_CURSOR_CAST_GATE_EVENT, { detail }),
  );
}

export function dispatchCursorCastGateDone(detail: CursorCastGateDoneDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(CRASH_CURSOR_CAST_GATE_DONE_EVENT, { detail }),
  );
}

export function waitCursorCastGateDone(): Promise<CursorCastGateDoneDetail> {
  return new Promise((resolve) => {
    const onDone = (ev: Event) => {
      window.removeEventListener(CRASH_CURSOR_CAST_GATE_DONE_EVENT, onDone);
      resolve((ev as CustomEvent<CursorCastGateDoneDetail>).detail);
    };
    window.addEventListener(CRASH_CURSOR_CAST_GATE_DONE_EVENT, onDone);
  });
}

export function dispatchCursorImageGate(detail: CursorImageGateDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(CRASH_CURSOR_IMAGE_GATE_EVENT, { detail }),
  );
}

export function dispatchCursorImageGateDone(detail: {
  ok: boolean;
  thumbKey?: string;
  label?: string;
}): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(CRASH_CURSOR_IMAGE_GATE_DONE_EVENT, { detail }),
  );
}

export function waitCursorImageGateDone(): Promise<{
  ok: boolean;
  thumbKey?: string;
  label?: string;
}> {
  return new Promise((resolve) => {
    const onDone = (ev: Event) => {
      window.removeEventListener(CRASH_CURSOR_IMAGE_GATE_DONE_EVENT, onDone);
      resolve(
        (ev as CustomEvent<{ ok: boolean; thumbKey?: string; label?: string }>)
          .detail,
      );
    };
    window.addEventListener(CRASH_CURSOR_IMAGE_GATE_DONE_EVENT, onDone);
  });
}

export function dispatchCursorSmokeStop(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CRASH_CURSOR_SMOKE_STOP_EVENT));
}

/** True while Image Gen should show Approve instead of Add to cast. */
let imageGateArmed = false;

export function armCursorImageGate(armed: boolean): void {
  imageGateArmed = armed;
}

export function isCursorImageGateArmed(): boolean {
  return imageGateArmed;
}
