/**
 * Scratch prompt formatter — canvas placements + knobs → structured blocks.
 * Plate → Draw / LTX path only. No Comfy / clothing euphemism banks.
 */

import { expandScratchLayoutMarks, positionPromptLine, type ScratchPadPlacement } from "./padDrop";

export type ScratchPromptFormatConfig = {
  placements: ScratchPadPlacement[];
  environment: string;
  /** Optional camera block (already tokenized or plain). */
  camera?: string;
  /** Extra action / genre / staging body (bible append, free text). */
  actionBody?: string;
  dialogue?: string;
  style?: string;
};

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const DEFAULT_CAMERA = "Static cinematic medium framing, keeping pace naturally.";
const DEFAULT_STYLE =
  "Consistent character attributes with the face cards. Cinematic composition, sharp focus, believable materials, soft environment lighting.";

function framingPhrase(xPercent: number, yPercent: number): string {
  const horiz =
    xPercent < 35
      ? "positioned strictly on the left third of the screen, looking across the open right side"
      : xPercent > 65
        ? "positioned strictly on the right third of the screen, looking across the open left side"
        : "centered in the frame";
  const vert =
    yPercent < 35 ? "upper band" : yPercent > 65 ? "lower band" : "mid height";
  return `${horiz}, ${vert}`;
}

/** Spatial layout rules from pad drop coordinates. */
export function formatPositioningBlock(
  placements: ScratchPadPlacement[],
  environment: string,
): string {
  const place = (environment || "this place").trim() || "this place";
  if (!placements.length) {
    return `A cinematic establishing framing showcasing ${place}.`;
  }
  if (placements.length === 1) {
    const a = placements[0]!;
    return `${a.name} is ${framingPhrase(a.xPercent, a.yPercent)} at ${place} (drop ${a.xPercent}% / ${a.yPercent}%).`;
  }
  const sorted = [...placements].sort((a, b) => a.xPercent - b.xPercent);
  const parts = sorted.map(
    (a) => `${a.name} (${framingPhrase(a.xPercent, a.yPercent)}; ${a.xPercent}% / ${a.yPercent}%)`,
  );
  return `Left-to-right layout at ${place}: ${parts.join("; ")}.`;
}

/** Draw must send every drop mark — tap-add + Nude otherwise parks extras as an inset. */
export function mergePlacementsIntoStaging(
  staging: string,
  placements: ScratchPadPlacement[],
  environment: string,
): string {
  let next = (staging || "").trim();
  if (/ONE photograph, ONE camera, ONE room:/i.test(next)) return next;
  if (!placements.length) return expandScratchLayoutMarks(next);
  const hasAllMarks = placements.every((p) =>
    new RegExp(`\\[Position:\\s*${escapeRegExp(p.name)}\\b`, "i").test(next),
  );
  if (!hasAllMarks) {
    const marks = placements.map((p) => positionPromptLine(p.name, p.xPercent, p.yPercent));
    next = next ? `${marks.join("\n")}\n\n${next}` : marks.join("\n");
  }
  if (
    placements.length > 1 &&
    !/picture-in-picture|photo inset|floating head/i.test(next)
  ) {
    const names = placements.map((p) => p.name).join(" and ");
    next = `${next}\n\n${names} are full people standing or sitting in those marks in ONE room, ONE photograph — not a picture-in-picture, not a photo on the wall, not a floating head, not a three-panel collage, not a comic page. Only ${names} in frame.`.trim();
  }
  return expandScratchLayoutMarks(next.trim());
}

/**
 * Build segmented prompt blocks for still / motion testing.
 * Dialogue stays isolated so clothing/action sentences never swallow the line.
 */
export function generateScratchPrompt(config: ScratchPromptFormatConfig): string {
  const camera = (config.camera || "").trim() || DEFAULT_CAMERA;
  const positioning = formatPositioningBlock(config.placements, config.environment);
  const actionExtra = (config.actionBody || "").trim();
  const action = [
    "Using the provided start image as the first frame baseline layout.",
    positioning,
    actionExtra,
  ]
    .filter(Boolean)
    .join(" ");

  const blocks = [
    `[Camera]\n${camera}`,
    `[Action & Positioning]\n${action}`,
  ];

  const dialogue = (config.dialogue || "").trim();
  if (dialogue) {
    blocks.push(`[Dialogue]\n"${dialogue}"`);
  }

  blocks.push(`[Style]\n${(config.style || "").trim() || DEFAULT_STYLE}`);

  return blocks.join("\n\n");
}

/** Pull a free-text body out of staging while dropping old Position/Backdrop/block headers we re-emit. */
export function stagingActionBody(staging: string): string {
  return staging
    .replace(/\[Position:\s*[^\]]*\]/gi, "")
    .replace(/\[Backdrop:\s*[^\]]*\]/gi, "")
    .replace(/\[Camera\][^\[]*/gi, "")
    .replace(/\[Camera Control\][^\[]*/gi, "")
    .replace(/\[Action & Positioning\][^\[]*/gi, "")
    .replace(/\[Dialogue\][^\[]*/gi, "")
    .replace(/\[Style\][^\[]*/gi, "")
    .replace(/\[Style & Consistency\][^\[]*/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Prefer an existing [Camera] block from staging if present. */
export function stagingCameraBlock(staging: string): string | undefined {
  const m = staging.match(/\[Camera(?:\s*Control)?\]\s*([\s\S]*?)(?=\n\s*\[|$)/i);
  const body = m?.[1]?.trim();
  return body || undefined;
}
