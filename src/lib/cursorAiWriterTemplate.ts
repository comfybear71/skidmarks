import type { ShowStyleId } from "./showStylePresets";
import { getShowStylePreset } from "./showStylePresets";
import { skidmarksTemplateFromRoster } from "./scriptBlueprint";

export type AiWriterLiveData = {
  cast: { name: string; brief: string }[];
  places: string[];
};

/** Filled example — paste into PROMPT to test (Sunny Banks). */
export const CURSOR_PROMPT_EXAMPLE_SCRIPT = `EPISODE: Laundry meltdown
GAG: Nuggets shrinks everything. Dazza brought the wrong coins. Bazza cites the wash cycle code.

--- SHOT 1 ---
Title: Wide — washer explosion
Place: Site laundry
Cast: Nuggets, Shazza, Dazza
Plate: Wide shot. Coin laundry. Steam burst. Tiny clothes flying. Nuggets panicking. Shazza furious. Dazza holding wrong coins.
Nuggets: Skree-boop! Everything tiny!
Shazza: That's my good top, you idiot.
Dazza: Wrong coins. Reckon it'll stretch back.
SFX: Coin washer spin cycle | Steam hiss burst

--- SHOT 2 ---
Title: Bazza cites the code
Place: Demountable site office
Cast: Nuggets, Ranger Bazza, Dazza
Plate: Ranger Bazza with clipboard. Nuggets gesturing at shrunken singlet. Dazza defensive.
Nuggets: Wah-doo nee-yah skrit!
Ranger Bazza: He says you violated section twelve: hot wash without a permit.
Dazza: It's just socks.
SFX: Ute on gravel | Clipboard slap

--- SHOT 3 ---
Title: Insane fix — hair dryer army
Place: Back shed
Cast: Dazza, Nuggets, Ranger Bazza
Plate: Dazza aiming three hair dryers at doll-sized clothes. Nuggets horrified. Ranger Bazza writing a ticket.
Dazza: I'll blast them back to size.
Nuggets: Boop-wah skree nah!
Ranger Bazza: He says that's a fire hazard.
SFX: Hair dryer high whine | Fabric singe puff

--- SHOT 4 ---
Title: Nan button
Place: Fibro caravan interior
Cast: Nan
Plate: Medium close. Nan with teacup, completely unbothered. Shrunken laundry visible through window.
Nan: Buy new clothes, love. They're twenty bucks at Big W.
SFX: Cricket bat tap | Tea sip
`;

/** Filled example — Skidmarks pub gag (Dirty Dog, Darryl, Kim). */
export const CURSOR_PROMPT_EXAMPLE_SCRIPT_SKIDMARKS = `EPISODE: The Mansplain Method
GAG: Darryl reeks up the bar. Kim and Chloe bait him. He still thinks he is winning.

--- SHOT 1 ---
Title: Wide — Darryl arrives
Place: Dirty Dog Pub
Cast: CrackWhore Darryl, Sarah, Chloe
Plate: Wide bar shot. Sticky dark carpet. Wet cast iron stools. CrackWhore Darryl in stained singlet slamming onto stool next to Sarah. Sarah recoiling with astrophysics textbook. Chloe behind bar wincing with glass and cloth.
CrackWhore Darryl: [grunts] Move over princess, Crack whore got to sit.
Sarah: You smell like a dead badger.
Chloe: Don't breathe on the optics.
SFX: Pub door thud | Stool scrape iron

--- SHOT 2 ---
Title: Darryl mansplains the stars
Place: Dirty Dog Pub
Cast: CrackWhore Darryl, Sarah, Chloe
Plate: Medium shot. Darryl gesturing at Sarah's textbook with greasy finger. Sarah pinching nose. Chloe turning away from the bar.
CrackWhore Darryl: Astrophysics! Classic. You don't need stars, darlin', you need a bloke like me.
Sarah: That is not how orbital mechanics works.
Chloe: Nobody asked you, Daryl.
SFX: Glass clink | Textbook slap shut

--- SHOT 3 ---
Title: The girls exchange a look
Place: Dirty Dog Pub
Cast: Chloe, Sarah, CrackWhore Darryl
Plate: Two-shot on Chloe and Sarah. Quick sideways glance. Faintest shared smirk. Darryl oblivious facing the bar.
Chloe: Hey Sarah. I got a plan to fuck over Crackwhore Darryl.
Sarah: Struth, sounds exciting. What is it?
CrackWhore Darryl: [sniffs] Smell that? Pure masculinity, bitches.
SFX: Low pub murmur | Chair creak

--- SHOT 4 ---
Title: Kim shuts him down
Place: Dirty Dog Pub
Cast: Kim the Gypsy KUNT, CrackWhore Darryl, Chloe
Plate: Medium close. Kim the Gypsy KUNT with upper lip curled. Darryl mid-grin frozen. Chloe deadpan behind the bar.
Kim the Gypsy KUNT: You are a revolting little man and everyone in this room knows it.
CrackWhore Darryl: [laughs] Don't pretend you don't love it.
Chloe: We don't. Fuck off.
SFX: Bar sting sting | Pint glass down hard
`;

