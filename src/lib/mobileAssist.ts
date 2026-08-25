import { getShowStylePreset, type ShowStyleId } from "./showStylePresets";
import { ASSIST_CONSENT_LOCK } from "./mobileAssistConsent";
import { isJoKeyboardWarrior, LTX_LIP_SYNC_LEAD } from "./mobileImageMotion";
import { styleEpisodeAssistRules } from "./styleEpisodeProcess";

export const ASSIST_KINDS = [
  "vibe",
  "cast_look",
  "location",
  "image_prompt",
  "line",
  "episode",
  "plate",
  "shot",
  "image_motion",
] as const;

export type AssistKind = (typeof ASSIST_KINDS)[number];

export function isAssistKind(v: string): v is AssistKind {
  return (ASSIST_KINDS as readonly string[]).includes(v);
}

/**
 * Every AI assist button gets this — not a subset. Field rules below say
 * which slice to write; they do not get to drop house law.
 */
export const ASSIST_CRITERIA_LOCK = [
  ASSIST_CONSENT_LOCK,
  "Write only the one box asked for. Do not dump this bible into the box. Do not mix boxes.",
  "Vibe = a director idea. Not a screenplay, not a cast list, not a face prompt, not LTX.",
  "Cast look = appearance for the still generator (species, build, age, face, clothes, colours). Not dialogue. Not LTX. Not a series turnaround sheet — that draws doubles.",
  "Place = a place you could point at. Not a story. Not a camera move.",
  "Image prompt / More = still reroll. Keep the existing look; add the tweak. Never replace the look with the vibe line. Never a character-plate turnaround sheet.",
  "Spoken line = voice engine only. ElevenLabs tags in square brackets are allowed: [grunts] [smugly] [laughs]. No stage directions, no NAME prefix, no LTX, no plate staging.",
  "Plate staging = who sits, leans, walks, presents, uses THIS room's furniture, matching light. Willing bodies. Never a lineup of faces in the foreground. Never pinning or holding someone down. Not LTX. Not the spoken line.",
  "Shot action = what we see. Bodies, the place, the held prop. Not spoken dialogue. Not a camera list.",
  "Episode = this show's paste layout only (Skidmarks = nine-act construction; Sunny Banks = 4-shot gag; Documentary = hook/witness/turn/sting; others = EPISODE / GAG / --- SHOT n ---). Place: must match a locked place, spelled exactly. Use only locked cast names. Plate: on every shot. Refine a draft — do not throw a working draft away unless it is an empty template. Never pour one show's spine onto another.",
  "LTX Image motion = ONE continuous paragraph. Cloud IA2V gets plate still + mp3 + this one string. No [VISUAL]. No [SPEECH]. Do not write the locked lip-sync lead — it is prepended on send. The lead is: " +
    JSON.stringify(LTX_LIP_SYNC_LEAD),
  "Image motion shape: Use the provided start image as the first frame. NAME, look lock is prominent, empty hands unless Position already named a held prop, mouth and head move naturally while speaking. Props and background stay exactly as the start image, nothing new enters frame. NAME says: \"the spoken line\". Camera holds. Same person and objects as the start image.",
  "Held props work only when the current box or Position already names the object the same way pies and tennis rackets already work: phone, pie, racket. Affirmative only. Naming a thing puts it in the picture. Do not invent a mug, cooler, bottle, or extra object.",
  "Default empty hands, no phone, no invented props. A held prop only if the current box already names it. Spoken-line and cast-look boxes do not write a held prop unless the director already did. Do not name anyone who is not in this job.",
  "Do not invent people or places. Spell locked names exactly. English and Australian comic taste. Never American sitcom warmth.",
].join("\n");

function house(styleId: ShowStyleId): string {
  const p = getShowStylePreset(styleId);
  const look =
    styleId === "sunny_banks"
      ? "Sunny Banks is rubbery adult cel cartoon — thick outlines, flat colour. Never stylised 3D. Never photoreal."
      : styleId === "skidmarks"
        ? "Skidmarks is stylised 3D feature — not a cartoon, not a photograph."
        : `Stay inside the "${p.label}" look: ${p.tagline}.`;
  return [
    `You write short production text for "${p.label}".`,
    look,
    "Positive phrasing only in visual boxes.",
    ASSIST_CRITERIA_LOCK,
  ].join("\n");
}

