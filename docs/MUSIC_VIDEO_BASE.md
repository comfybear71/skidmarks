# Music video base (next song uses this)

Logged **2026-08-24** from Stuie. Forgotten stays a test. Five more songs tonight. Do **not** mint a job from this file. Do **not** Start directing. Do **not** generate until he says go.

**Blank canvas:** The next song is its own job. It does not inherit another job's grade, camera-by-name table, roster, or props. Who is named on this Start is who is drawn. Empty hands unless **this** job's Position names a held thing. A new solo Start uses two off-axis cameras from the menu (three-quarter + over-shoulder) — not a straight-on mug shot. Plate clocks (`plateTimings`) are the song split across those plates — not leftover 15s rows. Finish is ordered unstitched mp4s with human names (`01_Babe_three_quarter_Spit_Roast.mp4`).

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

Camera words stay available as a menu. A new **solo** Start uses two off-axis keys (`medium` three-quarter + `ots` over-shoulder), empty hands. A band Start is one plate per named person. Named instruments apply only when **this** job's Position names them.

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

- Who is named on **this** job is who is drawn. 2–3 people max. Never a crowd on one still.
- Empty hands unless **this** job's Position names a held thing. No invented mug / phone. Do not copy another person's prop.
- Anti-cel lock on music_video Draw. Fresh still — do not refine a cartoon take.
- Do not feed `plate_{slug}` turnaround sheets into Draw.

A new Start uses the camera menu for **this** job only. Forgotten-only extras (`forgottenSoloCamera`, research drafts, crimson grade) stay behind `isForgottenSongJob`. Do not lift those onto the next song.

## Two floors + intermission

People stills → `/m` LTX-2.3 IA2V with the Saved mp3.  
**Intermission** (no singer, no trumpet) → insert animation. Concert loop (gold/black, no people) is that insert: holy still first, then muted LTX-2.5 I2V. Look: **Double Talkin' Jive** LED (Bangkok Thunderdome). Study: `docs/CONCERT_LOOP_PLATE.md`. **Hold generate** until he names T4/T5. Clock the gaps now.

**Forgotten mix (2026-08-24, his ear):** no saxophone. Jack only on the vocal hits (face hidden, LTX IA2V + mix). Trumpet clocks stay on HORN, but **do not LTX-invent play**. Drive valves from a real player clip (OpenPose / DWPose / Wan Animate Move). Face off-camera or in shadow. Silent video, sync Forgotten.mp3 in Resolve. Map: `src/lib/forgottenWhoPlays.ts`.

## Who is playing, then plate

1. **Manual first (now on Forgotten):** mark when singer / when trumpet — then plate that person. Animation fills the rest.
2. **Later automatic:** listen to the mix and write those windows.

Do not claim the desk can hear the trumpet. Do not put sax on Forgotten.

## Queue tonight

Same band unless he says otherwise: **THE JACK ASH BAND**.

1. MY NEW TOY — no job yet  
2. FORGOTTEN — live test `mgen_20260824085817084_edp`. Leave it. Do not Start directing.  
3. BURNING BRIGHT  
4. EAST  
5. GIVE ME SOMETHING  

Do not wipe **BLOWING UP CLAUDE** (`mgen_20260822085033162_0ud`).
