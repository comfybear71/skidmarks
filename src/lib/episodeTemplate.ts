/**
 * The Skidmarks episode template — house rules + the locked story spine
 * + the construction script the outside AI must fill.
 *
 * Copy does not change a live pack. Only the prick and the places change.
 * Other shows get a different template — this file is Skidmarks only.
 */

import { STORY_SPINE_STAGES } from "./storySpine";

const ACT_ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX"] as const;

function actShotSlots(): string {
  return `## <SHOT_01>

* [BUDGET_TIER]:
* [CAST]:
* [VISUAL_ACTION]:
* [DIAL]:
* [SFX]:
* [MUSIC]:
* [CUTAWAY]:

## <SHOT_02>

* [BUDGET_TIER]:
* [CAST]:
* [VISUAL_ACTION]:
* [DIAL]:
* [SFX]:
* [MUSIC]:
* [CUTAWAY]:`;
}

function actBlock(n: number, title: string, note: string): string {
  const roman = ACT_ROMAN[n - 1] || String(n);
  return `## <ACT_${roman}>
* [ACT]: ${roman} — ${title}
* [ACT_NOTE]: ${note}
* [ENV]:
* [CAST]:
* [TIME_LIGHTING]:

${actShotSlots()}`;
}

const NINE_ACT_BLOCKS = STORY_SPINE_STAGES.map((stage) =>
  actBlock(stage.n, stage.title, stage.note),
).join("\n\n");

/** House rules. This is not the script. */
export const EPISODE_TEMPLATE_RULES = `You are writing a scene-by-scene breakdown for SKIDMARKS, a stylised 3D animated
comedy series. Follow every rule below exactly. Output only the breakdown — no
commentary, no preamble.

SHOW VOICE
- Comic taste is strictly English and Australian: Monty Python, Viz, Blackadder,
  Fawlty Towers, Alan Partridge, The Office UK, Peep Show, League of Gentlemen,
  Bottom, The Thick of It; Barry Humphries and Les Patterson, Kath & Kim,
  Frontline, Housos, The Castle, Norman Gunston.
- Never American comedy for tone, joke shape or character. No sitcom warmth,
  no quippy back-and-forth, no punchline signposting.
- Blunt, dark, grotty, deadpan. Australian characters speak Australian.
- Positive phrasing only — never "no ..." or "not ...". Describe what IS there.
- Name every person every time. Never "the girl on the left".
- Lock every prop's wording — reuse the exact same words for it every time it's mentioned.
- LINE can carry short bracket delivery tags for the voice, e.g. [dry] [laughs] [smugly]
  [sniffs] [gags] [boasting] [mock-sincere] [clears throat]. Use a different one each time
  — never the same tag twice in a row, it flattens the read.
- Nobody's dialogue gets compressed to fit a fixed time. Write LINE at whatever length it
  naturally runs — the mp3 gets measured after it's recorded, not before.

RENDER STYLE — every PLATE follows this, no exceptions.
- The show is a stylised 3D animated feature render. It is 50–70% photoreal — believable
  materials and lighting, but noticeably MADE, not photographed and not drawn.
- Every PLATE carries this line, word for word: "a stylised 3D animated feature render,
  clean simplified forms, believable materials and soft directional lighting, warm
  saturated colour, shallow depth of field, cinematic quality, sharp focus. Not
  photographic, not a cartoon."
- Caricature is anatomy, not drawing — "enormous round bulging eyes", never "cartoon eyes".
  Push it by exaggerating the body/face model itself, never by adding drawn lines, motion
  streaks, speed lines, or sweat-drop symbols.
- Name every material — cast iron, rusted steel, mown grass, wet bitumen. That's what
  sells it as real.
- State the light and sky explicitly in every PLATE — it carries the episode's tonal arc:
  bright and warm at the open, draining to overcast and grey through the middle, one
  burst of warm golden light at THE FAKE WIN, then straight to the darkest light of the
  episode the moment it's taken away, ending in night/hard institutional light at THE END.
- These words must NEVER appear in a PLATE: cartoon, comix, comic, ink outlines, black
  outlines, crosshatching, flat colour, hand-drawn, illustration, cel, speed lines, 2D,
  underground comix, R. Crumb. (Crumb/Viz/Ralph Steadman are attitude and grotesquery
  references only — never a rendering instruction.)

THE STORY SPINE — every Skidmarks episode follows this same path.
Only the prick and the place change. Do not add stages, skip stages, or reorder them.

1. HE SHOWS UP — intro.
2. GETS WORSE — established as an asshole (drawn from a real person/experience).
3. KEEPS PROVING HE'S A REAL BASTARD — a run of small cruelties/humiliations he causes.
4. GETS A BEAT DOWN — but only a partial one, roughly 3/4 of a full beating. He is not finished off here.
5. GETS A FAKE WIN — some unearned golden gift arrives out of nowhere (promotion, lotto, inheritance, money, a girl, a boy, etc).
6. BELIEVES IT — he sincerely believes he deserves this unearned fortune.
7. LOSES IT — whatever it was gets ripped away from him.
8. GETS SMASHED — a real ending: a beating, run over by a train, shot out of a cannon,
   kidnapped by terrorists, etc. Credits roll during this.
9. THE END STATE — he is either totally removed from existence, or worse — frozen on that
   final frame.

NARRATOR — one single line, different every episode, spoken by the narrator. Write it
for stage 9.

The block above is house rules, not the script.
Write the complete episode through all nine ACTS. Name each act with [ACT] exactly as printed in the blank.
Every person, spoken line, sound, and music bed is a [ ] tag. Those tags land on the talking timeline.
[CAST] who is in the picture — names from CAST_MAIN only.
[DIAL] who speaks and the line — that is the Saved audio.
[SFX] every sound in the shot (door shut, birds, glass). Leave blank only if the shot is silent.
[MUSIC] bed under the line, or blank.
[VISUAL_ACTION] on a CHEAP_TAKE is a sitting talking-head — face and upper chest, facing camera, empty hands. Do not write cartoon, LTX simulation, shaky cam, or a motion pass on a still.
[CUTAWAY] or blank.
Do not invent a sound without an [SFX] tag.
Copy the tag shape from the Skidmarks talking example.`;

