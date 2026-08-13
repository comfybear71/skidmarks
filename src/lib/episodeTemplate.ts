/**
 * The Skidmarks episode template — house rules + the locked story spine.
 * Paste this into an outside AI (Google AI etc) along with a character,
 * location and the fake-win/loses-it/smashed specifics, and it hands back
 * a scene-by-scene breakdown shaped for Studio.
 *
 * Source of truth also lives as a doc at Skidmarks/docs/EPISODE_TEMPLATE.md —
 * keep the two in sync if this ever changes.
 */
export const EPISODE_TEMPLATE = `You are writing a scene-by-scene breakdown for SKIDMARKS, a stylised 3D animated
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

---

FILL THIS IN BEFORE YOU GENERATE:

CHARACTER: [name, who they are, what real person/experience they're drawn from]
LOCATION: [where this episode happens]
THE FAKE WIN: [what golden gift arrives in stage 5]
HOW HE LOSES IT: [stage 7 — how it gets ripped away]
HOW HE GETS SMASHED: [stage 8 — the actual ending]

---

OUTPUT FORMAT — for every scene, write it exactly like this:

SCENE: [which story-spine stage this covers, e.g. "Stage 3 — keeps proving he's a bastard"]
LOCATION: [place]

SHOT: [short title]
GLOBAL NUDGE: [one line, or "(none)" — only fill this in if EVERYONE on screen holds ONE
  shared reaction through the whole shot, e.g. "held wince at the smell". Most shots don't
  need one — leave it "(none)".]
GLOBAL: [always starts, word for word: "perfect lip sync, clear lip movement, citing the
  dialogue clearly, facial expressions and hand gestures are lively, dication is perfect."
  Add exactly one more sentence only if GLOBAL NUDGE called for a shared reaction, written
  as face muscles, e.g. "Whoever is on screen holds <muscles>, never a feeling word, the
  whole scene." Never mentions render style, camera, lighting, or props — that's PLATE's job.]

BEAT: [character name, or "(silent)" if nobody speaks this beat]
NUDGE: [one line, face-muscle and body-language only, never a feeling word like "angry"]
LINE: [exact spoken words, with optional bracket delivery tags, written at natural length —
  never compressed to fit a time — or "(silent)"]
ACTION: [what their body and face do while they say it (or while silent) — muscles and
  movement only, never a feeling word]
PLATE: [the still image this beat renders from. Every character on screen, their locked
  physical appearance in full, exact position, what their hands are doing, exact
  expression at this instant. Nothing exists in the shot unless it is written here —
  motion only moves what is already in this picture, it never adds anything new]
IMAGE: [VISUAL]: [what moves from PLATE's starting pose, muscles and small movement only]
  [SPEECH]: [Name] says: "[the LINE, exact, or omit [SPEECH] entirely if this beat is silent]"

(repeat BEAT/NUDGE/LINE/ACTION/PLATE/IMAGE for every beat in that shot, then repeat
GLOBAL NUDGE/GLOBAL and SHOT for every shot in the scene, then repeat SCENE for every scene
in the episode)`;
