/**
 * The Skidmarks episode template — house rules + the locked story spine
 * + the construction script the outside AI must fill.
 *
 * Copy does not change a live pack. Only the prick and the places change.
 * Other shows get a different template — this file is Skidmarks only.
 */

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
- ⛔ These words must NEVER appear in a PLATE: cartoon, comix, comic, ink outlines, black
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
Write the complete episode through all nine stages.
Use the MASTER EPISODE CONSTRUCTION TEMPLATE below as the script.
The Little Red Riding Hood block is a format example only — not a Skidmarks episode.`;

/** Blank construction script. Pack cast and places get filled in. */
export const EPISODE_CONSTRUCTION_BLANK = `## MASTER EPISODE CONSTRUCTION TEMPLATE
## [EPISODE_METADATA]

* [EP_NUM]:
* [EP_TITLE]:
* [GENRE_STYLE]: [Choose: CARTOON | PURE_3D | PHOTOREAL_LTX | HYBRID]
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
## <SCENE_01>

* [ENV]: [Insert Location/Set Name]
* [TIME_LIGHTING]: [Insert Day/Night/Studio/Stylized Lighting]

## <SHOT_01>

* [BUDGET_TIER]: [CHEAP_TAKE | EXPENSIVE_TAKE]
(Note to AI: CHEAP_TAKE uses static cameras, talking-head framing, simple 3D viewport-to-LTX passes, or reused cycles. EXPENSIVE_TAKE flags dynamic tracking shots, heavy fluid/particle simulations, custom character interactions, or multi-angle LTX updates.)
* [VISUAL_ACTION]:
* [DIAL]: [CHARACTER_NAME]: "Dialogue line goes here."
* [SFX]:
* [MUSIC]: [Track Name / Mood / Intensity Level]
* [CUTAWAY]: [Insert targeted Cutaway reference if applicable, otherwise LEAVE BLANK]

## <SHOT_02>

* [BUDGET_TIER]:
* [VISUAL_ACTION]:
* [DIAL]:
* [SFX]:
* [MUSIC]:
* [CUTAWAY]:

## <SCENE_02>
(Repeat shot structures as needed. Walk all nine Skidmarks stages. Do not skip or reorder them.)

------------------------------
## [POST_COMP_INSTRUCTIONS]

* [COLOR_LUT]: [Unified color grade profile name]
* [GRAIN_OVERLAY]: [Film Grain / Cell texture / None]
* [MASTER_AUDIO_NOTE]:`;

/** Format example only — not a Skidmarks episode. */
export const EPISODE_CONSTRUCTION_EXAMPLE = `FORMAT EXAMPLE ONLY — Little Red Riding Hood. This is not a Skidmarks episode. Copy the shape, not the wolf story.

## MASTER EPISODE CONSTRUCTION TEMPLATE
## [EPISODE_METADATA]

* [EP_NUM]: 01
* [EP_TITLE]: The Wolf’s Feast
* [GENRE_STYLE]: HYBRID (Cartoon character overlayed onto Photoreal LTX environments)
* [TARGET_RUN_TIME]: 03:00

