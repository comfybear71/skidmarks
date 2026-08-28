/**
 * Scratch Generate — MiniMax H3 first / last frame video.
 * Client-safe (no env / fs). Mid-length cuts only (desk 5 / 8 / 15).
 * Floor is 4s — this is not the 2s/3s Grok shop. Invented stereo is stripped.
 * Do not hand the Saved mp3 to H3 on a lyric film.
 */

export const MINIMAX_H3_ID = "h3" as const;
export type MinimaxH3Id = typeof MINIMAX_H3_ID;

export const MINIMAX_H3_MODEL = "MiniMax-H3";
export const MINIMAX_H3_LABEL = "MiniMax H3";
export const MINIMAX_H3_SHORT_LABEL = "H3";
export const MINIMAX_H3_HINT =
  "5–15s from the still. Optional last still. Invented sound is stripped. Not the 2s chorus shop.";

/** Official H3 range — integer seconds only. */
export const MINIMAX_H3_MIN_SEC = 4;
export const MINIMAX_H3_MAX_SEC = 15;
export const MINIMAX_H3_DEFAULT_SEC = 5;
/** Desk chips — mid-length. Grok keeps 2 / 3 / 5. */
export const MINIMAX_H3_SHORT_SECS = [5, 8, 15] as const;
export type MinimaxH3ShortSec = (typeof MINIMAX_H3_SHORT_SECS)[number];

/** Official H3 v2 `resolution` — `768P` | `2K`. Not 1080P (that is Hailuo /v1). */
export const MINIMAX_H3_RESOLUTIONS = ["768P", "2K"] as const;
export type MinimaxH3Resolution = (typeof MINIMAX_H3_RESOLUTIONS)[number];
/** Cheaper H3 tier. 2K is $0.13/s. */
export const MINIMAX_H3_RESOLUTION: MinimaxH3Resolution = "768P";

/**
 * Official MiniMax `[Command]` cameras (I2V / Director docs, same [command]
 * language the H3 guide cites as `[pan]`, `[zoom]`, `[static]`).
 * H3 v2 has **no** `camera_control` JSON field and **no** `drone` field.
 * Aerial lift is `[Pedestal up]`. Combine up to 3 in one bracket.
 * https://platform.minimax.io/docs/guides/video-generation
 * https://platform.minimax.io/docs/api-reference/video-generation-i2v
 */
export const MINIMAX_H3_CAMERAS = [
  { id: "truck-left", label: "Truck left", command: "[Truck left]" },
  { id: "truck-right", label: "Truck right", command: "[Truck right]" },
  { id: "pan-left", label: "Pan left", command: "[Pan left]" },
  { id: "pan-right", label: "Pan right", command: "[Pan right]" },
  { id: "push-in", label: "Push in", command: "[Push in]" },
  { id: "pull-out", label: "Pull out", command: "[Pull out]" },
  { id: "pedestal-up", label: "Drone lift", command: "[Pedestal up]" },
  { id: "pedestal-down", label: "Pedestal down", command: "[Pedestal down]" },
  { id: "tilt-up", label: "Tilt up", command: "[Tilt up]" },
  { id: "tilt-down", label: "Tilt down", command: "[Tilt down]" },
  { id: "zoom-in", label: "Zoom in", command: "[Zoom in]" },
  { id: "zoom-out", label: "Zoom out", command: "[Zoom out]" },
  { id: "shake", label: "Shake", command: "[Shake]" },
  { id: "tracking", label: "Tracking", command: "[Tracking shot]" },
  { id: "static", label: "Static", command: "[Static shot]" },
] as const;

export type MinimaxH3CameraId = (typeof MINIMAX_H3_CAMERAS)[number]["id"];
export type MinimaxH3LastStill = { fileName: string; label: string };

const H3_CAM_INNER =
  "Truck left|Truck right|Pan left|Pan right|Push in|Pull out|Pedestal up|Pedestal down|Tilt up|Tilt down|Zoom in|Zoom out|Shake|Tracking shot|Static shot";
const H3_CAM_RE = new RegExp(
  `\\[(?:${H3_CAM_INNER})(?:,(?:${H3_CAM_INNER})){0,2}\\]`,
  "gi",
);

export function parseMinimaxH3Resolution(raw: string | undefined): MinimaxH3Resolution {
  const v = (raw || "").trim().toUpperCase();
  return v === "2K" ? "2K" : "768P";
}

