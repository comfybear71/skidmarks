import type {
  Character,
  Episode,
  EpisodeCastMember,
  Location,
  Room,
  Scene,
  Shot,
  ShotBeat,
} from "./types";

export type DraftField =
  | "platePrompt"
  | "imageMotion"
  | "textSegment"
  | "actionSegment";

export const DRAFT_FIELDS: DraftField[] = [
  "platePrompt",
  "imageMotion",
  "textSegment",
  "actionSegment",
];

export const HOUSE = `You write production text for SKIDMARKS, a stylised 3D animated comedy series.

SHOW VOICE
- Comic taste is strictly English and Australian: Monty Python, Viz, Blackadder, Fawlty Towers, Alan Partridge, The Office UK, Peep Show, League of Gentlemen, Bottom, The Thick of It; Barry Humphries and Les Patterson, Kath & Kim, Frontline, Housos, The Castle, Norman Gunston.
- Never use American comedy for tone, joke shape or character. No sitcom warmth, no quippy back-and-forth, no punchline signposting.
- Blunt, dark, grotty, deadpan. Australian characters speak Australian.

HARD RULES
- Positive phrasing only. Never write "no ..." or "not ...". Naming a thing puts it in the picture, so describe what IS there.
- Never mention sound effects, music, sound design, camera gear or render style. Those are added elsewhere.
- Name every person every time. Never "the girl on the left", never "the woman".
- Lock props: describe a prop with exactly the same words the other beats use.
- Reply with the contents of the one box asked for. No preamble, no explanation, no headings, no markdown, no wrapping quote marks.`;

const FIELD_RULES: Record<DraftField, string> = {
  platePrompt: `WRITE: PLATE PROMPT — a single still photograph. This is frame one of the shot.

- Comfy only adds movement to this picture. Anything you want on screen must be in it: a stool, a book, a pint, someone behind the bar.
- Describe the moment BEFORE the action, not the middle of it. Poised over the stool, not mid-drop.
- Open with the camera: how wide, and its height. Then each person by name.
- Give every person a position you could point at: which stool, which side of the bar counter, left or right of frame, what their hands hold.
- Write expressions as face muscles — nose wrinkled, top lip curled off the teeth, eyebrows pulled down, eyes narrowed to slits, chin tucked. Never feeling words like "disgusted", "angry" or "sad": the model ignores those and copies the smile off the face reference instead.
- Anyone about to speak has their mouth closed.
- To put somebody behind a bar, say the counter crosses in front of their waist and hides their lower body.
- No movement verbs, no dialogue, no lighting or style words.
- One paragraph, 60 to 110 words.`,

  imageMotion: `WRITE: IMAGE1 — exactly two lines, in this shape:

[VISUAL]: <small movements only>
[SPEECH]: <Speaker name> says: "<the exact spoken line>"

- [VISUAL] is movement of what is ALREADY in the plate: head, mouth, hands, lean, weight, a prop turning. Never introduce a new object, a new person or a change of position.
- Do not describe the room again. The picture already has it.
- [SPEECH] repeats the spoken line word for word, including any square-bracket tags.
- If this beat has no spoken line, write "[SPEECH]:" and nothing after it.
- Two lines, nothing else.`,

  textSegment: `WRITE: TEXT — the spoken words only. This goes straight to the voice engine and is read aloud exactly as written.

- Spoken words and nothing else. No stage directions, no character name, no "he says", no camera or lighting.
- ElevenLabs v3 tags in square brackets are allowed for delivery: [grunts] [smugly] [sniffs] [laughs] [whispers] [shouts] [nervously].
- Roughly 3 words per second of screen time.
- In character, in their own idiom, and it must play as comedy in the English/Australian tradition.`,

  actionSegment: `WRITE: SEGMENT TEXT — the body action that plays after the line. There is no new plate for this, so the picture must stay put.

- Bodies only: leaning, turning, hands, shoulders, weight, a prop being gripped or wiped.
- Name every person again and repeat every prop with the same words used in the plate, so nothing changes shape.
- No dialogue, no new objects, no camera moves.
- 40 to 70 words.`,
};

