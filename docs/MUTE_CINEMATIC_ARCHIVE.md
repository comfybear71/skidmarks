# Mute cinematic archive

Logged **2026-08-25**. Living list for picture-to-music work — **no lip-sync**.

Lip-sync already has a home. Do not pour speaking lessons into this file, and do not pour mute lessons into the speech file.

| Floor | Where the lessons live |
|---|---|
| **Lip-sync** (we are good at this) | [`PLATE_AUTOMATION_ARCHIVE.md`](./PLATE_AUTOMATION_ARCHIVE.md) + First Fleet gold [`SUNNY_BANKS_IMAGE_MOTION_STANDARD.md`](./SUNNY_BANKS_IMAGE_MOTION_STANDARD.md) |
| **Mute cinema** (we are learning this) | **This file** + rows in `src/lib/plateAutomationArchive.ts` (`layer: "mute"`) |

Append a row only when we **saw** the still or the clip. Teaching that has not been cooked yet stays in **Teaching — not cooked**. Do not promote teaching to gold.

---

## Two floors — do not mix

| Floor | What the picture is doing | Motion engine | Never |
|---|---|---|---|
| **Lip-sync** | A person **says** a line | Cloud **LTX-2.3 IA2V** + the **Saved speech mp3** | Mute I2V. H3. First-last. The song mix as the audio. |
| **Mute cinema** | The song plays **over** the picture. Mouths shut. Nobody sings. | Stills first, then **mute** I2V / FLF2V / H3 / Comfy loops | Feed the **song mp3** into IA2V, H3, or FLF2V. That makes mouths follow the mix. |

`/m` speech stays on the lip-sync floor. A mute film on `/m` is stills + TRACK + mute cooks. Same phone. Different send.

Band name on a music-video job is **credit only**. Do not cast the band.

---

## How a lesson gets in (so we do not relearn)

1. Write what we asked for.
2. Write what came back (Pass / Fail / threw away).
3. Write the fix in one line.
4. Put the same row in `src/lib/plateAutomationArchive.ts` with `layer: "mute"`.
5. Do not rewrite a live pack's `story_json`. Park old media in `_cleared/`. Do not Start directing again on a job that already has a pack.

A chat is not the archive. If it is not in this file, the next agent will not have it.

---

## Tool jobs

His words, plus what we have actually run. **Run** means we sent it and saw the file. **Teaching** means we have not cooked that motion on this mute film yet.

| Tool | Job on a mute film | Run on Bright Act I stills? |
|---|---|---|
| **Siray Seedream 4.5 T2I** | Empty-stage stills (no face card). 16:9 `2560x1440`. ~$0.04/still. No balance API — say so before a batch. | **Yes** — four Act I plates |
| **Siray Seedream 4.5 ref2i** | People stills when a face is on the card | Not this Act I test (empty cards) |
| **Grok Imagine image** | Location “More” / face candidates. Uses the **last still as an edit**, not a fresh lottery. | Not used for these four (that path would have steered off the old place stills) |
| **Grok Imagine video** | Not the camera for every mute shot | Used on an earlier Bright cook (14 clips). Parked. Not the film. |
| **Comfy (LTX / AnimateDiff)** | Most of the mute film later: texture, roots, seed macros, melt, loops. Cheap. | **Not cooked yet** |
| **MiniMax H3** | Weight, contact, **one** drone/track/crane move. First+last frame. Always invents stereo — strip it. | **Not cooked yet** |
| **Grok the writer** | Prompt supervisor / expander. Not the camera. | — |

Credits before any generate. Siray has no balance API.

---

## Proven stills — 2026-08-25

Job `mgen_20260825182458771_mfk` (3rd Bright). Same job. Parked the earlier 22 plates + 14 Grok clips. Song and 8 section markers stayed. Four new empty-stage cards.

Look lock that went on every still:

```
LOOK: music video cinematography. Full photographic cinematic still — real photo
materials, real photo light, real camera lens. Camera-real. Not a cartoon.
Not cel. Not stylised 3D. Not a CGI render.

GRADE: cold grey and steel blue only. Winter. Desaturated. No amber. No fire.
No gold. No warm stage light. No concert lighting.

FRAME: widescreen 16:9. No text, no captions, no watermarks.
```

Empty-stage `/m` Draw **refuses** without a character (`Need a character on this plate before Draw`). These four were landed as empty cards + Siray T2I, not through the phone Draw button.