/** Blank construction script. Pack cast and places get filled in. */
export const EPISODE_CONSTRUCTION_BLANK = `## MASTER EPISODE CONSTRUCTION TEMPLATE
## [EPISODE_METADATA]

* [EP_NUM]:
* [EP_TITLE]:
* [GENRE_STYLE]: PURE_3D
* [TARGET_RUN_TIME]:

------------------------------
## [CAST_AUDIT]
List every asset that must exist before parsing the script.

* [CAST_MAIN]:
* [CAST_BACKGROUND]:
* [ENV_SETS]:
* [PROP_LIST]:

------------------------------
## [EPISODE_TIMELINE]
Every act is locked. Do not rename, skip, or reorder. Add more <SHOT_0N> inside an act if that act needs them. CHEAP_TAKE = static talking-head. EXPENSIVE_TAKE = tracking / heavy motion.

${NINE_ACT_BLOCKS}

------------------------------
## [POST_COMP_INSTRUCTIONS]

* [COLOR_LUT]: [Unified color grade profile name]
* [GRAIN_OVERLAY]: [Film Grain / Cell texture / None]
* [MASTER_AUDIO_NOTE]:`;

/** Format example — Skidmarks talking stills. Copy the tags, not a new story. */
export const EPISODE_CONSTRUCTION_EXAMPLE = `FORMAT EXAMPLE — Skidmarks talking stills. Copy the tags. CHEAP_TAKE is a sitting talking-head.

## MASTER EPISODE CONSTRUCTION TEMPLATE
## [EPISODE_METADATA]

* [EP_NUM]: 01
* [EP_TITLE]: The Mansplain Method
* [GENRE_STYLE]: PURE_3D
* [TARGET_RUN_TIME]:

------------------------------
## [CAST_AUDIT]
* [CAST_MAIN]: CrackWhore Darryl, Sarah, Chloe
* [CAST_BACKGROUND]:
* [ENV_SETS]: Dirty Dog Pub
* [PROP_LIST]:

------------------------------
## [EPISODE_TIMELINE]
## <ACT_I>

* [ACT]: I — He shows up
* [ACT_NOTE]:
* [ENV]: Dirty Dog Pub
* [CAST]: CrackWhore Darryl, Sarah, Chloe
* [TIME_LIGHTING]:

## <SHOT_01>

* [BUDGET_TIER]: CHEAP_TAKE
* [CAST]: CrackWhore Darryl
* [VISUAL_ACTION]: CrackWhore Darryl sits at the bar, facing camera, mouth clear, empty hands.
* [DIAL]: CRACKWHORE DARRYL: "[grunts] Move over princess, Crack whore got to sit."
* [SFX]: Pub door thud
* [MUSIC]:
* [CUTAWAY]:

## <SHOT_02>

* [BUDGET_TIER]: CHEAP_TAKE
* [CAST]: Sarah
* [VISUAL_ACTION]: Sarah sits at the bar, facing camera, mouth clear, empty hands.
* [DIAL]: SARAH: "You smell like a dead badger."
* [SFX]: Glass clink
* [MUSIC]:
* [CUTAWAY]:

------------------------------
## [POST_COMP_INSTRUCTIONS]

* [COLOR_LUT]:
* [GRAIN_OVERLAY]:
* [MASTER_AUDIO_NOTE]:`;

export const EPISODE_TEMPLATE = `${EPISODE_TEMPLATE_RULES}

------------------------------

${EPISODE_CONSTRUCTION_BLANK}

------------------------------

${EPISODE_CONSTRUCTION_EXAMPLE}`;
