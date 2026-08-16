import { getShowStylePreset, type ShowStyleId } from "./showStylePresets";
import { ASSIST_CONSENT_LOCK } from "./mobileAssistConsent";

export const ASSIST_KINDS = [
  "vibe",
  "cast_look",
  "location",
  "image_prompt",
  "line",
  "episode",
  "plate",
] as const;

export type AssistKind = (typeof ASSIST_KINDS)[number];

export function isAssistKind(v: string): v is AssistKind {
  return (ASSIST_KINDS as readonly string[]).includes(v);
}

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
    "English and Australian comic taste. Never American sitcom warmth.",
    "Positive phrasing only in visual boxes. Naming a thing puts it in the picture.",
    ASSIST_CONSENT_LOCK,
    "Reply with the contents of the one box. No preamble, no headings, no markdown, no quote marks around the whole reply.",
  ].join("\n");
}

const FIELD: Record<AssistKind, string> = {
  vibe: `WRITE: the vibe — one to three short sentences a director would type.
- Sharpen what they already wrote. If the box is empty, invent a tight idea in this show's voice.
- Do not write a screenplay, cast list, or shot list.
- Keep it under 60 words.`,

  cast_look: `WRITE: how this character looks — one or two sentences for an image generator.
- Species, build, age, face, clothes, colours. Then who they are, if there is room.
- Appearance first. No dialogue. No camera words.`,

  location: `WRITE: the place name and what it looks like — one short line a director would type.
- A place you could point at. Not a story. Not a camera move.`,

  image_prompt: `WRITE: a visual prompt to reroll this still.
- Describe what IS in the picture. Same person or place they already named.
- No movement, no dialogue, no lighting-gear words.`,

  line: `WRITE: the spoken line only.
- Words the voice engine will read. ElevenLabs tags in square brackets are allowed: [grunts] [smugly] [laughs].
- Stay in character. No stage directions, no character name prefix.`,

  episode: `WRITE: the whole episode document — story, shots, and beats.
- Output ONLY the episode in this exact layout. No markdown. No commentary.
- First lines: EPISODE: title  then  GAG: one sentence
- Then one or more blocks:
--- SHOT 1 ---
Place: (must match a locked place, spelled exactly)
Title: (shot title)
Action: (what we see)
NAME
Spoken line.
NAME
Spoken line.
- Use a blank line before each --- SHOT ---.
- Character cues are ALL CAPS on their own line, then the spoken line.
- You may add more shots at the same Place. This is a full episode, not a 4-shot gag.
- Use ONLY the locked cast names. Do not invent people.
- Every Place: must be one of the locked places, spelled exactly.
- Include a Plate: line on every shot — who sits, leans, walks, presents, uses the furniture. Willing bodies. Never a lineup in the foreground. Never pinning or holding someone down.
- If the box already has a draft, refine it — keep what works, fix what is weak. Do not throw the whole thing away unless it is an empty template.
- ElevenLabs tags in square brackets are allowed on lines: [grunts] [smugly].`,

  plate: `WRITE: how people sit in this still — one or two sentences for the plate compositor.
- Who is where. Sitting, leaning, walking through, presenting, using the bar or furniture.
- Name the locked people and the place. Matching light.
- Everyone is into it. Hands on hips, climbing on, looking back grinning.
- Never a lineup of faces standing in the foreground like cutouts.
- Never pinning, holding someone down, or forced sex.`,
};

export function assistSystem(styleId: ShowStyleId, kind: AssistKind): string {
  return `${house(styleId)}\n\n${FIELD[kind]}`;
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
