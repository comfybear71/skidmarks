/**
 * Scratch prompt formatter — canvas placements + knobs → structured blocks.
 * Plate → Draw / LTX path only. No Comfy / clothing euphemism banks.
 */

import type { ScratchPadPlacement } from "./padDrop";

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