const GOOGLE_INSTRUCTION = `YOUR TASK FOR GOOGLE AI
Write ONE new episode for this show.

Reply with ONLY the script block — nothing else.
One label per line. Match the example layout exactly.
No folder trees. No Resolve steps. No markdown headings. No bullet lists.`;

const FORMATTING_LOCK = `FORMATTING — HARD RULE (Studio will reject glued-together lines)
Copy this layout EXACTLY. One label per line. Blank line before each --- SHOT ---.

EPISODE: (title on this line only)
GAG: (one sentence on this line only)

--- SHOT 1 ---
Title: (this line only)
Place: (this line only)
Cast: (names comma-separated — this line only)
Plate: (one paragraph — this line only)
Speaker: (dialogue line 1)
Speaker: (dialogue line 2)
Speaker: (dialogue line 3)
SFX: label one | label two

(blank line)

--- SHOT 2 ---
(same seven field types + blank line)

--- SHOT 3 ---
(same)

--- SHOT 4 ---
(same)

NEVER DO THIS (Google breaks Studio):
EPISODE: TitleGAG: premise--- SHOT 1 ---Title: xPlace: y
All on one line = broken. Every field gets its own line + Enter.`;

function formatCastList(live?: AiWriterLiveData, fallback?: string[]): string {
  if (live?.cast.length) {
    return live.cast
      .map((c) =>
        c.brief
          ? `- ${c.name} — ${c.brief.slice(0, 100)}`
          : `- ${c.name}`,
      )
      .join("\n");
  }
  if (fallback?.length) return fallback.map((n) => `- ${n}`).join("\n");
  return "- (add faces in Characters — template updates on Copy for AI)";
}

function formatPlaceList(live?: AiWriterLiveData, fallback?: string[]): string {
  const names =
    live?.places.length ? live.places : fallback?.length ? fallback : [];
  if (!names.length) {
    return "- (add places in World cards — template updates on Copy for AI)";
  }
  return names.map((n) => `- ${n}`).join("\n");
}

export const CURSOR_PROMPT_EXAMPLE_SCRIPT_DOC = `EPISODE: The file that walked
GAG: A witness remembers the folder. The folder remembers him.

--- SHOT 1 ---
Title: Hook
Place: Interview room
Cast: Presenter
Plate: Medium close-up. Interview room. Soft window light. Presenter facing camera, empty hands. Only Presenter in frame.
Presenter: We were told the tape never left the building.

--- SHOT 2 ---
Title: Witness
Place: Interview room
Cast: Presenter
Plate: Same chair. Same window. Mouth clear. No lineup.
Presenter: Then a cleaner found it on the bus.

--- SHOT 3 ---
Title: Turn
Place: Interview room
Cast: Presenter
Plate: Lean in. Same room. Hands still empty.
Presenter: The cleaner had been dead for a year.

--- SHOT 4 ---
Title: Sting
Place: Interview room
Cast: Presenter
Plate: Hold the MCU. Camera still.
Presenter: So who brought the tape home?
`;

