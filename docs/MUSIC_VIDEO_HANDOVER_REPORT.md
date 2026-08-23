# Music video job — every pack

Same steps for every `/m` music video. Work **only** on the job URL Stuie gives. Never mint a second pack.

Worked example: THE JACK ASH BAND — BLOWING UP CLAUDE  
`https://skidmarks.aiglitch.app/m?job=mgen_20260822085033162_0ud`  
mp3 **~267.5s**. Cast: JACK GHOST, SAXOPHONE, GUITAR, DRUMMER.

Other live job (do not mix): SOUL REBEL — JUNGLE JUICE  
`https://skidmarks.aiglitch.app/m?job=mgen_20260822214448598_ezs` (~130.7s).

Ignore this duplicate (wrong mp3 length): `mgen_20260822222133185_jsv`.

---

## Hard rules

1. **Never** create a new mobile job. **Never** tap Start directing on a pack that already exists. **Never** run `mv-bootstrap-soul-rebel.mjs`.
2. **Never** run a complete/finish script that draws plates or fires LTX unless Stuie names the shots.
3. Credits are real money. LTX only on the job + shot ids he gives.
4. Verify mp3 duration before any LTX (Jack ~267s, Jungle Juice ~130s).
5. Do not wipe cast, locations, or plates he said were good.
6. Do not claim done without what he sees on the phone at `skidmarks.aiglitch.app`.

---

## Order — always this, never skip ahead

### 1. Lyrics (Lyrics tab)

Paste a **clean sheet**. Tags on their own lines. Split smashed lines (`inIt's`, `behindIt`).

`/m` strips `[square brackets]` — they are structure, not sung words. Glued tags like `[Verse 1]Silver` are OK; glued **sung** lines are not.

Tags the desk understands:

- `[Instrumental Intro]` / `[Intro]` → intro
- `[Verse 1]` / `[Verse 2]` → verse
- `[Chorus]` / `[Hook]` → chorus
- `[Bridge]` → bridge
- `[Sax break]` → sax_break
- `[Lead break]` / `[Guitar solo]` → lead_break
- `[Outro]` → outro

Stage notes (`[Tension-strummed 12-string…]`, `[Fading 12-string drone…]`) stay off the marquee.

Save: `POST /api/crash/mobile/song` `{ action: "set-lyrics", jobId, lyrics }`.

Jack cleaned sheet (28 sung lines): Intro note → Verse 1 (8) → Chorus (6) → Verse 2 (8) → Chorus (6) → Outro note.

### 2. Section markers (the coloured bands)

Do **not** replace bands Stuie already timed with Start here.

If the wave is empty: **Import from lyrics**, then play and tap **Start here** on each row. Import parks every row except the first at the end of the song until those taps.

Jack bands already timed (keep):

| Section | Clock | ms |
|---|---|---|
| Intro | 0:00–0:35 | 0–35000 |
| Verse | 0:35–1:41 | 35000–101000 |
| Chorus | 1:41–2:12 | 101000–132000 |
| Bridge | 2:12–2:30 | 132000–150000 |
| Verse | 2:30–3:20 | 150000–200000 |
| Chorus | 3:20–3:49 | 200000–229000 |
| Sax break | 3:49–4:07 | 229000–247000 |
| Lead break | 4:07–4:27 | 247000–267534 |

Save: `POST /api/crash/mobile/track` `{ action: "save-track", jobId, sectionMarkers }`.

Who plates a band: vocals → lead singer. `sax_break` → SAXOPHONE. `lead_break` → GUITAR. Intro/outro can be lead (mouth closed) or drummer.

### 3. Marquee pins (Marquee tab)

Pin **sung lines only**, inside the verse/chorus windows. Intro / bridge / sax / lead / outro instrumental: **no words**.

Spread that section's lines evenly from `startMs` to `endMs`. Stuie watches; if a line is early/late he taps it at the playhead to re-pin.

Jack: 8 + 6 + 8 + 6 = 28 cues. Verse 1 starts ~0:35.

Save: `POST /api/crash/mobile/track` `{ action: "set-lyric-cues", jobId, lyricCues }`.

Without pins the marquee **evenly splits the whole song**, so words appear over the intro. That is a bug for watching. Always pin after markers exist.

### 4. Plates (only after 1–3, only if he says go)

Keep plates he said were good. Jack first six JACK GHOST stills (do not redraw):

`shot_h3gn4xf`, `shot_wyqy4vq`, `shot_2p04clq`, `shot_0u1p6vh`, `shot_sqh6jbu`, `shot_q553t02`

Position: **short place name**, not the full camera paragraph. One person in frame.

Humming / intro / outro / bridge (mouth closed):

`{NAME} at the mic, mouth closed, eyes half closed, humming soft backup harmonies — not lip-syncing lead lines. Still and soulful.`

Sax/guitar:

`{NAME} alone. Only {NAME} in frame. At {place}, centre frame in profile with instrument visible. NO SINGING — mouth closed, playing the sax|guitar.`

Silent LTX gold (hold/cutaway, not the same as a music-video intro): `docs/SUNNY_BANKS_IMAGE_MOTION_STANDARD.md` hold plate. Skip lip-sync only when motion has **both** `No dialogue` **and** `Mouth stays closed`. Cloud LTX still needs an mp3 (song slice, SFX, or silent file). A music-video intro is **not** a silent clip — the song plays; the mouth stays closed.

### 5. LTX redo (only named shots)

**Generate cuts** only cooks **pending/running**. It skips **done** and **error**. There is no phone button to redo a green cut.

Same job, same plate: `POST /api/crash/mobile/song` `{ action: "run", jobId, cutId }`. Old mp4 stacks; files are not deleted.

`Stop` only unsticks a hung cook with no file.

Slice length must come from `plateTimings` via `sliceBoundsForPlate()`, not the legacy `durationSec: 15` cut row.

### 6. Stitch (after approved clips)

`POST /api/crash/mobile/song` `{ action: "stitch", jobId }`.

Current concat is ffmpeg `-c copy`. Clips whose **video is longer than audio** (Jack/Jungle intro-style) shift the picture against the song. Fix stitch to trim each clip to its section length **before** claiming a join is done. Drop stitch parks the joined file; clips stay.

---

## Phone check

Refresh `https://skidmarks.aiglitch.app/m?job={id}` (signed in). Play. Bands should match the song. Marquee words should start when the verse starts, not over the intro.
