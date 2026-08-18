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

const GOLD_START_FRAME = "Use the provided start image as the first frame.";
const GOLD_PROPS_LOCK =
  "Props and background stay exactly as the start image, nothing new enters frame.";
const GOLD_SAME_OBJECTS = "Same person and objects as the start image.";
const GOLD_NO_NEW_PEOPLE = "No new people enter the frame.";
const GOLD_NO_LINE_EXTRAS = "Nobody mentioned in the spoken line appears on screen.";
const GOLD_CAMERA_HOLDS = "Camera holds.";

/**
 * Short custom LTX (start image + mouth + says) drops the walker locks.
 * Append any missing gold sentences on send so extras from the rant
 * (land lady, addicts) do not walk through a plate that was already clean.
 */
export function ensureGoldFrameLocks(prompt: string): string {
  const body = stripLtxLipSyncLead(prompt);
  if (!body) return body;
  const bits: string[] = [];
  if (!/use the provided start image as the first frame/i.test(body)) {
    bits.push(GOLD_START_FRAME);
  }
  if (!/nothing new enters frame/i.test(body)) bits.push(GOLD_PROPS_LOCK);
  if (!/same (person|people) and objects as the start image/i.test(body)) {
    bits.push(GOLD_SAME_OBJECTS);
  }
  if (!/no new people enter/i.test(body)) bits.push(GOLD_NO_NEW_PEOPLE);
  if (/\bsays:\s*"/i.test(body) && !/nobody mentioned in the spoken line/i.test(body)) {
    bits.push(GOLD_NO_LINE_EXTRAS);
  }
  if (!/camera holds/i.test(body)) bits.push(GOLD_CAMERA_HOLDS);
  return bits.length ? clean(`${body} ${bits.join(" ")}`) : body;
}

/** Drop Jo's injected phone lock when the director asked for empty hands. */
export function stripJoPhoneLock(prompt: string): string {
  return clean(
    prompt
      .replace(JO_PHONE_LOCK, "empty hands, no phone")
      .replace(/thumbs hammering the keys as she texts,?\s*/gi, "")
      .replace(/thumbs tapping the keys,?\s*/gi, "")
      .replace(/while she speaks the line as she types,?\s*/gi, "")
      .replace(/,? ?keyboard warrior/gi, ""),
  );
}

