# LTX-2.3 / LTX-2.5 prompting — research log

Logged **2026-08-24**. Official pages Stuie sent. Knowledge only.

Do **not** rebuild gold. Do **not** write this onto a live pack. Do **not** swap `/m` speech off Cloud LTX-2.3 IA2V + Saved mp3. Do **not** add invented soundtrack words to a people-floor prompt.

Sources pulled this session (200 OK):

| Page | Date on page | What it is |
|---|---|---|
| https://ltx.io/blog/ltx-2-3-prompt-guide | 10 Mar 2026 | Official LTX-**2.3** prompt blog |
| https://docs.ltx.io/api-documentation/implementation-guides/prompting-guide | live docs | Official API prompting guide (2.3 + 2.5 notes) |
| https://ltx.io/blog/ai-video-prompt-guide | 20 Jul 2026 | Official **2.5**-weighted “how to write AI video prompts” |
| https://docs.ltx.io/models/ltx-2-3.md | live docs | 2.3 Fast / Pro endpoints + duration table |

Also read: `src/lib/mobileImageMotion.ts`, `src/lib/ltxCloudIa2v.ts`, `docs/SUNNY_BANKS_IMAGE_MOTION_STANDARD.md`, `docs/LTX_25_FLF2V_RESEARCH.md`.

---

## Two products. Do not mix them.

Official blogs talk about **LTX making the picture and the sound from the prompt**.

`/m` Generate on a talking plate is **not that**:

| | Official I2V / 2.5 blog | `/m` people floor today |
|---|---|---|
| Start | Optional first frame | Shot plate (required) |
| Audio | Model **writes** rain / music / speech from the prompt | Our **Saved mp3** (ElevenLabs or the song slice) |
| Model | 2.3 I2V or 2.5 I2V | Cloud **LTX-2.3 IA2V** |
| Job | Invent a clip | Lip-sync **our** line / **our** mix |

If we followed the blogs literally and wrote “crowd cheer, synth drone, rain on pavement” into Image motion, LTX would try to **invent that soundtrack**. That fights Forgotten.mp3 and every talking-head Save. **Keep invented audio off the people floor.**

The mute concert floor (LTX-2.5 I2V, not built) is the place those audio words would matter — and even there the clip must be **silent** so Resolve keeps our mix. See `docs/CONCERT_LOOP_PLATE.md` and `docs/LTX_25_FLF2V_RESEARCH.md`.

---

## What the 2.3 blog actually says

Key takeaways from https://ltx.io/blog/ltx-2-3-prompt-guide :

1. **Long, detailed prompts.** Subject, action, lighting, camera, audio.
2. **Match prompt length to clip length.** A short prompt on an 8–10s clip makes the model rush the action.
3. **Break dialogue into short phrases** with acting in between (pause, look aside, cracking voice), not one dump.
4. **Physical cues**, not “he feels sad”.
5. **I2V:** describe **motion**, not the still. The picture is already there.
6. **One flowing paragraph**, present tense.
7. Spoken lines in **quotation marks**.
8. **One dominant event** per generation.

Their own speaking example (shortened): man speaks a chunk → pauses and looks aside → continues → eyes widen → finishes with a cracking voice → camera slowly zooms. Audio: crisp room tone.

That is **their** audio. On `/m` the mp3 is already the audio. The useful bit is the **acting between phrases**, not the room-tone sentence.

**I2V line from the same blog:** “Focus your prompt on the motion and action you want — avoid describing the static elements already visible in the image.”

---

## What the API docs actually say

From https://docs.ltx.io/api-documentation/implementation-guides/prompting-guide :

Six elements: shot → scene → action → character → camera → audio.

Single take: **4–8 sentences**, present tense, camera relative to the subject.

**I2V from a first frame: stay one continuous take** unless you mean to cut away from that opening image.

**Multi-shot cuts** (“A hard cut transitions to…”) are documented as **LTX-2.5**. Do not put cut language into a 2.3 IA2V talking send.

**Dub-It** is a different tool: video-in, new line out. Template: `[Speaker] is speaking [Language], saying: "[Dialogue]"`. That is not our IA2V + mp3 path. Do not swap `/m` onto Dub-It.

On-screen text is still unreliable. We already lock “no readable text or signage”.

---

## What the 2026 AI-video blog actually says

From https://ltx.io/blog/ai-video-prompt-guide (2.5-weighted):

Seven layers, left-to-right: subject, action, setting, camera, lighting, style, **audio**.