const GLOBAL_RULE = `WRITE: GLOBAL — one instruction that repeats for the lip-sync on every beat in this shot's Comfy queue. This is not per-beat; it applies to the whole shot at once.

- Always start with exactly this sentence, word for word: "perfect lip sync, clear lip movement, citing the dialogue clearly, facial expressions and hand gestures are lively, dication is perfect."
- Only add a second sentence if the shot's action gives everyone on screen ONE held reaction that should stay through the whole scene — a smell, a wince, a held laugh. If so, add exactly one short sentence in the shape: "Whoever is on screen holds <the reaction, written as face muscles, never a feeling word like 'disgusted'> the whole scene."
- If there's no shared held reaction running through the whole shot, stop after the first sentence.
- Never mention render style, camera, lighting, props or staging — those belong in the plate, not here.
- No dialogue, no character names.`;

export function draftGlobalSystem(): string {
  return `${HOUSE}\n\n${GLOBAL_RULE}`;
}

export type DraftGlobalContext = {
  episode: Episode;
  scene: Scene;
  shot: Shot;
  nudge: string;
};

export function draftGlobalUser(ctx: DraftGlobalContext): string {
  const { shot } = ctx;

  const beats = (shot.beats || [])
    .map((b, i) => {
      const spoken = tidy(b.textSegment) || "(silent)";
      return `beat ${i + 1}: ${b.label || `Beat ${i + 1}`} · speaker ${b.speaker || "(none)"} · says: ${spoken}`;
    })
    .join("\n");

  return [
    `EPISODE: ${ctx.episode.title}`,
    `SCENE: ${ctx.scene.title}`,
    `SHOT ${shot.code}: ${shot.title}`,
    shot.script ? `What happens: ${shot.script}` : "",
    `Shot kind: ${shot.kind}`,
    "",
    "BEATS IN THIS QUEUE:",
    beats || "(no beats yet)",
    shot.global ? `\nGLOBAL now: ${tidy(shot.global)}` : "",
    ctx.nudge ? `\nSTUIE ASKS FOR: ${ctx.nudge}` : "",
    "",
    "Now write GLOBAL for this shot's whole queue.",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

/** Same tidy-up as a beat draft — strip fences, a leading label, wrap quotes. */
export function cleanGlobalDraft(raw: string): string {
  let out = raw.trim();
  out = out.replace(/^```[a-z]*\s*/i, "").replace(/```$/, "").trim();
  out = out.replace(/^GLOBAL\s*[:\-—]\s*/i, "");
  const wrapped = /^"([\s\S]*)"$/.exec(out);
  if (wrapped && !wrapped[1].includes('"')) out = wrapped[1];
  return out.trim();
}

function tidy(s: string | undefined): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

function lookLineFor(
  name: string,
  castNote: string,
  lab: Character[],
): string {
  const key = tidy(name).toLowerCase();
  const locked = tidy(
    lab.find((c) => tidy(c.name).toLowerCase() === key)?.lookNote || "",
  );
  const note = tidy(castNote);
  if (locked && note) return `${locked}. This episode: ${note}`;
  return locked || note || "(no look line written yet)";
}

export type DraftContext = {
  episode: Episode;
  scene: Scene;
  shot: Shot;
  beat: ShotBeat;
  beatIndex: number;
  beatCount: number;
  location: Location | null;
  room: Room | null;
  victim: Character | null;
  lab: Character[];
  cast: EpisodeCastMember[];
  field: DraftField;
  nudge: string;
};

export function draftSystem(field: DraftField): string {
  return `${HOUSE}\n\n${FIELD_RULES[field]}`;
}

export function draftUser(ctx: DraftContext): string {
  const { shot, beat, beatIndex, beatCount } = ctx;

  const people: string[] = [];
  if (ctx.victim) {
    people.push(
      `- ${ctx.victim.name}: ${lookLineFor(ctx.victim.name, "", ctx.lab)}`,
    );
  }
  for (const c of ctx.cast) {
    people.push(`- ${c.name}: ${lookLineFor(c.name, c.roleNote, ctx.lab)}`);
  }

  const place = [
    ctx.location?.name,
    ctx.room?.name,
    tidy(ctx.location?.lookNote),
    tidy(ctx.room?.lookNote),
  ]
    .filter(Boolean)
    .join(". ");

  const siblings = (shot.beats || [])
    .map((b, i) => {
      const mark = i === beatIndex ? ">> THIS BEAT" : `beat ${i + 1}`;
      const spoken = tidy(b.textSegment) || "(silent)";
      return `${mark}: ${b.label || `Beat ${i + 1}`} · speaker ${b.speaker || "(none)"} · says: ${spoken}`;
    })
    .join("\n");

  const thisBeat = [
    `Label: ${beat.label || `Beat ${beatIndex + 1}`}`,
    `Speaker: ${beat.speaker || "(nobody — silent beat)"}`,
    `Beat ${beatIndex + 1} of ${beatCount}`,
    `Seconds on screen: image ${beat.imageSeconds ?? 4}, line ${beat.textSeconds ?? 6}, action ${beat.actionSeconds ?? 4}`,
    beat.platePrompt ? `PLATE PROMPT now: ${tidy(beat.platePrompt)}` : "",
    beat.imageMotion ? `IMAGE1 now: ${tidy(beat.imageMotion)}` : "",
    beat.textSegment ? `TEXT now: ${tidy(beat.textSegment)}` : "",
    beat.actionSegment ? `SEGMENT TEXT now: ${tidy(beat.actionSegment)}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return [
    `EPISODE: ${ctx.episode.title}`,
    ctx.episode.logline ? `Logline: ${ctx.episode.logline}` : "",
    `SCENE: ${ctx.scene.title}`,
    tidy(ctx.scene.notes) ? `Scene notes: ${tidy(ctx.scene.notes)}` : "",
    place ? `PLACE: ${place}` : "",
    "",
    `SHOT ${shot.code}: ${shot.title}`,
    shot.script ? `What happens: ${shot.script}` : "",
    `Shot kind: ${shot.kind}`,
    tidy(shot.resolveNotes) ? `Notes: ${tidy(shot.resolveNotes)}` : "",
    "",
    "WHO EXISTS (locked looks — do not contradict these):",
    people.join("\n") || "- (nobody on the cast list yet)",
    "",
    "BEATS IN THIS SHOT:",
    siblings,
    "",
    "THIS BEAT:",
    thisBeat,
    ctx.nudge ? `\nSTUIE ASKS FOR: ${ctx.nudge}` : "",
    "",
    `Now write the ${labelFor(ctx.field)} for THIS BEAT only.`,
  ]
    .filter((line) => line !== "")
    .join("\n");
}

export function labelFor(field: DraftField): string {
  if (field === "platePrompt") return "PLATE PROMPT";
  if (field === "imageMotion") return "IMAGE1 [VISUAL]/[SPEECH]";
  if (field === "textSegment") return "TEXT line";
  return "SEGMENT TEXT action";
}

/** Models like to wrap things in quotes or add a title — strip that. */
export function cleanDraft(field: DraftField, raw: string): string {
  let out = raw.trim();
  out = out.replace(/^```[a-z]*\s*/i, "").replace(/```$/, "").trim();
  out = out.replace(
    /^(PLATE PROMPT|TEXT|SEGMENT TEXT|IMAGE1|ACTION)\s*[:\-—]\s*/i,
    "",
  );
  if (field !== "imageMotion") {
    // A whole-answer wrapping quote, not a quote inside the line
    const wrapped = /^"([\s\S]*)"$/.exec(out);
    if (wrapped && !wrapped[1].includes('"')) out = wrapped[1];
  }
  return out.trim();
}
