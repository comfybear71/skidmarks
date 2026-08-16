import { speakerVoiceKey } from "./crashVoicePrompt";
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

/**
 * Locked lead on every LTX send. Gold spelling. Not a separate prompt —
 * prepended onto Image motion so Cloud IA2V actually receives it.
 */
export const LTX_LIP_SYNC_LEAD =
  "perfect lip sync, clear lip movement, citing the dialogue clearly, facial expressions and hand gestures are lively, dication is perfect.";

export function withLtxLipSyncLead(prompt: string): string {
  const body = clean(prompt);
  if (!body) return LTX_LIP_SYNC_LEAD;
  if (body.toLowerCase().startsWith("perfect lip sync")) return body;
  return clean(`${LTX_LIP_SYNC_LEAD} ${body}`);
}

export function stripLtxLipSyncLead(prompt: string): string {
  const body = prompt.trim();
  if (!body) return "";
  if (body.toLowerCase().startsWith(LTX_LIP_SYNC_LEAD.toLowerCase())) {
    return clean(body.slice(LTX_LIP_SYNC_LEAD.length).replace(/^[,.\s]+/, ""));
  }
  if (/^perfect lip sync/i.test(body)) {
    return clean(body.replace(/^perfect lip sync[^.]*\.\s*/i, ""));
  }
  return clean(body);
}

/** The one string Cloud LTX gets: lead + Image motion body. */
export function ltxSendPrompt(imageMotion: string): string {
  return withLtxLipSyncLead(imageMotion);
}

/**
 * CRAZY BIG HOLE JO (and Jo Too) — majority of her clips: phone in her
 * hands, staring like a maniac, saying the line as she texts. Same held-prop
 * shape that already works for pies and tennis rackets. Editable in the LTX
 * box when a shot is the exception.
 */
export function isJoKeyboardWarrior(speaker: string): boolean {
  const n = speaker.trim().toLowerCase().replace(/\s+/g, " ");
  return n.includes("crazy big hole jo") || speakerVoiceKey(speaker) === "jo";
}

function speakingAction(speaker: string): string {
  if (isJoKeyboardWarrior(speaker)) {
    return "holding her phone, staring at the screen like a crazed maniac, thumbs hammering the keys as she texts, mouth and head move naturally while she speaks the line as she types, keyboard warrior";
  }
  return "mouth and head move naturally while speaking, subtle gesture";
}

function holdAction(speaker: string): string {
  if (isJoKeyboardWarrior(speaker)) {
    return "is prominent, holding her phone, staring at the screen like a crazed maniac, thumbs tapping the keys, holds her pose, subtle idle motion, weight shift, breathing, heat haze, flies";
  }
  return "holds their pose, subtle idle motion, weight shift, breathing, heat haze, flies";
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
      `${who} is prominent, ${speakingAction(opts.speaker)}.`,
      "Props and background stay exactly as the start image, nothing new enters frame.",
      `${name} says: "${clean(opts.line)}".`,
      "Camera holds. Same person and objects as the start image.",
      "No new people enter the frame.",
      motionStyleLock(opts.styleId),
    ].join(" "),
  );
}

/** Beat with no dialogue, one character in shot. */
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
      `${who} ${holdAction(opts.speaker)}.`,
      "Props and background stay exactly as the start image, nothing new enters frame.",
      "No dialogue. Camera holds, no cuts. Same person and objects as the start image.",
      "No new people enter the frame.",
      motionStyleLock(opts.styleId),
    ].join(" "),
  );
}

/**
 * Hold beat where the shot's cast is more than one person and none of them
 * speaks in it. The single-person hold names one character as the subject,
 * which reads as permission for anyone else in the plate to drift or change
 * — the group form pins the whole cast and silences every mouth at once, per
 * the standard's documented "Group hold" shape.
 */
export function buildGroupHoldMotion(opts: {
  styleId: ShowStyleId;
  names: string[];
}): string {
  const names = opts.names.map(clean).filter(Boolean);
  const roll =
    names.length <= 1
      ? names[0] || "The characters"
      : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return clean(
    [
      "Use the provided start image as the first frame.",
      `Only ${roll} in frame, no one else appears.`,
      "Everyone holds their pose, subtle idle motion, weight shift, breathing, heat haze, flies.",
      "All mouths stay closed.",
      "Props and background stay exactly as the start image, nothing new enters frame.",
      "No dialogue. Camera holds, no cuts. Same people and objects as the start image.",
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

/** Default Image motion body (no lip-sync lead — that is prepended on send). */
export function buildDefaultBeatMotion(opts: {
  styleId: ShowStyleId;
  speaker: string;
  line: string;
  lookLock?: string;
  shotSpeakers?: string[];
}): string {
  const line = (opts.line || "").trim();
  if (line) {
    return buildSpeakingMotion({
      styleId: opts.styleId,
      speaker: opts.speaker,
      line,
      lookLock: opts.lookLock,
    });
  }
  const names = (opts.shotSpeakers || []).map(clean).filter(Boolean);
  if (names.length > 1) return buildGroupHoldMotion({ styleId: opts.styleId, names });
  return buildHoldMotion({
    styleId: opts.styleId,
    speaker: opts.speaker,
    lookLock: opts.lookLock,
  });
}

/** Hotfix GLOBAL socket only. Cloud IA2V uses ltxSendPrompt(imageMotion). */
export function buildGlobalPrompt(styleId: ShowStyleId): string {
  return clean([LTX_LIP_SYNC_LEAD, motionStyleLock(styleId)].join(" "));
}
