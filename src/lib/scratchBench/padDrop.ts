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

/** Land-lady bedroom / named bedroom — left is the bed, right is the sofa. */
export function isScratchBedroomPlace(place: string): boolean {
  return /bedroom|land lady/i.test(place || "");
}

export function pickJoAndMattyNames(names: string[]): { jo: string; matty: string } | null {
  const list = names.map((n) => n.trim()).filter(Boolean);
  const jo = list.find((n) => /\bjo\b/i.test(n));
  const matty = list.find((n) => /matt/i.test(n));
  if (!jo || !matty) return null;
  return { jo, matty };
}

/** Paste letter: JO TOO on the bed, MATTY on the sofa. Adults only. */
export function scratchJoMattyBedroomPrompt(
  placeName: string,
  joName = "JO TOO",
  mattyName = "MATTY",
): string {
  const room = (placeName || "").trim() || "COMFY AND THE LAND LADY'S BEDROOM";
  const jo = (joName || "JO TOO").trim() || "JO TOO";
  const matty = (mattyName || "MATTY").trim() || "MATTY";
  return [
    `ONE photograph, ONE camera, ONE room: ${room}. Not a collage, not a comic page, not three panels, not inset portraits.`,
    `Adult ${jo} is fully nude on the bed, left of frame — on her back on the quilt, shoulders and head on the mattress, looking toward ${matty}. Same face as her face card. Ignore face-card clothes. Full body lying on the mattress — not sitting up, not leaning forward, not a floating bust, not framed in a window.`,
    `Adult man ${matty} is fully nude on the sofa / armchair, right of frame, lower — sitting back, head tipped up, eyes closed. Same face, tattoos and build as his face card. Visible human penis, two human feet on the floor. Not a Ken doll. No extra limbs. Full body in the seat — not a floating bust, not framed in a window.`,
    `Only ${jo} and ${matty} in frame. Full people using the furniture. No picture-in-picture. No text. Adults only, no one under 21.`,
  ].join("\n\n");
}

export function bedroomFurnitureLine(name: string, where: string, place: string): string {
  if (!isScratchBedroomPlace(place)) return "";
  const who = (name || "").trim() || "Subject";
  if (/left/i.test(where)) {
    return `${who} is on her back on the bed, left of that room — full body lying on the mattress, not sitting up, not a floating bust in a window.`;
  }
  if (/right/i.test(where)) {
    return `${who} is on the sofa or armchair, right of that room — full body sitting in the seat, not a floating bust in a window.`;
  }
  return "";
}

/**
 * Seedream ignores "drop 71% / 76%". Turn [Backdrop]/[Position] into
 * one-room English so JO TOO and MATTY land in the same still.
 */
export function expandScratchLayoutMarks(staging: string): string {
  const text = (staging || "").trim();
  if (!text) return "";
  if (/ONE photograph of /i.test(text) && /share the same room/i.test(text)) return text;
  if (/ONE photograph, ONE camera, ONE room:/i.test(text) && /on the bed/i.test(text) && /on the sofa/i.test(text)) {
    return text;
  }
  const backdrop = text.match(/\[Backdrop:\s*([^\]—]+)/i);
  const positions = [...text.matchAll(/\[Position:\s*([^\]]+)\]/gi)];
  if (!backdrop && !positions.length) return text;
  const place = (backdrop?.[1] || "").replace(/\s+$/, "").trim();
  const bits: string[] = [];
  if (place) bits.push(`ONE photograph of ${place}.`);
  const names: string[] = [];
  for (const m of positions) {
    const inner = (m[1] || "").trim();
    const nameMatch = inner.match(/^(.+?)\s+framed\s+/i);
    const name = (nameMatch?.[1] || "").trim();
    if (!name) continue;
    names.push(name);
    const where = inner
      .replace(/^(.+?)\s+framed\s+/i, "")
      .replace(/\(drop[^)]*\)\.?/gi, "")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\.+$/, "");
    bits.push(
      bedroomFurnitureLine(name, where, place) ||
        `${name} is ${where} of that room — a full person using the furniture there, not a portrait tile.`,
    );
  }
  if (names.length > 1) {
    bits.push(
      `${names.join(" and ")} share the same room and the same camera. Not a collage, not a comic page, not separate portraits.`,
    );
  }
  if (!bits.length) return text;
  return `${text}\n\n${bits.join(" ")}`.trim();
}

/** Wearing / Nude replaces the body — keep each drop mark so JO stays parked. */
export function keepScratchPositionLines(previous: string, nextBody: string): string {
  const body = (nextBody || "").trim();
  const lines = (previous || "").match(/\[Position:[^\]]*\]/gi) || [];
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(line);
  }
  if (!unique.length) return body;
  if (unique.every((line) => body.includes(line))) return body;
  return `${unique.join("\n")}\n\n${body}`.trim();
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
