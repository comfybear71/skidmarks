/** Scratch pad HTML5 drag/drop — faces & places → layout %, prompt text. */

export const SCRATCH_DND_MIME = "application/x-skidmarks-scratch";

export type ScratchDragAssetType = "actor" | "place";

export type ScratchDragPayload = {
  type: ScratchDragAssetType;
  /** Actor display name, or scene id for place. */
  id: string;
  label?: string;
};

export type ScratchPadPlacement = {
  name: string;
  /** 0–100 relative to pad. */
  xPercent: number;
  yPercent: number;
};

export function packScratchDrag(payload: ScratchDragPayload): string {
  return JSON.stringify(payload);
}

export function unpackScratchDrag(raw: string): ScratchDragPayload | null {
  try {
    const parsed = JSON.parse(raw) as ScratchDragPayload;
    if (!parsed || (parsed.type !== "actor" && parsed.type !== "place")) return null;
    if (!parsed.id || typeof parsed.id !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function readScratchDrag(dt: DataTransfer): ScratchDragPayload | null {
  const typed = dt.getData(SCRATCH_DND_MIME);
  if (typed) return unpackScratchDrag(typed);
  // Fallback: plain name from older handlers
  const plain = dt.getData("text/plain").trim();
  if (!plain) return null;
  return { type: "actor", id: plain, label: plain };
}

export function setScratchDrag(dt: DataTransfer, payload: ScratchDragPayload): void {
  const packed = packScratchDrag(payload);
  dt.setData(SCRATCH_DND_MIME, packed);
  dt.setData("text/plain", payload.label || payload.id);
  dt.effectAllowed = "copyMove";
}

export function dropPercents(
  clientX: number,
  clientY: number,
  rect: DOMRect,
): { xPercent: number; yPercent: number } {
  const x = ((clientX - rect.left) / Math.max(rect.width, 1)) * 100;
  const y = ((clientY - rect.top) / Math.max(rect.height, 1)) * 100;
  return {
    xPercent: Math.max(0, Math.min(100, Math.round(x))),
    yPercent: Math.max(0, Math.min(100, Math.round(y))),
  };
}

/** Horizontal third + vertical band → cinematic position line. */
export function positionPromptLine(name: string, xPercent: number, yPercent: number): string {
  const who = name.trim() || "Subject";
  const horiz =
    xPercent < 35 ? "on the left third of the screen" : xPercent > 65 ? "on the right third of the screen" : "in the centre of the frame";
  const vert =
    yPercent < 35 ? "upper band" : yPercent > 65 ? "lower band" : "mid height";
  return `[Position: ${who} framed ${horiz}, ${vert} (drop ${xPercent}% / ${yPercent}%).]`;
}

/** Upsert one [Position: Name …] block; keep other prompt text. */
export function mergePositionIntoStaging(staging: string, line: string, name: string): string {
  const base = staging.trim();
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const named = new RegExp(`\\[Position:\\s*${escaped}\\b[^\\]]*\\]`, "i");
  if (named.test(base)) {
    return base.replace(named, line).replace(/\n{3,}/g, "\n\n").trim();
  }
  if (!base) return line;
  return `${base}\n\n${line}`.trim();
}

export function upsertPlacement(
  list: ScratchPadPlacement[],
  next: ScratchPadPlacement,
): ScratchPadPlacement[] {
  const i = list.findIndex((p) => p.name === next.name);
  if (i < 0) return [...list, next];
  const copy = list.slice();
  copy[i] = next;
  return copy;
}