const FIELD: Record<AssistKind, string> = {
  vibe: `WRITE: the vibe — one to three short sentences a director would type.
- Sharpen what they already wrote. If the box is empty, invent a tight idea in this show's voice.
- Do not write a screenplay, cast list, or shot list.
- Keep it under 60 words.`,

  cast_look: `WRITE: how this character looks — one or two sentences for an image generator.
- Species, build, age, face, clothes, colours. Then who they are, if there is room.
- Appearance first. No dialogue. No camera words. No phone-texting action unless it is already in the box.`,

  location: `WRITE: the place name and what it looks like — one short line a director would type.
- A place you could point at. Not a story. Not a camera move.`,

  image_prompt: `WRITE: a visual prompt to reroll this still.
- Describe what IS in the picture. Same person or place they already named.
- Keep the existing look; add the tweak. Never replace the look with the vibe.
- No movement, no dialogue, no lighting-gear words. No turnaround sheet.`,

  line: `WRITE: the spoken line only.
- Words the voice engine will read. ElevenLabs tags in square brackets are allowed: [grunts] [smugly] [laughs].
- Stay in character. No stage directions, no character name prefix, no phone action, no LTX.`,

  episode: `WRITE: the whole episode document — story, shots, and beats.
- Output ONLY the episode. No markdown. No commentary.
- Use this show's layout (see the style rules). Do not pour a 4-shot gag onto Skidmarks or a 9-act spine onto Sunny Banks.
- Use ONLY the locked cast names. Do not invent people.
- Every Place: must be one of the locked places, spelled exactly.
- Held props only if the draft already names them. Default empty hands, no phone.
- If the box already has a draft, refine it. Do not throw the whole thing away unless it is an empty template.
- No [VISUAL]. No [SPEECH]. No lip-sync lead.`,

  plate: `WRITE: how people sit in this still — one or two sentences for the plate compositor.
- Who is where. Sitting, leaning, lying on the bed, against the wall, using the furniture of THIS place.
- Name the locked people and the place. Matching light.
- Everyone is into it. Hands on hips, climbing on, looking back grinning.
- Never a lineup of faces standing in the foreground like cutouts.
- Never pinning, holding someone down, or forced sex.
- Empty hands, no phone, no invented props unless the current text already names a held object.
- Not LTX. Not the spoken line.`,

  shot: `WRITE: what we see in this shot — the action paragraph a director would type.
- Bodies, the place, what happens, the held prop. Not spoken dialogue. Not a camera list.
- Keep the locked people and the place. Willing energy.
- Never pinning, holding someone down, or forced sex.
- Empty hands, no phone, no invented props unless the current text already names a held object.`,

  image_motion: `WRITE: IMAGE MOTION body — the one LTX Cloud prompt.
- One continuous paragraph. No [VISUAL]. No [SPEECH].
- Do not write the locked lip-sync lead. It is prepended on send.
- Shape: Use the provided start image as the first frame. NAME, look lock is prominent, empty hands unless the current text already named a held prop, mouth and head move naturally while speaking. Props and background stay exactly as the start image, nothing new enters frame. NAME says: "the spoken line". Camera holds. Same person and objects as the start image.
- Held prop only if the current text already names it (phone, pie, racket). Do not invent a mug, cooler, or extra object.
- Default empty hands, no phone. A held prop only if the current text already names it.
- If the box already has a custom experiment, refine it. Do not throw it away.
- Affirmative only.`,
};

const REPLY_ONE_BOX =
  "Reply with the contents of the one box. No preamble, no headings, no markdown, no quote marks around the whole reply.";

export function assistSystem(styleId: ShowStyleId, kind: AssistKind): string {
  const field =
    kind === "episode" ? styleEpisodeAssistRules(styleId) : FIELD[kind];
  return `${house(styleId)}\n\n${field}\n\n${REPLY_ONE_BOX}`;
}

export function assistMaxTokens(kind: AssistKind): number {
  if (kind === "episode") return 4000;
  if (kind === "image_motion") return 700;
  if (kind === "shot") return 400;
  if (kind === "vibe") return 220;
  return 180;
}

/** Hint for the plate position box — character looks + the locked place,
 * so AI can put Jo on the bed in her cell instead of inventing a bar. */
export function platePositionAssistHint(opts: {
  people: string[];
  placeName: string;
  placeLook: string;
  looks: { name: string; look: string }[];
}): string {
  const who = opts.people.length ? opts.people.join(", ") : "(nobody in yet)";
  const lines = [
    `People in this still: ${who}`,
    `Place: ${opts.placeName.trim() || "(unnamed)"}`,
  ];
  if (opts.placeLook.trim()) lines.push(`Place look: ${opts.placeLook.trim()}`);
  for (const row of opts.looks) {
    if (row.look.trim()) lines.push(`Look · ${row.name}: ${row.look.trim()}`);
  }
  lines.push(
    "Write how they use THIS room — sit on the bed, lie down, lean on the wall, bang a head against it, stand in the doorway. Willing bodies. Not a lineup.",
  );
  if (opts.people.some((n) => isJoKeyboardWarrior(n))) {
    lines.push(
      "Default empty hands, no phone, no invented props — same as everyone. Jo phone / keyboard warrior only if this box already names her phone.",
    );
  }
  return lines.join("\n");
}

export function imageMotionAssistHint(opts: {
  speaker: string;
  line: string;
  lookLock: string;
  shotSpeakers: string[];
}): string {
  const lines = [
    `Speaker: ${opts.speaker.trim() || "(unnamed)"}`,
    `Spoken line: ${opts.line.trim() || "(none — hold)"}`,
  ];
  if (opts.lookLock.trim()) lines.push(`Look lock: ${opts.lookLock.trim()}`);
  const others = opts.shotSpeakers
    .map((s) => s.trim())
    .filter(
      (s) => s && s.toLowerCase() !== opts.speaker.trim().toLowerCase(),
    );
  if (others.length) {
    lines.push(`Also in this shot: ${others.join(", ")}`);
  }
  lines.push("Write the Image motion body only. Do not write the lip-sync lead.");
  return lines.join("\n");
}

export function assistUser(opts: {
  kind: AssistKind;
  text: string;
  hint?: string;
}): string {
  const bits = [`Box: ${opts.kind}`];
  if (opts.hint?.trim()) bits.push(`About: ${opts.hint.trim()}`);
  bits.push(opts.text.trim() ? `Current text:\n${opts.text.trim()}` : "Current text: (empty — invent a first take)");
  bits.push("Pressing AI again should give a different take. Write the box now.");
  return bits.join("\n");
}

export function cleanAssistText(raw: string): string {
  return raw
    .replace(/^```[\w]*\n?|\n?```$/g, "")
    .replace(/^["“]|["”]$/g, "")
    .trim();
}