------------------------------
## [CAST_AUDIT]
* [CAST_MAIN]: Red Riding Hood (Cartoon 3D shader model), The Big Bad Wolf (Photoreal LTX fur-render disguised in Grandma's nightgown).
* [CAST_BACKGROUND]: None.
* [ENV_SETS]: Grandma’s Cabin Interior (Dark, dusty, volumetric sunbeams through wooden slats).
* [PROP_LIST]: Wicker basket, porcelain teacup, velvet-quilted bed, Grandma's wire-rimmed glasses.

------------------------------
## [EPISODE_TIMELINE]
## <SCENE_03>

* [ENV]: Grandma's Bedroom
* [TIME_LIGHTING]: Late Afternoon. Low-key, dramatic Chiaroscuro lighting. Deep shadows with bright amber sunbeams hitting the bed.

## <SHOT_01>

* [BUDGET_TIER]: CHEAP_TAKE
* [VISUAL_ACTION]: Wide establishing shot. Red enters the cabin door, holding her basket. Camera is completely static. Red walks from screen-left to center-frame.
* [DIAL]: RED: "Grandmother? I've brought you some fresh cakes and warm butter from Mother."
* [SFX]: Wooden door creaking open, heavy rhythmic footsteps on old floorboards.
* [MUSIC]: Muted Suspense — Low strings, slow tempo, high-pitched eerie violin note holding in the background.
* [CUTAWAY]:

## <SHOT_02>

* [BUDGET_TIER]: CHEAP_TAKE
* [VISUAL_ACTION]: Medium over-the-shoulder shot looking past Red at the bed. The Wolf is sitting up, pulled into the shadows. Only his silhouette and the glint of Grandma's wire glasses are visible.
* [DIAL]: WOLF: "(Strained, high-pitched rasp) Come closer, my sweet child. Lay your basket by the hearth."
* [SFX]: Rustling of heavy bed sheets.
* [MUSIC]: Muted Suspense — The high violin note gets slightly louder.
* [CUTAWAY]:

## <SHOT_03>

* [BUDGET_TIER]: EXPENSIVE_TAKE
* [VISUAL_ACTION]: Extreme close-up tracking shot. The camera slowly pans across the Wolf's face as he leans into a sunbeam. LTX simulation triggers: realistic hyper-detailed wolf fur rippling, saliva pooling on a sharp fang, and a sudden digital twitch of his large wolf ear.
* [DIAL]: RED (O.S.): "Oh... Grandmother. What big ears you have."
* [WOLF]: "The better to hear you with, my dear..."
* [SFX]: Deep, wet guttural growl vibrating beneath the high voice.
* [MUSIC]: Tension Spike — A sudden, sharp cello pluck.
* [CUTAWAY]:

## <SHOT_04>

* [BUDGET_TIER]: EXPENSIVE_TAKE
* [VISUAL_ACTION]: Low-angle, handheld-style shaky cam looking up at Red. She takes a dramatic step back, her cartoon eyes widening in terror.
* [DIAL]: RED: "And Grandmother... what monstrously big teeth you have!"
* [SFX]: Fabric tearing as the Wolf violently shifts weight in the bed.
* [MUSIC]: The Drop — Orchestral swell, brass section enters at maximum intensity.
* [CUTAWAY]: [CUTAWAY_FLASHBACK_01]: Quick 0.5-second flash frame showing the Woodsman swinging his sharp iron axe in the forest, establishing the rescue setup for the next scene.

## <SHOT_05>

* [BUDGET_TIER]: EXPENSIVE_TAKE
* [VISUAL_ACTION]: Dynamic LTX motion pass. The Wolf leaps directly out of the bed toward the camera, nightgown flying open, claws extended. Red drops her basket in slow motion. Cakes scatter across the floor in a full physics simulation pass. Cut to black just as the Wolf's jaws fill the frame.
* [DIAL]: WOLF: "The better to EAT YOU WITH!"
* [SFX]: Loud wood crashing, wicker basket smashing, a piercing, stylized cartoon scream from Red cutting off abruptly into a heavy bass thud.
* [MUSIC]: Climax Crash — Loud, sudden orchestral hit, instantly transitioning into complete silence on the cut to black.
* [CUTAWAY]:

------------------------------
## [POST_COMP_INSTRUCTIONS]

* [COLOR_LUT]: Grim-Fairytale-Teal-And-Gold (Crushed shadows, vibrant warm highlights on Red's cloak).
* [GRAIN_OVERLAY]: 35mm Vintage Film Grain (To blend the sharp 3D cartoon edges smoothly into the photorealistic LTX background assets).
* [MASTER_AUDIO_NOTE]: Apply a heavy digital low-pass filter to the audio during the final cut to black to maximize the shocking silence.`;

export const EPISODE_TEMPLATE = `${EPISODE_TEMPLATE_RULES}

------------------------------

${EPISODE_CONSTRUCTION_BLANK}

------------------------------

${EPISODE_CONSTRUCTION_EXAMPLE}`;
