import type { PresetCharacter } from "./showStylePresets";

/**
 * ElevenLabs voice lines = sound only (accent, sex, age, delivery).
 * Never inject cast brief / joke surnames — those trip their safety filter.
 * On-screen names stay full (Shazza Crack etc.).
 */

/** Locked voice recipes — full name then first name (lowercase). */
const VOICE_BY_NAME: Record<string, string> = {
  "shazza crack":
    "Australian female voice, mid-fifties woman. Frail but sultry. Dry delivery, not American, not announcer.",
  shazza:
    "Australian female voice, mid-fifties woman. Frail but sultry. Dry delivery, not American, not announcer.",
  "kylie pipe":
    "Australian female voice, late twenties. Sharp nasal pub voice, loud and bored. Dry delivery, not American, not announcer.",
  kylie:
    "Australian female voice, late twenties. Sharp nasal pub voice, loud and bored. Dry delivery, not American, not announcer.",
  "bin bag barry":
    "Australian male voice, forties. Thin, reedy, nervous, quiet and shaky. Dry delivery, not American, not announcer.",
  barry:
    "Australian male voice, forties. Thin, reedy, nervous, quiet and shaky. Dry delivery, not American, not announcer.",
  "marcus velvet":
    "Australian male voice, thirties. Try-hard club slime, flat and oily. Dry delivery, not American, not announcer.",
  marcus:
    "Australian male voice, thirties. Try-hard club slime, flat and oily. Dry delivery, not American, not announcer.",
  "trina afterhours":
    "Australian female voice, thirties. Harsh smoker rasp, club-loud. Dry delivery, not American, not announcer.",
  trina:
    "Australian female voice, thirties. Harsh smoker rasp, club-loud. Dry delivery, not American, not announcer.",
  custard:
    "Australian male voice, small and smug, talking pet energy, slightly nasal. Dry delivery, not American, not announcer.",
  "brittany year11":
    "Australian female voice, young adult. Bored schoolyard drawl, blunt and mean. Dry delivery, not American, not announcer.",
  brittany:
    "Australian female voice, young adult. Bored schoolyard drawl, blunt and mean. Dry delivery, not American, not announcer.",
};

const FEMALE_FIRST = new Set([
  "shazza",
  "kylie",
  "trina",
  "brittany",
  "jum",
  "nan",
  "nanna",
  "moira",
  "bev",
  "auntie",
  "kim",
  "chloe",
  "sarah",
  "jo",
  "tee",
  "landy",
]);

function nameTokens(name: string): string[] {
  return name
    .trim()
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** Prefer a known character token over the first adjective.
 * "Crazy Big Hole Jo Too" is Jo, not Crazy. */
export function speakerVoiceKey(name: string): string {
  const parts = nameTokens(name);
  if (!parts.length) return "";
  const hit = parts.find((p) => FEMALE_FIRST.has(p) || Boolean(VOICE_BY_NAME[p]));
  return hit || parts[0] || "";
}

function firstName(name: string): string {
  return speakerVoiceKey(name);
}

function voiceSafeWho(name: string): string {
  const first = speakerVoiceKey(name) || name.trim().split(/\s+/)[0] || "";
  const cleaned = first.replace(/[^a-zA-Z'-]+/g, "").trim();
  if (!cleaned) return "speaker";
  if (/crack|meth|smack|whore|junkie/i.test(cleaned)) return "speaker";
  return cleaned;
}

/** Scrub lines before they hit ElevenLabs (keeps UI cast names untouched). */
export function sanitizeVoiceDescriptionForApi(text: string): string {
  let t = text.trim();
  t = t.replace(/crackwhore/gi, "");
  t = t.replace(/crack[\s_-]?whore/gi, "");
  t = t.replace(/\b(crack|meth|smack|junkie|whore)\b/gi, "");
  t = t.replace(/\s{2,}/g, " ");
  t = t.replace(/\.\s*\./g, ".");
  t = t.replace(/\s+\./g, ".");
  t = t.replace(/^\.+|\.+$/g, "").trim();
  if (t.length < 12) {
    return "Australian female voice. Dry delivery, not American, not announcer.";
  }
  return t.slice(0, 480);
}

/**
 * Starter ElevenLabs voice line — sex/age/delivery, not story brief.
 */
export function defaultCrashVoicePrompt(
  name: string,
  _opts?: { brief?: string; preset?: PresetCharacter | null },
): string {
  const full = name.trim().toLowerCase();
  if (VOICE_BY_NAME[full]) return VOICE_BY_NAME[full];
  const key = firstName(name);
  if (VOICE_BY_NAME[key]) return VOICE_BY_NAME[key];

  const who = voiceSafeWho(name);
  if (FEMALE_FIRST.has(key)) {
    return `Australian female voice. ${who}. Dry delivery, not American, not announcer.`;
  }
  return `Australian male voice. ${who}. Dry delivery, not American, not announcer.`;
}

/** Male/female only — for recycled library voices and cast shelves. */
export function speakerWantedSex(
  name: string,
  appearanceHint?: string,
): "female" | "male" {
  const hint = (appearanceHint || "").trim();
  if (hint) {
    const h = hint.toLowerCase();
    const female = /\bfemale\b|\bwoman\b|\blady\b|\bgirl\b|\bshe\b|\bher\b/.test(h);
    const male = /\bmale\b|\bman\b|\bboy\b|\bhe\b|\bhis\b|\bbeard\b/.test(h);
    if (female && !male) return "female";
    if (male && !female) return "male";
    if (/\bfemale\b/.test(h) && !/\bmale\b/.test(h)) return "female";
    if (/\bmale\b/.test(h) && !/\bfemale\b/.test(h)) return "male";
  }
  return /\bfemale voice\b/i.test(defaultCrashVoicePrompt(name)) ? "female" : "male";
}

export function matchPresetCharacter(
  presetCast: PresetCharacter[],
  name?: string,
): PresetCharacter | null {
  if (!name?.trim()) return null;
  const n = name.trim().toLowerCase();
  return (
    presetCast.find((p) => p.name.toLowerCase() === n) ||
    presetCast.find((p) => n.includes(p.name.toLowerCase())) ||
    null
  );
}
