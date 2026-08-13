import type { DragEvent } from "react";
import type { ShowStyleId } from "./showStylePresets";

/** Custom MIME — Chromium often drops this; always dual-write text/plain. */
export const CRASH_PLATE_DRAG = "application/x-crash-plate";
const PLAIN_PREFIX = "crash-plate:";

export type CrashPlateDragPayload =
  | {
      kind: "world";
      styleId: ShowStyleId | string;
      thumbKey: string;
      name?: string;
    }
  | {
      kind: "cplate";
      styleId: ShowStyleId | string;
      fileName: string;
      label?: string;
    }
  | {
      kind: "cast";
      styleId: ShowStyleId | string;
      thumbKey: string;
      label?: string;
    }
  | {
      kind: "swap";
      styleId: ShowStyleId | string;
      fileName: string;
      label?: string;
    };

function parsePayload(raw: string): CrashPlateDragPayload | null {
  try {
    const text = raw.startsWith(PLAIN_PREFIX) ? raw.slice(PLAIN_PREFIX.length) : raw;
    const p = JSON.parse(text) as CrashPlateDragPayload;
    if (p.kind === "world" && p.thumbKey) return p;
    if (p.kind === "cplate" && p.fileName) return p;
    if (p.kind === "cast" && p.thumbKey) return p;
    if (p.kind === "swap" && p.fileName) return p;
  } catch {
    /* ignore */
  }
  return null;
}

/** Native img drag leaves only the URL — recover plate identity from it. */
export function payloadFromImageUrl(url: string): CrashPlateDragPayload | null {
  try {
    const u = new URL(url, "http://local.invalid");
    const path = u.pathname;

    if (path.includes("/api/crash/gen/file")) {
      const fileName = u.searchParams.get("name") || "";
      if (fileName) {
        return { kind: "cplate", styleId: "", fileName };
      }
    }

    if (path.includes("/api/crash/swap/file")) {
      const fileName = u.searchParams.get("file") || "";
      const styleId = u.searchParams.get("styleId") || "";
      if (fileName && styleId) {
        return { kind: "swap", styleId, fileName };
      }
    }

    if (path.includes("/api/crash/style-cards/file")) {
      const thumbKey = u.searchParams.get("thumb") || "";
      const styleId = u.searchParams.get("styleId") || "";
      if (thumbKey && styleId) {
        return { kind: "cast", styleId, thumbKey };
      }
    }

    if (path.includes("/api/crash/world-cards/file")) {
      const thumbKey = u.searchParams.get("thumb") || "";
      const styleId = u.searchParams.get("styleId") || "";
      if (thumbKey && styleId) {
        return { kind: "world", styleId, thumbKey };
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** Backup when Chromium empties dataTransfer mid-drag between panels. */
let livePlateDrag: CrashPlateDragPayload | null = null;

export function peekLivePlateDrag(): CrashPlateDragPayload | null {
  return livePlateDrag;
}

export function clearLivePlateDrag(): void {
  livePlateDrag = null;
}

export function writePlateDrag(
  e: DragEvent,
  payload: CrashPlateDragPayload,
): void {
  livePlateDrag = payload;
  const json = JSON.stringify(payload);
  try {
    e.dataTransfer.setData(CRASH_PLATE_DRAG, json);
  } catch {
    /* some hosts reject custom MIME */
  }
  e.dataTransfer.setData("text/plain", `${PLAIN_PREFIX}${json}`);
  e.dataTransfer.effectAllowed = "copy";
}

export function readPlateDrag(e: DragEvent): CrashPlateDragPayload | null {
  try {
    const custom = e.dataTransfer.getData(CRASH_PLATE_DRAG);
    const fromCustom = custom ? parsePayload(custom) : null;
    if (fromCustom) {
      livePlateDrag = fromCustom;
      return fromCustom;
    }

    const plain = e.dataTransfer.getData("text/plain");
    if (plain) {
      const fromPlain = parsePayload(plain);
      if (fromPlain) {
        livePlateDrag = fromPlain;
        return fromPlain;
      }
      const fromUrl = payloadFromImageUrl(plain.trim());
      if (fromUrl) {
        livePlateDrag = fromUrl;
        return fromUrl;
      }
    }

    const uri =
      e.dataTransfer.getData("text/uri-list") ||
      e.dataTransfer.getData("text/plain");
    if (uri) {
      const first = uri.split(/\r?\n/).find((l) => l && !l.startsWith("#"));
      if (first) {
        const fromUri = payloadFromImageUrl(first.trim());
        if (fromUri) {
          livePlateDrag = fromUri;
          return fromUri;
        }
      }
    }
  } catch {
    /* ignore */
  }
  return livePlateDrag;
}

/** True when the drag may carry a plate we care about (for dragover styling). */
export function plateDragHasType(e: DragEvent): boolean {
  if (livePlateDrag) return true;
  const types = Array.from(e.dataTransfer.types || []);
  if (types.includes(CRASH_PLATE_DRAG)) return true;
  if (types.includes("text/plain")) return true;
  if (types.includes("text/uri-list")) return true;
  return false;
}

/** Scene kit Copy → Story Paste — same finished plate, different audio. */
const PLATE_CLIP_KEY = "crash-plate-clipboard";
export const CRASH_PLATE_CLIP_EVENT = "crash-plate-clipboard";

export type CrashPlateClipboard = {
  fileName: string;
  label?: string;
  slot?: number;
};

export function copyFinishedPlate(clip: CrashPlateClipboard): void {
  const fileName = String(clip.fileName || "").trim();
  if (!fileName) return;
  const payload: CrashPlateClipboard = {
    fileName,
    label: clip.label?.trim() || undefined,
    slot: clip.slot,
  };
  try {
    localStorage.setItem(PLATE_CLIP_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(CRASH_PLATE_CLIP_EVENT, { detail: payload }),
    );
  }
}

export function readFinishedPlateClipboard(): CrashPlateClipboard | null {
  try {
    const raw = localStorage.getItem(PLATE_CLIP_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as CrashPlateClipboard;
    if (!p?.fileName?.trim()) return null;
    return {
      fileName: p.fileName.trim(),
      label: p.label?.trim() || undefined,
      slot: typeof p.slot === "number" ? p.slot : undefined,
    };
  } catch {
    return null;
  }
}

export function clearFinishedPlateClipboard(): void {
  try {
    localStorage.removeItem(PLATE_CLIP_KEY);
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CRASH_PLATE_CLIP_EVENT));
  }
}