| Shot | Asked | Kept? | Lesson |
|---|---|---|---|
| **1.1 Seed** | Extreme macro, one dark seed, frost, black void. No people. No path. | **Yes** (first take) | Name the void. Forbid path / white bands / people. |
| **1.2 Ground** | Cracked frozen earth. A faint pulse in one fissure. No people. | **Yes**, with a note | The “pulse” came back **brighter** than faint. Next time say *barely visible, almost no colour*. |
| **1.3 Rivers** | Aerial, two waters meeting, mist, winter. No people. | Take 1–2 **Fail** (beach + sea). Take 3 **Yes** | “Coastal waters” reads as **shoreline**. Say: *WATER FILLS THE ENTIRE FRAME. Two currents. No beach, no sand, no land.* |
| **1.4 Hill** | Wide, low, two silhouettes walking away, backs only, faces hidden. | Take 1 **Fail** (white path + fire). Take 2 **Yes**, faint worn dirt only | Models invent a **path** and **Act I fire**. Forbid path / trail / white stripe / fire / sparks / orange. Do not name MIRA or LEN — that pulls face cards. |

Watch: `https://skidmarks.aiglitch.app/m?job=mgen_20260825182458771_mfk`

These stills are a **test**, not gold. Do not copy them onto another song.

---

## Proven fails (mute floor)

| Fail | What happened | Fix |
|---|---|---|
| Song mp3 into IA2V / H3 | 2nd Bright: mouths followed the mix | Mute I2V/FLF2V/H3: duration as a number. Hang on TRACK. **Strip invented audio.** Never attach the song as clip audio. |
| Every mute clip → Grok video | Earlier Bright cook: 14 clips, ~88s on a 368s song. Comfy never used. H3 never used. First-last never tried. | Do not send the whole mute film to one engine. Stills first. Then pick the tool per shot. |
| Shrink the clock to save money | Gaps instead of a full-length picture. Scored 50/100 for changing the plan. | Full song picture, or stop and ask. Do not invent a cheaper film. |
| Phone Draw on an empty card | API: need a character first | Empty-stage stills: Siray T2I (no face ref), or put a person on the pad on purpose. |
| Location “More” as a fresh look | `generateLocationCandidates` sends the last still as the reference | A new Act I look is a **fresh T2I**, not More on the old place card. |
| White path / fire in Act I | Model “helps” | Forbid them in the still prompt. Fire belongs at the **end** of this song, not the open. |
| Turnaround sheet into Draw | Doubles | Sheet is QA. Shot stills use one face card, or nobody. |
| Guitar / phone on people who are not playing | Model fills empty hands | Empty hands unless Position names the held thing. |

---

## Teaching — not cooked

Do **not** treat these as gold. They are the plan we are studying. Cook only when he says go.

**Boléro law** (picture weight, not the Ravel piece): start almost still; add weight every section; bridge is too much (light and motion); **dead stop** on the last hit. Continuous slow Z-push that speeds up.

**Colour:** cold grey/blue → amber/brass → crimson/gold/white → freeze/black.

**Places are the feeling.** Do not illustrate lyrics word for word. End fire is not a campfire.

**Hard-motion later (H3, one move per clip):** hill walk, rivers drone, road walk, gravel walk, door contact. Distant drone frames can warp.

**First-last frame:** Hub has FLF2V (`video_ltx2_3_flf2v`, `video_ltx2_5_flf2v`). H3 also takes first + last. `/m` speech stays `video_ltx2_3_ia2v`. This mute film is not that path.

**Nobody looks at camera. Nobody sings.**

When a mute clip **Passes**, move it up into **Proven** with the engine, duration, and the prompt that worked.

---

## TRACK (mute)

A clip is not on the timeline until `plateTimings` has the same clock. Hang is one write: cut (`clipFile`, `status: done`) **and** `{ plateId, startMs, endMs, sortIndex }`. File first — if it is already in Blob, hang it; do not recook.

Stitch is out. Finish is ordered unstitched mp4s with human names.

---

## Related

- Speech / lip-sync archive: [`PLATE_AUTOMATION_ARCHIVE.md`](./PLATE_AUTOMATION_ARCHIVE.md)
- Camera menu (people stills, when someone is on the pad): [`MUSIC_VIDEO_BASE.md`](./MUSIC_VIDEO_BASE.md)
- Comfy Hub map: [`COMFY_WORKFLOWS.md`](./COMFY_WORKFLOWS.md)
- Comfy animation research (not a send path): [`COMFY_ANIMATION_RESEARCH.md`](./COMFY_ANIMATION_RESEARCH.md)