/** The one string Cloud LTX gets: lead + Image motion body + walker locks. */
export function ltxSendPrompt(imageMotion: string, staging = ""): string {
  let body = ensureGoldFrameLocks(imageMotion);
  if (directorWantsEmptyHands(staging) || directorWantsEmptyHands(body)) {
    body = stripJoPhoneLock(body);
  }
  return withLtxLipSyncLead(body);
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

/** Gold still / motion lock — phone in her hands, staring manic, texting. */
export const JO_PHONE_LOCK =
  "holding her mobile phone, texting, staring at the screen like a crazed maniac";

/** Director already chose empty hands — do not inject Jo's phone. */
export function directorWantsEmptyHands(text: string): boolean {
  const t = text.toLowerCase();
  return (
    /\bempty hands\b/.test(t) ||
    /\bno phone\b/.test(t) ||
    /\bno mobile\b/.test(t) ||
    /\bhands free\b/.test(t) ||
    /\bhands in (her|his|their) lap\b/.test(t) ||
    /\bnot holding\b/.test(t)
  );
}

function stagingAlreadyNamesHeldProp(staging: string): boolean {
  const text = staging.toLowerCase();
  if (directorWantsEmptyHands(text)) return true;
  if (/\b(racket|pie)\b/.test(text)) return true;
  if (/\bno (phone|mobile)\b/.test(text)) return true;
  return /\b(phone|mobile)\b/.test(text);
}

/** Extra sentence for the plate still when Jo is on the card and no other prop is named. */
export function joPhoneStagingExtra(speakers: string[], staging: string): string {
  if (!speakers.some((n) => isJoKeyboardWarrior(n))) return "";
  if (directorWantsEmptyHands(staging)) return "";
  if (stagingAlreadyNamesHeldProp(staging)) return "";
  return `Holding her mobile phone, texting, staring at the screen like a crazed maniac.`;
}

export function defaultSoloStaging(speaker: string): string {
  const who = speaker.trim() || "The character";
  const alone = `${who} alone. Only ${who} in frame, no one else appears. Standing centre-frame, facing camera, mid body.`;
  if (!isJoKeyboardWarrior(who)) return alone;
  return `${alone} Holding her mobile phone, texting, staring at the screen like a crazed maniac.`;
}

function speakingAction(speaker: string, emptyHands = false): string {
  if (emptyHands) {
    return "empty hands stay as the start image, no phone, mouth and head move naturally while speaking, subtle gesture";
  }
  if (isJoKeyboardWarrior(speaker)) {
    return `${JO_PHONE_LOCK}, thumbs hammering the keys as she texts, mouth and head move naturally while she speaks the line as she types, keyboard warrior`;
  }
  return "mouth and head move naturally while speaking, subtle gesture";
}

function holdAction(speaker: string, emptyHands = false): string {
  if (emptyHands) {
    return "is prominent, empty hands, no phone, holds their pose, subtle idle motion, weight shift, breathing, heat haze, flies";
  }
  if (isJoKeyboardWarrior(speaker)) {
    return `is prominent, ${JO_PHONE_LOCK}, thumbs tapping the keys, holds her pose, subtle idle motion, weight shift, breathing, heat haze, flies`;
  }
  return "holds their pose, subtle idle motion, weight shift, breathing, heat haze, flies";
}

export function onlyTheseInFrame(names: string[]): string {
  const unique = [...new Set(names.map(clean).filter(Boolean))];
  const roll =
    unique.length <= 1
      ? unique[0] || "the person in the start image"
      : `${unique.slice(0, -1).join(", ")} and ${unique[unique.length - 1]}`;
  return `Only ${roll} in frame, no one else appears.`;
}

/**
 * Plate staging ("alone in the cell, only Jo in frame, sitting on the bed")
 * is for the still. If it is Saved as the spoken line, LTX lip-syncs a
 * position paragraph and often invents people walking through the room.
 */
export function looksLikePlatePositionPrompt(text: string): boolean {
  const t = clean(text).toLowerCase();
  if (!t) return false;
  const hits = [
    /only .{1,80} in frame/,
    /no one else appears/,
    /sitting on the bed/,
    /\(the cell\)/,
    /alone in .{1,80}bedroom/,
    /holding her mobile phone, texting/,
    /staring at the screen like a crazed maniac/,
  ].filter((re) => re.test(t)).length;
  return hits >= 2;
}

function imageMotionCitesLine(motion: string, line: string): boolean {
  const spoken = clean(line);
  if (!spoken) return true;
  if (!/\bsays:\s*"/i.test(motion)) return false;
  const needle = spoken.slice(0, 32).toLowerCase();
  return motion.toLowerCase().includes(needle);
}

/** Keep a stored LTX body only if it still names this spoken line — not a still position. */
export function imageMotionUsableForLine(motion: string | undefined, line: string): boolean {
  const existing = stripLtxLipSyncLead(motion || "");
  if (!existing) return false;
  if (looksLikePlatePositionPrompt(line)) return false;
  // Gold / campaign motion includes "Only NAME in frame" on purpose. That is
  // not a dumped Position box — dump has no NAME says: "line".
  if (looksLikePlatePositionPrompt(existing) && !imageMotionCitesLine(existing, line)) {
    return false;
  }
  return imageMotionCitesLine(existing, line);
}

function inFrameNames(speaker: string, shotSpeakers?: string[]): string[] {
  const names = (shotSpeakers || []).map(clean).filter(Boolean);
  if (!names.length) return [clean(speaker)].filter(Boolean);
  return [...new Set(names)];
}

/**
 * CAST face prompts are long bios ("loves a beer, barrack for Collingwood…").
 * Dumping that into default Image motion makes LTX reinvent the person and
 * drop the start plate. Gold wants a short visual lock only.
 */
export function shortLtxLookLock(lookLock: string, maxChars = 120): string {
  const raw = clean(lookLock);
  if (!raw) return "";
  const drop =
    /\b(loves?|love[sd]?|barrack|barracks|fan of|supports?|not a cartoon|not a photo|not photographic|not photorealistic|3d model|a 3d|personality|vibe|energy)\b/i;
  const parts = raw
    .split(/[,;]+/)
    .map((p) => clean(p))
    .filter(Boolean)
    .filter((p) => !drop.test(p));
  const picked = (parts.length ? parts : raw.split(/[,;]+/).map(clean).filter(Boolean)).slice(
    0,
    4,
  );
  let out = clean(picked.join(", "));
  if (out.length > maxChars) {
    out = clean(out.slice(0, maxChars).replace(/[,;\s]+[^,;]*$/, ""));
  }
  return out;
}

/** Speaking beat — the mandatory shape from the standard. */
export function buildSpeakingMotion(opts: {
  styleId: ShowStyleId;
  speaker: string;
  line: string;
  /** The character's look, so the plate's subject is named and held. */
  lookLock?: string;
  shotSpeakers?: string[];
  /** Position / staging — empty hands here beats Jo's phone default. */
  staging?: string;
}): string {
  const name = clean(opts.speaker) || "The character";
  const look = shortLtxLookLock(opts.lookLock || "");
  const who = look ? `${name}, ${look}` : name;
  const emptyHands = directorWantsEmptyHands(opts.staging || "");
  return clean(
    [
      "Use the provided start image as the first frame.",
      `${who} is prominent, ${speakingAction(opts.speaker, emptyHands)}.`,
      onlyTheseInFrame(inFrameNames(name, opts.shotSpeakers)),
      "Props and background stay exactly as the start image, nothing new enters frame.",
      `${name} says: "${clean(opts.line)}".`,
      "Camera holds. Same person and objects as the start image.",
      "No new people enter the frame.",
      GOLD_NO_LINE_EXTRAS,
      motionStyleLock(opts.styleId),
    ].join(" "),
  );
}

/** Beat with no dialogue, one character in shot. */
export function buildHoldMotion(opts: {
  styleId: ShowStyleId;
  speaker: string;
  lookLock?: string;
  shotSpeakers?: string[];
  staging?: string;
}): string {
  const name = clean(opts.speaker) || "The character";
  const look = shortLtxLookLock(opts.lookLock || "");
  const who = look ? `${name}, ${look}` : name;
  const emptyHands = directorWantsEmptyHands(opts.staging || "");
  return clean(
    [
      "Use the provided start image as the first frame.",
      `${who} ${holdAction(opts.speaker, emptyHands)}.`,
      onlyTheseInFrame(inFrameNames(name, opts.shotSpeakers)),
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
  return clean(
    [
      "Use the provided start image as the first frame.",
      onlyTheseInFrame(names),
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
  staging?: string;
}): string {
  const line = (opts.line || "").trim();
  if (line) {
    return buildSpeakingMotion({
      styleId: opts.styleId,
      speaker: opts.speaker,
      line,
      lookLock: opts.lookLock,
      shotSpeakers: opts.shotSpeakers,
      staging: opts.staging,
    });
  }
  const names = (opts.shotSpeakers || []).map(clean).filter(Boolean);
  if (names.length > 1) return buildGroupHoldMotion({ styleId: opts.styleId, names });
  return buildHoldMotion({
    styleId: opts.styleId,
    speaker: opts.speaker,
    lookLock: opts.lookLock,
    shotSpeakers: names.length ? names : undefined,
    staging: opts.staging,
  });
}

/** Hotfix GLOBAL socket only. Cloud IA2V uses ltxSendPrompt(imageMotion). */
export function buildGlobalPrompt(styleId: ShowStyleId): string {
  return clean([LTX_LIP_SYNC_LEAD, motionStyleLock(styleId)].join(" "));
}
