import { getShowStylePreset, type ShowStyleId } from "./showStylePresets";

/**
 * IMAGE MOTION prompts in the shape recorded in
 * docs/SUNNY_BANKS_IMAGE_MOTION_STANDARD.md — the First Fleet Cloud wording
 * logged as working 100%.
 *
 * The mobile pipeline had been sending LTX only `NAME says: "line"`, with
 * nothing holding the plate: no first-frame lock, no look lock, no "nothing
 * new enters frame". That is why strangers walked into shots and the actual
 * character was on screen for a moment.
 *
 * The sentence structure is the gold verbatim. The style lock is per show, so
 * Skidmarks and Photoreal do not get Sunny Banks' cel wording.
 */

/** Sunny Banks' proven lock, kept exactly as logged — spelling included. */
const SUNNY_BANKS_STYLE_LOCK =
  "rubbery adult cartoon, thick black outlines, flat cel colour, big heads, noodly arms, sun-bleached Aussie palette, dusty ochre, faded teal, heat haze. Not photographic, not soft Pixar, not photorealistic";

export function motionStyleLock(styleId: ShowStyleId): string {
  if (styleId === "sunny_banks") return SUNNY_BANKS_STYLE_LOCK;
  const preset = getShowStylePreset(styleId);
  // A photoreal show must not inherit "not photorealistic" from the cel lock.
  const negative =
    preset.defaultRealism >= 70
      ? "Not cartoon, not stylised."
      : "Not photographic, not photorealistic.";
  return `${preset.lookPrompt}. ${negative}`;
}

function clean(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Speaking beat — the mandatory shape from the standard. */
export function buildSpeakingMotion(opts: {
  styleId: ShowStyleId;
  speaker: string;
  line: string;
  /** The character's look, so the plate's subject is named and held. */
  lookLock?: string;
}): string {
  const name = clean(opts.speaker) || "The character";
  const look = clean(opts.lookLock || "");
  const who = look ? `${name}, ${look}` : name;
  return clean(
    [
      "Use the provided start image as the first frame.",
      `${who} is prominent, mouth and head move naturally while speaking, subtle gesture.`,
      "Props and background stay exactly as the start image, nothing new enters frame.",
      `${name} says: "${clean(opts.line)}".`,
      "Camera holds. Same person and objects as the start image.",
      "No new people enter the frame.",
      motionStyleLock(opts.styleId),
    ].join(" "),
  );
}

/** Beat with no dialogue. */
export function buildHoldMotion(opts: {
  styleId: ShowStyleId;
  speaker: string;
  lookLock?: string;
}): string {
  const name = clean(opts.speaker) || "The character";
  const look = clean(opts.lookLock || "");
  const who = look ? `${name}, ${look}` : name;
  return clean(
    [
      "Use the provided start image as the first frame.",
      `${who} holds their pose, subtle idle motion, weight shift, breathing.`,
      "Props and background stay exactly as the start image, nothing new enters frame.",
      "No dialogue. Camera holds, no cuts. Same person and objects as the start image.",
      "No new people enter the frame.",
      motionStyleLock(opts.styleId),
    ].join(" "),
  );
}

/** Per-beat segment line from the standard. */
export function buildSegmentText(speaker: string, speaking: boolean): string {
  const name = clean(speaker) || "The character";
  return speaking
    ? `${name} delivers the line, subtle lean and gesture`
    : `${name}, soft idle motion, props locked`;
}

/** Global applied to every beat — lip sync plus the show's lock. */
export function buildGlobalPrompt(styleId: ShowStyleId): string {
  return clean(
    [
      "perfect lip sync, clear lip movement, citing the dialogue clearly,",
      "facial expressions and hand gestures are lively.",
      motionStyleLock(styleId),
    ].join(" "),
  );
}