export function parseMinimaxH3Camera(raw: string | undefined): string {
  const v = (raw || "").trim();
  if (!v) return "";
  const hit = MINIMAX_H3_CAMERAS.find(
    (c) =>
      c.id === v ||
      c.command === v ||
      c.command.toLowerCase() === v.toLowerCase() ||
      c.label.toLowerCase() === v.toLowerCase(),
  );
  return hit?.command || "";
}

export function stripMinimaxH3CameraFromSlot(slot: string): string {
  return (slot || "").replace(H3_CAM_RE, "").replace(/\s+/g, " ").trim();
}

export function applyMinimaxH3CameraToSlot(slot: string, command: string): string {
  const rest = stripMinimaxH3CameraFromSlot(slot);
  const cmd = parseMinimaxH3Camera(command);
  if (!cmd) return rest;
  return rest ? `${cmd} ${rest}` : cmd;
}

/** Put the official `[Command]` on the H3 text prompt — v2 has no camera JSON field. */
export function withMinimaxH3CameraCommand(prompt: string, camera: string | undefined): string {
  const cmd = parseMinimaxH3Camera(camera);
  const body = stripMinimaxH3CameraFromSlot(prompt || "");
  if (!cmd) return (prompt || "").trim();
  return body ? `${cmd} ${body}` : cmd;
}

/** Other takes + other plates. Skip the first frame and failed stills. */
export function collectMinimaxH3LastStills(opts: {
  firstFile?: string;
  takes?: { fileName?: string }[];
  otherPlates?: { fileName?: string; title?: string }[];
}): MinimaxH3LastStill[] {
  const first = (opts.firstFile || "").trim();
  const seen = new Set<string>(first ? [first] : []);
  const out: MinimaxH3LastStill[] = [];
  const add = (fileName: string, label: string) => {
    const name = fileName.trim();
    if (!name || name === "__error__" || seen.has(name)) return;
    seen.add(name);
    out.push({ fileName: name, label: label.trim() || name });
  };
  for (const take of opts.takes || []) add(take.fileName || "", "Other take");
  for (const plate of opts.otherPlates || []) {
    add(plate.fileName || "", (plate.title || "").trim() || "Other plate");
  }
  return out;
}

export function isMinimaxH3Id(value: string | undefined): value is MinimaxH3Id {
  return (value || "").trim().toLowerCase() === MINIMAX_H3_ID;
}

export function isMinimaxH3ClipEngineToken(raw: string | undefined): boolean {
  const value = (raw || "").trim().toLowerCase();
  return (
    value === MINIMAX_H3_ID ||
    value === "minimax" ||
    value === "minimax-h3" ||
    value === "hailuo-h3" ||
    value === "h3-i2v"
  );
}

export function isMinimaxH3ShortSec(sec: number): sec is MinimaxH3ShortSec {
  return (MINIMAX_H3_SHORT_SECS as readonly number[]).includes(sec);
}

export function snapMinimaxH3DurationSec(sec: number): number {
  if (!Number.isFinite(sec) || sec <= 0) return MINIMAX_H3_DEFAULT_SEC;
  return Math.max(MINIMAX_H3_MIN_SEC, Math.min(MINIMAX_H3_MAX_SEC, Math.round(sec)));
}

/** Hung bar → H3 seconds. 7 and 9 stay 7 and 9. Never swap a real hang for the 5s default. */
export function clampMinimaxH3HangSec(sec: number): { durationSec: number; note: string } {
  const durationSec = snapMinimaxH3DurationSec(sec);
  if (!Number.isFinite(sec) || sec <= 0) {
    return { durationSec, note: `H3 needs a hung length — cooking ${durationSec}` };
  }
  if (sec > MINIMAX_H3_MAX_SEC) {
    return { durationSec, note: `H3 max ${MINIMAX_H3_MAX_SEC} — cooking ${durationSec}` };
  }
  if (sec < MINIMAX_H3_MIN_SEC) {
    return { durationSec, note: `H3 min ${MINIMAX_H3_MIN_SEC} — cooking ${durationSec}` };
  }
  return { durationSec, note: "" };
}

/** Do not send 25 to MiniMax. Say so — do not snap and pretend it cooked 25. */
export const MINIMAX_H3_OVER_MAX_NOTE = "H3 max 15 — use LTX for 25";

export function refuseMinimaxH3OverMax(sec: number): string | null {
  if (Number.isFinite(sec) && sec > MINIMAX_H3_MAX_SEC) return MINIMAX_H3_OVER_MAX_NOTE;
  return null;
}
