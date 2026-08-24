# Music video base (next song uses this)

Logged **2026-08-24** from Stuie. Forgotten stays a test. Five more songs tonight. Do **not** mint a job from this file. Do **not** Start directing. Do **not** generate until he says go.

PR for the Forgotten desk work: https://github.com/comfybear71/skidmarks/pull/311  
Live `aiglitch.app` JS only changes when that merges to `master`. Neon job data (song, Sections, Marquee pins) is already live.

## What he pastes (not one box)

There is no single “drop everything” field. The desk is four separate things:

| What he has | Where it goes today | What the code actually does |
|---|---|---|
| **Band / artist** | Artist box on Start (`job.artist`) | Credit line only. Not read out of the lyric sheet. |
| **Song title** | Song box on Start (`job.songTitle`) | Credit line + pack name. Not read out of the lyric sheet. |
| **Song info / vibe** | Vibe box (`job.prompt`) | Look / logline. Not a face. Not a plate. |
| **Lyrics with `[Intro]` `[Verse 1]` `[Chorus]`…** | Lyrics textarea (`set-lyrics`) | `[tags]` become **Sections**. Sung words become **Marquee**. Tags never scroll as words. |
| **mp3** | Drop the file | Saved to Blob. Times come from duration + the sheet, not from hearing the mix. |

`[Sax break]` / `[Guitar solo]` / `[Bridge]` / `[Hook]` already map to section types. A stage-direction tag (`[End, sudden silence]`, a drone note) stays **custom** and does not become a Section.

Times from Import are **sheet position** (where the tag sits in the pasted lines), then sung lines are pinned evenly **inside** that window. That is lining from the words, not from the vocal. Pin can still nudge a line.

A dropped filename (`FORGOTTEN.mp3`) is not a lyric.

Live drop of a song bigger than ~4.5MB fails on production until PR 311 merges (Blob prepare → attach). Forgotten’s mp3 is already on the job.

## Camera + Position pack — this is the base

`MUSIC_VIDEO_CAMERAS` + named instruments + empty-handed Jack. Next song must use these on **every** music-video Start, not only when the title is Forgotten.

| Key | Camera words |
|---|---|
| `tight-cu` | Tight close-up, face fills the frame |
| `mcu` | Medium close-up, head and shoulders |
| `medium` | Medium, full upper body, three-quarter |
| `wide` | Wide full-body, ground and sky |
| `ots` | Over the shoulder, three-quarter back, same face |
| `sitting` | Sitting, knees bent, place is a seat |
| `ots-two` | Look past the nearer person at the farther one |
| `wide-three` | Wide three-shot, depth, not a lineup |

Position rules that stay:

- Who is named is who is drawn. 2–3 people max. Never the whole band on one still.
- Instruments only if Position names them (Horn = muted trumpet, Sax, Guitar, Drummer kit). Jack empty hands. No invented mug / phone.
- Anti-cel lock on music_video Draw. Fresh still — do not refine a cartoon take.
- Do not feed `plate_{slug}` turnaround sheets into Draw.

**Gap to fix on the next song (not Forgotten):** `buildMusicVideoStartStory` only applies this pack when `isForgottenSongJob`. Other titles still get the old generic “half turned away in profile” line. Lift the camera pack to all `music_video` before the next Start.

## Two floors (unchanged)

People stills → `/m` LTX-2.3 IA2V with the Saved mp3.  
Concert loop (gold/black, no people) → holy still first, then muted LTX-2.5 I2V. The look is the **Double Talkin' Jive** LED backdrop (Bangkok Thunderdome): gold skulls, metallic snakes, hypnotic creep. Study: `docs/CONCERT_LOOP_PLATE.md`. **Hold — a few more video tests, then implement. Not now.**

## Eventual goal — who is playing, then plate (no code yet)

Stuie’s thought, **2026-08-24**, no build tonight:

1. **Manual first:** with the mp3 on the desk, mark Sections / Marquee for *when singer*, *when horn*, *when sax*, *when drums* — then plate that person into that window.
2. **Later automatic:** listen to the mix (stems / instrument activity / vocal onset) and write those windows so he does not have to tap Start here on every break.

That is the destination. Forgotten’s pins are sheet-spread only. Do not claim the desk can hear the trumpet.

## Queue tonight

Same band unless he says otherwise: **THE JACK ASH BAND**.

1. MY NEW TOY — no job yet  
2. FORGOTTEN — live test `mgen_20260824085817084_edp`. Leave it. Do not Start directing.  
3. BURNING BRIGHT  
4. EAST  
5. GIVE ME SOMETHING  

Do not wipe **BLOWING UP CLAUDE** (`mgen_20260822085033162_0ud`).
