import { speakerVoiceKey } from "./crashVoicePrompt";
import { jackWalkCameraForStartSec } from "./musicVideoGroupPlate";
import { MINIMAX_H3_MAX_SEC, MINIMAX_H3_MIN_SEC } from "./minimaxH3";
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
const GOLD_NO_TEXT =
  "No new objects. No readable text or signage. Background stays as the start image.";
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
  if (!/same (?:(?:person|people) and )?objects as the start image/i.test(body)) {
    bits.push(
      /no people in frame|empty road as the start image/i.test(body)
        ? "Same objects as the start image."
        : GOLD_SAME_OBJECTS,
    );
  }
  if (!/no new people enter/i.test(body)) bits.push(GOLD_NO_NEW_PEOPLE);
  if (/\bsays:\s*"/i.test(body) && !/nobody mentioned in the spoken line/i.test(body)) {
    bits.push(GOLD_NO_LINE_EXTRAS);
  }
  if (!/no readable text or signage/i.test(body)) bits.push(GOLD_NO_TEXT);
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

/** Silent cutaway — no spoken line, no lip-sync lead. */
export function isCutawayMotion(prompt: string): boolean {
  const t = stripLtxLipSyncLead(prompt).toLowerCase();
  if (!t) return false;
  if (/\bsays:\s*"/.test(t)) return false;
  return /\bno dialogue\b/.test(t) && /\bmouth stays closed\b/.test(t);
}

/** The one string Cloud LTX gets: lead + Image motion body + walker locks. */
export function ltxSendPrompt(
  imageMotion: string,
  staging = "",
  opts?: { skipLipSyncLead?: boolean; speaker?: string; shotSpeakers?: string[] },
): string {
  let body = ensureGoldFrameLocks(imageMotion);
  if (directorWantsEmptyHands(staging) || directorWantsEmptyHands(body)) {
    body = stripJoPhoneLock(body);
  }
  body = ensureSpeakingListenerLock(body, {
    speaker: opts?.speaker,
    shotSpeakers: opts?.shotSpeakers,
  });
  if (isCutawayMotion(body) || opts?.skipLipSyncLead) return body;
  return withLtxLipSyncLead(body);
}

/**
 * Instrumental plate — sax / guitar / drums, not a singing close-up.
 * Do NOT guess "silhouette" from staging text: bible positions say
 * "clear silhouette against the place" and Jack's hat brim would match
 * hat-brim rules — that bled into lit singers and other characters (#259/#262).
 */
export function isInstrumentalStaging(staging: string): boolean {
  const t = (staging || "").toLowerCase();
  if (!t) return false;
  return (
    /\b(sax(?:ophone)?|trumpet|trombone|clarinet|flute|guitar|bass|drum(?:s|mer)?|keyboard|piano|violin|cello|harmonica|instrument(?:al)?)\b/.test(
      t,
    ) || /\bplay(?:s|ing)?\s+(the\s+)?(sax|guitar|drums|bass|keys|piano|trumpet)\b/.test(t)
  );
}

/**
 * CRAZY BIG HOLE JO (and Jo Too) — phone / keyboard warrior only when
 * Position or the Scratch toggle names it. Same held-prop shape as pies and
 * tennis rackets. Default for everyone including Jo is empty hands.
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
    /\bnot holding\b/.test(t) ||
    /\barms? (at|to|by|down at) (her |his |their )?(sides?|side)\b/.test(t) ||
    /\bhands? (at|to|by) (her |his |their )?sides?\b/.test(t)
  );
}

/** Scratch letter that never named a phone — do not inject JO's keyboard-warrior default. */
export function withScratchEmptyHands(staging: string, skip = false): string {
  const t = (staging || "").trim();
  if (!t || skip) return t;
  if (directorWantsEmptyHands(t)) return t;
  if (/\b(phone|mobile)\b/i.test(t)) return t;
  return `${t}\n\nEmpty hands. Arms down at her sides. No phone. Do not copy a phone from the face card.`;
}

/** Still lock when Position did not name a held object. Everyone including Jo. */
export const NO_PROPS_STILL_LOCK =
  "Empty hands. No phone. No mug, cup, cooler, bottle, or extra objects in anyone's hands. Do not invent props. Do not copy a phone or held object from the face card.";

/**
 * Sunny Plate: lines are written "Bazza holds a whistle up", not "holding".
 * Only the gerund was matched, so the natural wording missed and
 * NO_PROPS_STILL_LOCK ("Empty hands... Do not invent props") got appended
 * next to the prop the writer had just named. Unambiguous holding verbs only —
 * "has a" / "with a" stay out, they match "has a grin" and would punch a hole
 * in the no-props floor.
 */
const HELD_PROP_VERBS =
  /\b(holds?|holding|grips?|gripping|clutch(?:es|ing)?|carries|carrying|cradl(?:es|ing)|waves?|waving|raises?|raising)\b/;

/** Position named a thing in their hands — keep that, do not inject empty hands or Jo's phone. */
export function stagingNamesHeldProp(
  staging: string,
  styleId?: ShowStyleId,
): boolean {
  const text = staging.toLowerCase();
  if (!text.trim()) return false;
  if (directorWantsEmptyHands(text)) return false;
  if (/\b(racket|pie|phone|mobile)\b/.test(text)) return true;
  if (/\bholding\b/.test(text)) return true;
  if (styleId === "sunny_banks" && HELD_PROP_VERBS.test(text)) return true;
  return /\bin (her|his|their) hands?\b/.test(text);
}

/** Empty-hands line for the still, or "" when Position already named a held prop. */
export function emptyHandsStillLock(staging: string, styleId?: ShowStyleId): string {
  if (directorWantsEmptyHands(staging)) {
    return "Empty hands. No phone in anyone's hands.";
  }
  if (stagingNamesHeldProp(staging, styleId)) {
    return "Only the held object named in the position. Do not invent extra objects.";
  }
  return NO_PROPS_STILL_LOCK;
}

function stagingAlreadyNamesHeldProp(staging: string): boolean {
  return stagingNamesHeldProp(staging) || directorWantsEmptyHands(staging);
}

/**
 * Extra sentence for the plate still when the Jo-phone toggle is on and
 * Position did not name empty hands or a different held prop.
 */
export function joPhoneStagingExtra(
  speakers: string[],
  staging: string,
  allow = false,
): string {
  if (!allow) return "";
  if (!speakers.some((n) => isJoKeyboardWarrior(n))) return "";
  if (directorWantsEmptyHands(staging)) return "";
  if (stagingAlreadyNamesHeldProp(staging)) return "";
  return `Holding her mobile phone, texting, staring at the screen like a crazed maniac.`;
}

export function defaultSoloStaging(speaker: string): string {
  const who = speaker.trim() || "The character";
  return `${who} alone. Only ${who} in frame, no one else appears. Standing centre-frame, facing camera, mid body. Empty hands. No phone. No extra objects.`;
}

function speakingAction(speaker: string, staging = "", styleId?: ShowStyleId): string {
  if (directorWantsEmptyHands(staging) || !stagingNamesHeldProp(staging, styleId)) {
    return "empty hands stay as the start image, no phone, mouth and head move naturally while speaking, subtle gesture";
  }
  if (isJoKeyboardWarrior(speaker) && /\b(phone|mobile)\b/i.test(staging)) {
    return `${JO_PHONE_LOCK}, thumbs hammering the keys as she texts, mouth and head move naturally while she speaks the line as she types, keyboard warrior`;
  }
  return "mouth and head move naturally while speaking, subtle gesture";
}

function holdAction(speaker: string, staging = "", styleId?: ShowStyleId): string {
  if (directorWantsEmptyHands(staging) || !stagingNamesHeldProp(staging, styleId)) {
    return "is prominent, empty hands, no phone, holds their pose, subtle idle motion, weight shift, breathing, heat haze, flies";
  }
  if (isJoKeyboardWarrior(speaker) && /\b(phone|mobile)\b/i.test(staging)) {
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

function namesEqual(a: string, b: string): boolean {
  return clean(a).toLowerCase() === clean(b).toLowerCase();
}

function possessiveName(name: string): string {
  return /s$/i.test(name) ? `${name}'` : `${name}'s`;
}

/** One CAST name, more than one body — The Unit 4s, two purple figures. */
function isGroupListener(name: string): boolean {
  return /\bunit\s*4s\b/i.test(name) || /\baliens\b/i.test(name);
}

function joinPeople(names: string[]): string {
  if (names.length <= 1) return names[0] || "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function speakerFromMotion(motion: string): string {
  const hits = [...motion.matchAll(/([A-Za-z0-9][A-Za-z0-9 '-]{0,40}?)\s+says:\s*"/g)];
  return clean(hits.at(-1)?.[1] || "");
}

function othersFromMotion(motion: string, speaker: string): string[] {
  const m = motion.match(/Only (.+?) in frame/i);
  if (!m) return [];
  return m[1]
    .split(/,| and /i)
    .map(clean)
    .filter((n) => n && !/^the person/i.test(n) && !namesEqual(n, speaker));
}

/** Other faces on a two-hander must not take the lip-sync. Solo gold stays untouched. */
export function speakingListenerLock(speaker: string, others: string[]): string {
  const who = clean(speaker);
  const rest = [...new Set(others.map(clean).filter((n) => n && !namesEqual(n, who)))];
  if (!who || !rest.length) return "";
  const listeners = joinPeople(rest);
  const many = rest.length > 1 || rest.some(isGroupListener);
  const verb = many ? "listen" : "listens";
  const mouths = many ? "mouths closed" : "mouth closed";
  return `Only ${possessiveName(who)} mouth moves. ${listeners} ${verb} in silence, ${mouths}.`;
}

export function speakingMotionHasListenerLock(motion: string): boolean {
  const t = stripLtxLipSyncLead(motion);
  return /mouth moves/i.test(t) && /listen(?:s)? in silence/i.test(t);
}

export function ensureSpeakingListenerLock(
  motion: string,
  opts?: { speaker?: string; shotSpeakers?: string[] },
): string {
  const body = clean(motion);
  if (!body || !/\bsays:\s*"/i.test(body)) return body;
  if (speakingMotionHasListenerLock(body)) return body;
  const speaker = clean(opts?.speaker || "") || speakerFromMotion(body);
  const fromCard = (opts?.shotSpeakers || [])
    .map(clean)
    .filter((n) => n && !namesEqual(n, speaker));
  const others = fromCard.length ? [...new Set(fromCard)] : othersFromMotion(body, speaker);
  const lock = speakingListenerLock(speaker, others);
  return lock ? clean(`${body} ${lock}`) : body;
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

export function imageMotionHasJoPhoneLock(motion: string): boolean {
  const t = stripLtxLipSyncLead(motion).toLowerCase();
  if (!t) return false;
  return (
    t.includes("holding her mobile phone") ||
    t.includes("keyboard warrior") ||
    t.includes("staring at the screen like a crazed maniac")
  );
}

/** Stored gold still has Jo's phone, but Position asked for empty hands. */
export function storedMotionFightsEmptyHands(
  motion: string | undefined,
  staging: string,
): boolean {
  if (!directorWantsEmptyHands(staging)) return false;
  return imageMotionHasJoPhoneLock(motion || "");
}

/** CAST bio leaked into LTX ("a little bit younger… cleaner") — start image is the look. */
export function storedMotionReinventsLook(motion: string | undefined): boolean {
  const t = stripLtxLipSyncLead(motion || "").toLowerCase();
  if (!t) return false;
  return (
    /\bsame person just\b/.test(t) ||
    /\ba little bit younger\b/.test(t) ||
    /\bshe is cleaner\b/.test(t) ||
    /\bfront on (of|off) this character\b/.test(t)
  );
}

/** Keep a stored LTX body only if it still names this spoken line — not a still position. */
export function imageMotionUsableForLine(
  motion: string | undefined,
  line: string,
  staging = "",
): boolean {
  const existing = stripLtxLipSyncLead(motion || "");
  if (!existing) return false;
  if (looksLikePlatePositionPrompt(line)) return false;
  // Gold / campaign motion includes "Only NAME in frame" on purpose. That is
  // not a dumped Position box — dump has no NAME says: "line".
  if (looksLikePlatePositionPrompt(existing) && !imageMotionCitesLine(existing, line)) {
    return false;
  }
  if (storedMotionNeedsRebuild(existing, staging)) return false;
  return imageMotionCitesLine(existing, line);
}

export function storedMotionNeedsRebuild(
  motion: string | undefined,
  staging: string,
): boolean {
  return storedMotionFightsEmptyHands(motion, staging) || storedMotionReinventsLook(motion);
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
  if (/front on (of|off) this character/i.test(raw)) return "";
  const drop =
    /\b(loves?|love[sd]?|barrack|barracks|fan of|supports?|not a cartoon|not a photo|not photographic|not photorealistic|3d model|a 3d|personality|vibe|energy|younger|older|cleaner|same person)\b/i;
  const parts = raw
    .split(/[,;]+/)
    .map((p) => clean(p))
    .filter(Boolean)
    .filter((p) => !drop.test(p));
  const picked = parts.slice(0, 4);
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
  /** Position / staging — named held prop only; otherwise empty hands. */
  staging?: string;
}): string {
  const name = clean(opts.speaker) || "The character";
  const look = shortLtxLookLock(opts.lookLock || "");
  const who = look ? `${name}, ${look}` : name;
  const inFrame = inFrameNames(name, opts.shotSpeakers);
  const others = inFrame.filter((n) => !namesEqual(n, name));
  return clean(
    [
      "Use the provided start image as the first frame.",
      `${who} is prominent, ${speakingAction(opts.speaker, opts.staging || "", opts.styleId)}.`,
      onlyTheseInFrame(inFrame),
      speakingListenerLock(name, others),
      "Props and background stay exactly as the start image, nothing new enters frame.",
      GOLD_NO_TEXT,
      `${name} says: "${clean(opts.line)}".`,
      "Camera holds. Same person and objects as the start image.",
      "No new people enter the frame.",
      GOLD_NO_LINE_EXTRAS,
      motionStyleLock(opts.styleId),
    ].join(" "),
  );
}

/**
 * Silent action on the existing still — stand up, walk away, walk toward.
 * No spoken line. No lip-sync lead. Same first-frame lock as a hold.
 */
export function buildCutawayMotion(opts: {
  styleId: ShowStyleId;
  speaker: string;
  action: string;
  lookLock?: string;
  shotSpeakers?: string[];
  staging?: string;
}): string {
  const name = clean(opts.speaker) || "The character";
  const look = shortLtxLookLock(opts.lookLock || "");
  const who = look ? `${name}, ${look}` : name;
  const move = clean(opts.action) || "stands up from sitting, rises to their feet";
  return clean(
    [
      "Use the provided start image as the first frame.",
      `${who} is prominent, empty hands, no phone. ${move}.`,
      onlyTheseInFrame(inFrameNames(name, opts.shotSpeakers)),
      "Props and background stay exactly as the start image, nothing new enters frame.",
      GOLD_NO_TEXT,
      "No dialogue. Mouth stays closed. Camera holds, no cuts. Same person and objects as the start image.",
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
  shotSpeakers?: string[];
  staging?: string;
}): string {
  const name = clean(opts.speaker) || "The character";
  const look = shortLtxLookLock(opts.lookLock || "");
  const who = look ? `${name}, ${look}` : name;
  return clean(
    [
      "Use the provided start image as the first frame.",
      `${who} ${holdAction(opts.speaker, opts.staging || "", opts.styleId)}.`,
      onlyTheseInFrame(inFrameNames(name, opts.shotSpeakers)),
      "Props and background stay exactly as the start image, nothing new enters frame.",
      GOLD_NO_TEXT,
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
      GOLD_NO_TEXT,
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

export type SongSlicePerformance = "play" | "sway" | "sing" | "walk";

const JACK_FACE_HIDDEN =
  "Face stays hidden in the hat shadow. Do not light the eyes or cheeks. Do not reveal a face. Same silhouette as the start image. Empty hands. No saxophone. No trumpet. No instrument. No microphone.";

/** Body Jack can actually do when the still shows his arms. Tight CU cannot send this. */
const JACK_ROCKSTAR_MOVES = [
  "Both arms in the air, empty hands open, chest out — global rockstar stadium shape.",
  "One arm high, empty fist, other hand open at his side. Hits the chorus like a headliner.",
  "Arms wide, empty hands, leaning into the vocal. Weight shifts on the beat.",
  "Arms up then down with the beat, empty hands, shoulders and chest work the song.",
] as const;

function jackRockstarMoveForStartSec(startSec: number): string {
  const n = Number.isFinite(startSec) ? Math.max(0, Math.floor(startSec)) : 0;
  return JACK_ROCKSTAR_MOVES[n % JACK_ROCKSTAR_MOVES.length]!;
}

const HORN_ACTUALLY_PLAYS =
  "Fade in. He is actually playing the trumpet: lips sealed on the mouthpiece, cheeks puff and release, fingers work the valves, breath in time with the music. Not posing. Not smiling at the camera. Not holding the horn still. Fade out before the end. Same man when he revolves back — same vest, same trumpet, not a new player.";

const SAX_ACTUALLY_PLAYS =
  "Fade in. He is actually playing the saxophone: reed in the mouth, fingers work the keys, breath in time with the music. Not posing. Not smiling at the camera. Not holding the sax still. Fade out before the end. Same man when he revolves back — same clothes, same saxophone, not a new player.";

function isJackGhostSpeaker(speaker: string): boolean {
  return /jack ghost/i.test(speaker || "");
}

/** Scratch / Music video song slice — singing, swaying, walking away, or actually playing. */
export function buildScratchSongLtxMotion(opts: {
  styleId: ShowStyleId;
  speaker: string;
  lookLock?: string;
  staging?: string;
  performance?: SongSlicePerformance;
  startSec?: number;
}): string {
  const name = clean(opts.speaker) || "The performer";
  // Song slices drift hard on later cuts — keep more of the cast look than the 120-char speak trim.
  const look = shortLtxLookLock(opts.lookLock || "", 160);
  const who = look ? `${name}, ${look}` : name;
  const jack = isJackGhostSpeaker(opts.speaker);
  const performance =
    opts.performance ||
    (isInstrumentalStaging(opts.staging || "") ? "play" : "sing");
  const walk = performance === "walk";
  const identityLock = walk
    ? "Same silhouette, same hat, same clothes as the start image — not a different person, not younger. Do not invent a face. Do not invent or change letters on the hat or clothing."
    : "Same face, same hair, same hat, same clothes as the start image — not a different person, not younger, not a new face. Do not invent or change letters on the hat or clothing.";
  const walkCamera = jackWalkCameraForStartSec(opts.startSec ?? 0);
  const action =
    performance === "play"
      ? /sax/i.test(`${opts.speaker} ${opts.staging || ""}`)
        ? `${who} is prominent. ${SAX_ACTUALLY_PLAYS}`
        : /horn|trumpet/i.test(`${opts.speaker} ${opts.staging || ""}`)
          ? `${who} is prominent. ${HORN_ACTUALLY_PLAYS}`
          : `${who} is prominent, hands and body play the same instrument as the start image, in time with the music. Not posing. Fingers and breath move.`
      : performance === "sway"
        ? `${who} is prominent, body and shoulders sway to the groove. Cyan mouth line stays still. Not singing. Not lip-sync.`
        : walk
          ? `${who} is prominent. ${walkCamera} He walks away from camera, measured, ominous. Full silhouette — fedora, dark suit, empty hands. Face never readable. Does not turn around to show a face. Not singing. Not lip-sync. No cyan glow on a face.`
          : jack
            ? `${who} is prominent. Cyan mouth line moves with the vocal. ${jackRockstarMoveForStartSec(opts.startSec ?? 0)} Hits the high notes with the body, not a visible face. Not a statue. Not a talking-head CU.`
            : `${who} is prominent, mouth and head move naturally with the music, singing, lip-sync.`;
  const closer =
    performance === "play"
      ? `${name} plays this instrumental slice. ${GOLD_CAMERA_HOLDS} Same person, same instrument, same objects as the start image. Not a new player. Not singing unless the start image is already singing.`
      : performance === "sway"
        ? `${name} sways this slice. ${GOLD_CAMERA_HOLDS} Same person and objects as the start image. Not singing.`
        : walk
          ? `${name} walks away from camera this slice. Camera stays behind him at this angle. Same silhouette and objects as the start image. Not singing.`
          : jack
            ? `${name} sings this slice of the track. Rockstar body — arms in the air, empty hands, chest and weight on the vocal, including the high notes. ${GOLD_CAMERA_HOLDS} Face stays hidden. Same person and objects as the start image.`
            : `${name} sings this slice of the track. ${GOLD_CAMERA_HOLDS} Same person and objects as the start image.`;
  return clean(
    [
      GOLD_START_FRAME,
      action,
      jack ? JACK_FACE_HIDDEN : "",
      GOLD_PROPS_LOCK,
      GOLD_NO_TEXT,
      identityLock,
      closer,
      GOLD_NO_NEW_PEOPLE,
      motionStyleLock(opts.styleId),
    ].join(" "),
  );
}

/** Jack's face stays hidden — the lip-sync lead would light a mouth we never show. */
export function skipSongLipSyncLead(opts: {
  speaker: string;
  staging?: string;
  performance?: SongSlicePerformance;
  singing: boolean;
  /** Mute / No lips — mouth shut. Never prepend perfect lip sync. */
  mute?: boolean;
}): boolean {
  if (opts.mute) return true;
  if (!opts.singing) return false;
  if (isJackGhostSpeaker(opts.speaker)) return true;
  if (opts.performance === "play" || opts.performance === "sway" || opts.performance === "walk") {
    return true;
  }
  return isInstrumentalStaging(opts.staging || "");
}

/** Scratch LTX default — gold speaking plate only. Empty stored motion only. */
export function buildScratchPadLtxMotion(opts: {
  styleId: ShowStyleId;
  speaker: string;
  line: string;
  lookLock?: string;
  shotSpeakers?: string[];
}): string {
  const name = clean(opts.speaker) || "The character";
  const look = shortLtxLookLock(opts.lookLock || "");
  const who = look ? `${name}, ${look}` : name;
  return clean(
    [
      "Use the provided start image as the first frame.",
      `${who} is prominent, mouth and head move naturally while speaking, subtle gesture.`,
      "Props and background stay exactly as the start image, nothing new enters frame.",
      `${name} says: "${clean(opts.line)}".`,
      "Camera holds. Same person and objects as the start image.",
      motionStyleLock(opts.styleId),
    ].join(" "),
  );
}

function ltxMotionDraftKey(jobId: string, beatId: string): string {
  return `skidmarks.ltxMotion.${(jobId || "").trim()}.${(beatId || "").trim()}`;
}

/** His LTX words stay in the box across Open / Send / remount. */
export function readLtxMotionDraft(jobId: string, beatId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.sessionStorage.getItem(ltxMotionDraftKey(jobId, beatId));
    return v && v.trim() ? v : null;
  } catch {
    return null;
  }
}

export function writeLtxMotionDraft(jobId: string, beatId: string, text: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(ltxMotionDraftKey(jobId, beatId), text);
  } catch {
    /* private mode */
  }
}

export function clearLtxMotionDraft(jobId: string, beatId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(ltxMotionDraftKey(jobId, beatId));
  } catch {
    /* private mode */
  }
}

export function pickLtxMotionBody(opts: {
  draft: string | null;
  stored: string;
  defaultBody: string;
}): string {
  if (opts.draft !== null) return opts.draft;
  if ((opts.stored || "").trim()) return opts.stored;
  return opts.defaultBody;
}

/** Mute / No lips lock — mouth shut, not a verse. */
export function imageMotionLooksMuteLock(text: string): boolean {
  const t = stripLtxLipSyncLead(text);
  if (!t) return false;
  if (
    /empty road as the start image/i.test(t) ||
    (/\bno people in frame\b/i.test(t) && /\bmouth n\/a\b/i.test(t))
  ) {
    return true;
  }
  return /\bmouth stays closed\b/i.test(t) && /\bnot singing\b/i.test(t);
}

/**
 * Music-video Send: No lips off (singing / song slice) uses the singing stack.
 * A stored mute lock ("Not singing") must not ride along — that cook cannot
 * be a verse. No lips on keeps the mute [ ] words. Empty-road stays empty-road.
 */
export function pickSongSendMotionBody(opts: {
  stored: string;
  storedUsable: boolean;
  singing: boolean;
  singingDefault: string;
  speakingDefault: string;
  mute?: boolean;
  muteDefault?: string;
  /** Car / scenery / Support — do not keep a stored JACK is-prominent lock. */
  emptyFrame?: boolean;
}): string {
  if (opts.emptyFrame && (opts.muteDefault || "").trim()) {
    return stripLtxLipSyncLead(opts.muteDefault || "");
  }
  if (opts.mute && (opts.muteDefault || "").trim()) {
    if (opts.storedUsable && !isSingingDefaultMotion(opts.stored)) {
      return stripLtxLipSyncLead(opts.stored);
    }
    return stripLtxLipSyncLead(opts.muteDefault || "");
  }
  if (opts.singing && imageMotionLooksMuteLock(opts.stored)) {
    return opts.singingDefault;
  }
  if (opts.storedUsable) return stripLtxLipSyncLead(opts.stored);
  if (opts.singing) return opts.singingDefault;
  return opts.speakingDefault;
}

/**
 * Mute music-video Image motion: lock is fixed, [ ] is the only edit.
 * Switching LTX ↔ H3 must keep the slot words.
 */
export type MuteMvMotionLock = { lead: string; tail: string };

export const MUTE_MV_SLOT_PLACEHOLDER = "stand up, car drives off";

const MUTE_MV_TAIL_START =
  /Props and background stay exactly as the start image|No dialogue\. Mouth stays closed|Empty road as the start image|Mouth N\/A/i;

export const MUTE_MV_EMPTY_LEAD = GOLD_START_FRAME;
export const MUTE_MV_EMPTY_TAIL =
  "Empty road as the start image. No people in frame. Mouth N/A. No dialogue. Not singing. Not lip-sync. Camera holds, no cuts. Same objects as the start image. No new people enter the frame.";

/** Persist / Send already wrote the empty-road lock — cook must not name a person. */
export function imageMotionLooksEmptyFrame(text: string): boolean {
  const t = stripLtxLipSyncLead(text);
  if (!t) return false;
  return (
    /empty road as the start image/i.test(t) ||
    (/\bno people in frame\b/i.test(t) && /\bmouth n\/a\b/i.test(t))
  );
}

export function isSingingDefaultMotion(text: string): boolean {
  const t = stripLtxLipSyncLead(text);
  if (!t) return false;
  if (/\bmouth stays closed\b/i.test(t) && /\bnot singing\b/i.test(t)) return false;
  return (
    /\bsings this slice\b/i.test(t) ||
    /\bcyan mouth line\b/i.test(t) ||
    /\bmouth and head move naturally with the music, singing\b/i.test(t)
  );
}

export function buildMuteMvMotionLock(opts: {
  styleId: ShowStyleId;
  speaker: string;
  lookLock?: string;
  shotSpeakers?: string[];
  staging?: string;
  /** Support / nobody on the pad / car-scenery mute — do not name a person. */
  emptyFrame?: boolean;
}): MuteMvMotionLock {
  if (opts.emptyFrame) {
    return {
      lead: MUTE_MV_EMPTY_LEAD,
      tail: clean([MUTE_MV_EMPTY_TAIL, motionStyleLock(opts.styleId)].join(" ")),
    };
  }
  const name = clean(opts.speaker) || "The performer";
  const look = shortLtxLookLock(opts.lookLock || "");
  const who = look ? `${name}, ${look}` : name;
  const staging = opts.staging || "";
  const hands =
    directorWantsEmptyHands(staging) || !stagingNamesHeldProp(staging, opts.styleId)
      ? "empty hands, no phone"
      : "same held object as the start image";
  return {
    lead: clean(`${GOLD_START_FRAME} ${who} is prominent, ${hands}.`),
    tail: clean(
      [
        onlyTheseInFrame(inFrameNames(name, opts.shotSpeakers)),
        GOLD_PROPS_LOCK,
        GOLD_NO_TEXT,
        "No dialogue. Mouth stays closed. Not singing. Not lip-sync. Camera holds, no cuts. Same person and objects as the start image.",
        GOLD_NO_NEW_PEOPLE,
        motionStyleLock(opts.styleId),
      ].join(" "),
    ),
  };
}

export function composeMuteMvMotion(lock: MuteMvMotionLock, slot: string): string {
  const move = clean(slot);
  return move ? clean(`${lock.lead} ${move} ${lock.tail}`) : clean(`${lock.lead} ${lock.tail}`);
}

export function extractMuteMvMotionSlot(stored: string, lock: MuteMvMotionLock): string {
  const body = stripLtxLipSyncLead(stored);
  if (!body) return "";
  if (isSingingDefaultMotion(body)) return "";
  let mid = body;
  if (lock.lead && mid.toLowerCase().startsWith(lock.lead.toLowerCase())) {
    mid = clean(mid.slice(lock.lead.length));
  } else {
    mid = clean(mid.replace(/^Use the provided start image as the first frame\.\s*/i, ""));
  }
  mid = clean(mid.replace(/^.+? is prominent(?:, [^.]{0,80})?\.\s*/i, ""));
  if (lock.tail) {
    const idx = mid.toLowerCase().indexOf(lock.tail.toLowerCase());
    if (idx >= 0) mid = clean(mid.slice(0, idx));
  }
  const tailAt = mid.search(MUTE_MV_TAIL_START);
  if (tailAt >= 0) mid = clean(mid.slice(0, tailAt));
  mid = clean(mid.replace(/\s*Only .+? in frame, no one else appears\.?\s*$/i, ""));
  return mid;
}

function mvMotionSlotKey(jobId: string, beatId: string): string {
  return `skidmarks.mvMotionSlot.${(jobId || "").trim()}.${(beatId || "").trim()}`;
}

export type MvClipEngine = "ltx" | "h3";

function mvClipEngineKey(jobId: string, shotId: string): string {
  return `skidmarks.mvClipEngine.${(jobId || "").trim()}.${(shotId || "").trim()}`;
}

/** Next Send of this still — LTX or H3. Not written onto the job. */
export function readMvClipEngine(jobId: string, shotId: string): MvClipEngine {
  if (typeof window === "undefined") return "ltx";
  try {
    const v = window.sessionStorage.getItem(mvClipEngineKey(jobId, shotId));
    return v === "h3" ? "h3" : "ltx";
  } catch {
    return "ltx";
  }
}

export function writeMvClipEngine(jobId: string, shotId: string, engine: MvClipEngine): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(mvClipEngineKey(jobId, shotId), engine);
  } catch {
    /* private mode */
  }
}

function mvMuteActionKey(jobId: string, shotId: string): string {
  return `skidmarks.mvMuteAction.${(jobId || "").trim()}.${(shotId || "").trim()}`;
}

/** Next Send of this still is action only — mouth shut, no song into IA2V. */
export function readMvMuteAction(jobId: string, shotId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(mvMuteActionKey(jobId, shotId)) === "1";
  } catch {
    return false;
  }
}

export function writeMvMuteAction(jobId: string, shotId: string, on: boolean): void {
  if (typeof window === "undefined") return;
  try {
    const key = mvMuteActionKey(jobId, shotId);
    if (on) window.sessionStorage.setItem(key, "1");
    else window.sessionStorage.removeItem(key);
  } catch {
    /* private mode */
  }
}

function mvNobodyInShotKey(jobId: string, shotId: string): string {
  return `skidmarks.mvNobodyInShot.${(jobId || "").trim()}.${(shotId || "").trim()}`;
}

/** HERO car / scenery — drop the singer name from the mute lock on next Send. */
export function readMvNobodyInShot(jobId: string, shotId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(mvNobodyInShotKey(jobId, shotId)) === "1";
  } catch {
    return false;
  }
}

export function writeMvNobodyInShot(jobId: string, shotId: string, on: boolean): void {
  if (typeof window === "undefined") return;
  try {
    const key = mvNobodyInShotKey(jobId, shotId);
    if (on) window.sessionStorage.setItem(key, "1");
    else window.sessionStorage.removeItem(key);
  } catch {
    /* private mode */
  }
}


export type MuteMvEngine = "ltx" | "h3";

function mvEngineKey(jobId: string, beatId: string): string {
  return `skidmarks.mvEngine.${(jobId || "").trim()}.${(beatId || "").trim()}`;
}

export function parseMuteMvEngine(value: string | null | undefined): MuteMvEngine {
  return value === "h3" ? "h3" : "ltx";
}

/** Next Send of this plate line — LTX or H3. Not written onto the job. */
export function readMvEngine(jobId: string, beatId: string): MuteMvEngine {
  if (typeof window === "undefined") return "ltx";
  try {
    return parseMuteMvEngine(window.sessionStorage.getItem(mvEngineKey(jobId, beatId)));
  } catch {
    return "ltx";
  }
}

export function writeMvEngine(jobId: string, beatId: string, engine: MuteMvEngine): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(mvEngineKey(jobId, beatId), engine);
  } catch {
    /* private mode */
  }
}

/** Hole header — LTX vs H3. No lips is mute on the same engine, not a third name. */
export function muteMvMotionLabel(engine: MuteMvEngine): string {
  return engine === "h3" ? "H3 Image motion" : "LTX Image motion";
}

/**
 * Desk fold only — what he was told for the hole.
 * Not `LTX_MAX_DURATION_SEC` (180 safety). H3 official range is 4–15
 * (`minimaxH3.ts`). 25s is LTX, not H3.
 */
export const MUTE_MV_LTX_DESK_MAX_SEC = 30;

/** Closed fold under the hole title. Not a TRACK essay. */
export function muteMvEngineFoldSummary(engine: MuteMvEngine): string {
  return engine === "h3"
    ? `H3 · ${MINIMAX_H3_MIN_SEC}–${MINIMAX_H3_MAX_SEC}s · first frame · one move`
    : `LTX · up to ${MUTE_MV_LTX_DESK_MAX_SEC}s · talking/sing ok · 5s ok`;
}

/**
 * One tap opens these. H3 API is first_frame + optional last_frame + duration
 * (`minimaxVideo.ts`) — no camera enum. `/m` has no last-frame picker
 * (that lives on `/scratch`). Drone/crane in `MUTE_CINEMATIC_ARCHIVE.md`
 * is people-talk for hold / push / track / pedestal.
 */
export function muteMvEngineFoldLines(engine: MuteMvEngine): string[] {
  if (engine === "h3") {
    return [
      `Length: ${MINIMAX_H3_MIN_SEC}–${MINIMAX_H3_MAX_SEC}s. No 25s. Use LTX for 25.`,
      "This still is the first frame. No last-frame picker on this desk.",
      "One move: stand, or car, not both. Camera: hold / push / track / pedestal (drone-like lift) — write it in [ ].",
      "No song into H3. No lips = mouths shut.",
      "Do not paste Cowboy Bebop / kinetic-type gold onto Jack.",
    ];
  }
  return [
    `LTX can do up to ${MUTE_MV_LTX_DESK_MAX_SEC}s. Talking or singing if you want. 5s is fine.`,
  ];
}

/**
 * Same OR as Send: live tap, then shot pick, then beat pick.
 * Stops the hole staying on LTX after H3 is already stored.
 */
export function resolveMvSendEngine(opts: {
  jobId: string;
  shotId?: string;
  beatId?: string;
  picked?: MuteMvEngine | null;
}): MuteMvEngine {
  if (opts.picked === "h3") return "h3";
  const shotId = (opts.shotId || "").trim();
  if (shotId && readMvClipEngine(opts.jobId, shotId) === "h3") return "h3";
  const beatId = (opts.beatId || "").trim();
  if (beatId && readMvEngine(opts.jobId, beatId) === "h3") return "h3";
  return "ltx";
}

/** His [ ] motion words stay when he switches LTX ↔ H3. */
export function readMvMotionSlot(jobId: string, beatId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.sessionStorage.getItem(mvMotionSlotKey(jobId, beatId));
    return v !== null ? v : null;
  } catch {
    return null;
  }
}

export function writeMvMotionSlot(jobId: string, beatId: string, text: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(mvMotionSlotKey(jobId, beatId), text);
  } catch {
    /* private mode */
  }
}

/** Kept LTX words — leftover Comfy/Land names still dump the box. */
export function songStoredMotionUsable(
  stored: string,
  leftoverNames: string[] = [],
): boolean {
  const body = stripLtxLipSyncLead(stored);
  if (!body) return false;
  return !leftoverNames.some((name) => {
    const n = name.trim();
    if (n.length < 2) return false;
    const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${escaped}\\b`, "i").test(body);
  });
}

/**
 * Send after he changed the box must park the old mp4 and cook.
 * Same words + a file already on the cut = hang, do not recook.
 */
export function songSendNeedsRecook(opts: {
  existingClipFile: string;
  lastSent: string;
  nextSent: string;
  /** Nobody / Support / empty-road — do not rehang a person cook. */
  emptyFrame?: boolean;
}): boolean {
  const file = (opts.existingClipFile || "").trim();
  if (!file) return true;
  const last = stripLtxLipSyncLead(opts.lastSent);
  const next = stripLtxLipSyncLead(opts.nextSent);
  if (
    opts.emptyFrame &&
    /is prominent/i.test(last) &&
    !imageMotionLooksEmptyFrame(last)
  ) {
    return true;
  }
  if (last && last === next) return false;
  return true;
}