2.5 **writes sound in the same pass**. Leave audio out and the model picks a soundtrack for you.

2.5 can do **2–4 shots** in one prompt if you name each cut.

2.5 has a **prompt enhancer** on by default. Turn it **off** when the wording is already locked (our gold).

2.5 I2V beginner template (`video_ltx2_5_i2v`) invents audio from the prompt. That is the concert-loop graph, not `/m` speech.

---

## Official 2.3 API duration vs our Cloud send

https://docs.ltx.io/models/ltx-2-3.md — public API **image-to-video** duration is **6–20s** (Fast) or **6–10s** (Pro). Audio-to-video length **follows the input audio**.

Our Cloud IA2V follows the mp3 up to **180s** (`src/lib/ltxDuration.ts`). That is our Comfy Cloud template, not the public I2V table. Do not clamp talking clips back to 10s from this page.

The 2.3 blog’s “short prompt / long video rushes the action” still applies: a 70s Jack verse or a long Skidmarks rant with one `NAME says: "…"` and `Camera holds` is **under-directed** by their own 2.3 advice.

---

## What we send today (not changing)

`buildSpeakingMotion` in `src/lib/mobileImageMotion.ts` is the First Fleet gold shape:

1. `Use the provided start image as the first frame.`
2. `NAME, look lock is prominent, mouth and head move…`
3. Only those people. Nothing new enters frame. No readable text.
4. `NAME says: "line"`
5. `Camera holds. Same person and objects…`
6. Per-style look lock
7. On send: `LTX_LIP_SYNC_LEAD` prepended (`dication` spelling kept)

That gold **worked 100%** on Sunny First Fleet Cloud. Official I2V says “don’t redescribe the still.” We redescribe look + lock because strangers walked into plates when we only sent `NAME says:`. **Keep the locks.** Official verbs can sit **next to** them later. Not now.

`Camera holds` = their “static frame” / “fixed frame”. Fine for a talking MCU. Do not add push-in / orbit on a talking plate unless Stuie asks — that is how faces drift.

---

## Gap list (log only — no fix in this file)

| Official ask | Our send | Safe? |
|---|---|---|
| Write the soundtrack | We must **not** — mp3 is the track | Keep empty |
| Break long speech into acting beats | One `says: "whole line"` | Log. Do not rewrite gold / Forgotten |
| Prompt as long as the clip | Same short paragraph on 15–180s clips | Log. Biggest 2.3 mismatch |
| I2V = verbs, not the still | We redescribe look + locks | Keep locks. Verbs later |
| 4–8 sentences, one event | Gold is ~8 lock sentences + one speak | Close enough for short takes |
| Physical acting, not “sad” | “mouth and head move naturally” | Generic, not wrong |
| 2.5 multi-shot cuts | Not on 2.3 IA2V | Do not add |
| `[VISUAL]` / `[SPEECH]` | Not in official 2.3/2.5 guides | Stay off `/m`. Desktop tag path is the old one |
| Prompt enhancer | Not in our Cloud IA2V patch | If Cloud ever adds it, off for gold |
| Dub-It `saying:` | Different product | Do not swap |

---

## Per style (from the five-style audit — still NOT SHIP)

Nothing here makes a style ship. Prompt research only.

- **Skidmarks 15–30 min** — long rants are exactly where 2.3 says “short prompt / long clip rushes.” Acting-beat split would be the experiment. Not on live Crazy Big Hole jobs.
- **Sunny Banks 5–10 min** — gold shape stays. Official I2V “don’t redescribe the still” must not strip the cel lock or first-frame lock.
- **Music video 5–10 min** — people floor: no invented audio, no 2.5 cuts, Jack face stays hidden. Concert mute floor: 2.5 I2V verbs + camera, **mute** the invented soundtrack.
- **Documentary / Photoreal** — official “handheld / interview / physical cues” fits talking heads. Still no gold and no `/m` run at 15–30 min.

---

## Next (only if Stuie says go)

1. One **new Scratch** take, not a live pack: same plate + mp3, gold locks **kept**, add 2.3 acting beats inside a long line. Compare.
2. Do not touch Forgotten who-plays, First Fleet gold JSON, or Mouth of the Hole.
3. If a mute concert still is ever sent: 2.5 I2V motion verbs, no IA2V, no Saved mp3, no crowd audio in the prompt if Resolve is the mix.

Pulled copies of the official markdown sit next to this log in the agent artifacts for this run. The live URLs above are the source of truth if they change.