export const CURSOR_PROMPT_EXAMPLE_SCRIPT_PHOTOREAL = `EPISODE: Kitchen light
GAG: Two people finish a conversation they started yesterday.

--- SHOT 1 ---
Title: Sit
Place: Location
Cast: Cast
Plate: Medium close-up. Natural kitchen light. Cast sitting, weight grounded, empty hands. Only Cast in frame.
Cast: You left the tap running again.

--- SHOT 2 ---
Title: Answer
Place: Location
Cast: Cast
Plate: Same chair. Same window. Photoreal skin and cloth. No cartoon.
Cast: I was listening to the pipes.
`;

export const CURSOR_PROMPT_EXAMPLE_SCRIPT_MUSIC_VIDEO = `EPISODE: SKIDS_MUSIC_TV
GAG: Artist — Song. Performance cuts. No crowd.

--- SHOT 1 ---
Title: Artist
Place: Performance set
Cast: Artist
Plate: Medium close-up. Artist performing at Performance set. Empty hands unless a mic is the lock. No crowd. No cel.
Artist: (no spoken line — the mp3 is the track)
`;

export function cursorPromptExampleForStyle(styleId: ShowStyleId): string {
  if (styleId === "skidmarks") return CURSOR_PROMPT_EXAMPLE_SCRIPT_SKIDMARKS;
  if (styleId === "sunny_banks") return CURSOR_PROMPT_EXAMPLE_SCRIPT;
  if (styleId === "doc") return CURSOR_PROMPT_EXAMPLE_SCRIPT_DOC;
  if (styleId === "photoreal") return CURSOR_PROMPT_EXAMPLE_SCRIPT_PHOTOREAL;
  if (styleId === "music_video") return CURSOR_PROMPT_EXAMPLE_SCRIPT_MUSIC_VIDEO;
  return CURSOR_PROMPT_EXAMPLE_SCRIPT_PHOTOREAL;
}

function outputFormat(styleId: ShowStyleId): string {
  const shot4Note =
    styleId === "sunny_banks"
      ? "Shot 4: Cast Nan only — ONE dialogue line (the button)."
      : styleId === "skidmarks"
        ? "Shot 4: punch / humiliation — three dialogue lines."
        : "Shot 4: final sting.";

  return `${FORMATTING_LOCK}

${shot4Note}

Intro and outro are automatic — do NOT write them.

COPY THIS EXAMPLE SHAPE (line breaks matter):
${cursorPromptExampleForStyle(styleId)}`;
}

function sunnyBrief(live?: AiWriterLiveData): string {
  const castBlock = formatCastList(live);
  const placeBlock = formatPlaceList(live);
  const hasNan = live?.cast.some((c) => c.name === "Nan") ?? true;

  return `SUNNY BANKS — AI episode writer brief
${GOOGLE_INSTRUCTION}

Give this whole document to Google AI / ChatGPT. Paste its reply into Studio → PROMPT → Go.

WHAT THIS SHOW IS
Rubbery adult cel cartoon at a caravan park. Same cast every gag.
Shape: stupid problem → Bazza translates Nuggets → Dazza's insane fix → ${hasNan ? "Nan one line" : "final sting"} → credits.

LOCKED CAST (spell exactly — from Studio Characters gallery)
${castBlock}

FORBIDDEN
- Do not write "Stuie" or the filmmaker as a character
- Do not invent American cartoon tone
- Do not write folder paths, shot_a1, line_1.mp3, or Resolve instructions
- Do not write intro/outro panels — Studio adds those
- Do not use negation prompts ("no demons") — positive description only

PLACES (Place: field must match one of these exactly — from World cards)
${placeBlock}

DIALOGUE RULES
- Shots 1–3: exactly THREE lines. Pattern: Nuggets weird line → human reaction → Dazza dumb confidence (or Bazza translates on shot 2/3)
${hasNan ? "- Shot 4: Nan ONLY. ONE line. That's the button." : "- Shot 4: one sharp punchline."}
- Nuggets lines are phonetic alien gibberish (Skree-boop, wah-doo, nee-yah…)

PLATE LINE (Plate: field)
Describe the still for image gen: wide/medium, who is where, props, mood.
Sunny Banks look: rubbery adult cartoon, thick black outlines, flat cel colour, sun-bleached Aussie palette, dusty ochre, faded teal, heat haze.
Not photoreal. Not soft Pixar.

SFX LINE
Two items separated by | — labels only (Studio generates the mp3). SFX go in Resolve, not in the video prompt.

FOLDER NUMBER
Studio picks the next number automatically (05 after 04 on disk). AI only writes EPISODE: title — not the folder name.

${outputFormat("sunny_banks")}`;
}

