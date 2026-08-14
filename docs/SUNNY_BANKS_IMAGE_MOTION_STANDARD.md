# Sunny Banks IMAGE MOTION — gold standard

Logged **2026-08-14** from Stuie. First Fleet Cloud prompts that **worked 100%**. Next Sunny Banks episode must follow this. Do **not** rebuild these. Do **not** write them onto a live pack unless Stuie says **go**.

Verbatim gold JSON: `docs/SUNNY_BANKS_IMAGE_MOTION_GOLD.json`

Show: rubbery adult cel cartoon. **Not** Skidmarks 3D. Never mix `[VISUAL]` / Skidmarks style into Sunny Banks.

---

## Speaking plate (mandatory)

Every plate where a character talks uses this shape. No `[SPEECH]`. No `[VISUAL]`. Line is `NAME says: "…"`.

```
Use the provided start image as the first frame. [NAME], [look lock] is prominent, mouth and head move naturally while speaking, subtle gesture. Props and background stay exactly as the start image, nothing new enters frame. [NAME] says: "[the line]". Camera holds. Same person and objects as the start image. [style lock]
```

`segmentText` for a speak beat:

```
[NAME] delivers the line, subtle lean and gesture, cartoon timing
```

Worked example (Shazza):

```
Use the provided start image as the first frame. Shazza, big blonde hair, leopard-print top, cigarette, arms folded is prominent, mouth and head move naturally while speaking, subtle gesture. Props and background stay exactly as the start image, nothing new enters frame. Shazza says: "We haven't got any shade, Dazza. So it's forty-seven degrees of structural integrity. Stop complaining and finish your breakfast". Camera holds. Same person and objects as the start image. rubbery adult cartoon, thick black outlines, flat cel colour, big heads, noodly arms, sun-bleached Aussie palette, dusty ochre, faded teal, heat haze. Not photographic, not soft Pixar, not photorealistic
```

---

## Hold plate (no dialogue)

```
Use the provided start image as the first frame. [NAME], [look lock] holds their pose, subtle idle motion, weight shift, breathing, heat haze, flies. Props and background stay exactly as the start image, nothing new enters frame. No dialogue. Camera holds, no cuts. Same person and objects as the start image. [style lock]
```

`segmentText`: `[NAME], soft idle motion, heat haze, flies, props locked`

Group hold: `Only A and B in frame, no one else appears. Everyone holds their pose… All mouths stay closed.`

Insert (no person): describe the object, `holds still with subtle ambient motion…` then `No dialogue. Camera holds, no cuts.` `segmentText`: `Insert, ambient motion, heat haze, props locked`

---

## Global (every beat)

```
perfect lip sync, clear lip movement, citing the dialogue clearly, facial expressions and hand gestures are lively, dication is perfect. rubbery adult cartoon, thick black outlines, flat cel colour, big heads, noodly arms, sun-bleached Aussie palette, dusty ochre, faded teal, heat haze. Not photographic, not soft Pixar, not photorealistic
```

Style lock on every `imageMotion` (keep the spelling; this is the working gold):

```
rubbery adult cartoon, thick black outlines, flat cel colour, big heads, noodly arms, sun-bleached Aussie palette, dusty ochre, faded teal, heat haze. Not photographic, not soft Pixar, not photorealistic
```

---

## Look locks (match the start image, do not invent a second costume)

| Name | Look |
|------|------|
| Shazza | big blonde hair, leopard-print top, cigarette, arms folded |
| Dazza | **as on that plate** — early: tall messy blonde, blue shirt, beers, coins, or pink hair dryer depending on the plate — later: wild mullet, stained blue singlet, stubbies, beer can |
| Nan | tiny elderly woman, hair bun, round glasses, purple housecoat, teacup, cricket bat |
| Hans | German backpacker, safari outfit, cork hat, camera around neck |
| Nuggets | skinny teen, buzz cut, blue and yellow jersey, meat pie |
| Alien 1 / Alien 2 | short purple alien, antennae, bulging eyes, bucket hat, high-vis vest |
| Ranger Dan | portly park ranger, oversized Akubra, high-vis vest, mountain bike |

---

## Do not

- Fill Animate / rewrite IMAGE MOTION on a built pack
- Put Skidmarks `[VISUAL]` or empty `[SPEECH]` / “other people” on Sunny Banks
- Add `[SPEECH]` on Shazza / Hans / Nuggets (this gold uses `NAME says:` for **every** speaker)
- Bazza Pass is the only pass that keeps `[SPEECH]` — do not apply Bazza format to this Cloud gold
- Change `plateFile` pointers, live `story.json`, or voice locks unless Stuie says **go**