function skidBrief(live?: AiWriterLiveData): string {
  const castBlock = formatCastList(live);
  const placeBlock = formatPlaceList(live);

  return `SKIDMARKS — AI episode writer brief
${GOOGLE_INSTRUCTION}

Give this whole document to Google AI / ChatGPT. Paste the filled MASTER EPISODE CONSTRUCTION TEMPLATE back and Lock. Do not paste it into a live Act box to overwrite a pack.

WHAT THIS SHOW IS
Stylised 3D nasty English / Australian comedy. Every episode walks the same nine-stage plan. Only the prick and the place change.
Not cartoon. Not photoreal. Not a four-shot gag reel.

LOCKED CAST (spell exactly — from Studio Characters gallery)
${castBlock}

PLACES (use these names)
${placeBlock}

FORBIDDEN
- Do not add, skip, or reorder the nine stages
- No folder trees, no line_1.mp3, no Resolve steps in your reply
- No American cartoon tone
- Positive plate prompts only

${skidmarksTemplateFromRoster(live)}`;
}

function docBrief(live?: AiWriterLiveData): string {
  const castBlock = formatCastList(live, [
    "True crime investigator",
    "Ancient historian",
  ]);
  const placeBlock = formatPlaceList(live, [
    "Parliament committee room",
    "Interview room",
    "Archive basement",
  ]);

  return `DOCUMENTARY — AI episode writer brief
${GOOGLE_INSTRUCTION}

Give this whole document to Google AI / ChatGPT. Paste its reply into Studio → PROMPT → Go.
Talking-head true-crime parody. Hook → witness → turn → sting.

CAST (from Studio Characters gallery)
${castBlock}

PLACES (from World cards)
${placeBlock}

${outputFormat("doc")}`;
}

function genericBrief(styleId: ShowStyleId, live?: AiWriterLiveData): string {
  const preset = getShowStylePreset(styleId);
  const castBlock =
    formatCastList(live) ||
    preset.presetCast.map((c) => `- ${c.name}`).join("\n");
  const placeBlock =
    formatPlaceList(live) ||
    preset.presetPlaces.map((p) => `- ${p.name}`).join("\n");

  return `${preset.label.toUpperCase()} — AI episode writer brief
${GOOGLE_INSTRUCTION}

Give this whole document to Google AI / ChatGPT. Paste its reply into Studio → PROMPT → Go.
${preset.tagline}

CAST (from Studio Characters gallery)
${castBlock}

PLACES (from World cards)
${placeBlock}

${outputFormat(styleId)}`;
}

/** AI writer brief — pass live roster from server for up-to-date cast/places. */
export function buildAiWriterBrief(
  styleId: ShowStyleId,
  live?: AiWriterLiveData,
): string {
  switch (styleId) {
    case "sunny_banks":
      return sunnyBrief(live);
    case "skidmarks":
      return skidBrief(live);
    case "doc":
      return docBrief(live);
    case "photoreal":
      return genericBrief(styleId, live);
    case "music_video":
      return genericBrief(styleId, live);
    default:
      return genericBrief(styleId, live);
  }
}

/** @deprecated use CURSOR_PROMPT_EXAMPLE_SCRIPT */
export const CURSOR_PROMPT_SCRIPT_TEMPLATE = CURSOR_PROMPT_EXAMPLE_SCRIPT;
