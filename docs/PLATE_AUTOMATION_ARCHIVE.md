# Plate / clip automation archive

Logged **2026-08-19**. Living list of what we can know before send. Append when Scratch or `/m` proves a new Pass or Fail.

**Two floors:** this file is **lip-sync / speaking plates**. Mute cinema (picture to music, mouths shut) lives in [`MUTE_CINEMATIC_ARCHIVE.md`](./MUTE_CINEMATIC_ARCHIVE.md). Do not mix the send paths.

## Owner intent — Scratch first, then `/m` (2026-08-19)

Stuie's goal: **lessons from Scratch testing** should feed a **simple-prompt path on `/m`**, not the other way around.

- **Do not** batch 100 LTX / Generate runs on untested still prompts or scenarios — artifacts and hallucination already ruined too much art.
- **Do** hammer stills on `/scratch` (cheap Draw, history restore to pad, Pass/Fail score, CSV export) until a prompt + pose + wardrobe combo **passes**.
- **Only then** use that proven still + gold IMAGE MOTION wording on `/m` for speech / lip-sync.
- Scratch = identity, pose, wardrobe, style slip, place lock. `/m` = mp3, speaking motion, rant split, clip chain — **not** a place to discover whether the still prompt works.

Better end state (not built yet): promote Scratch **Pass** rows into Prompt bible chips + a small `/m` “use proven kit” picker — never auto-run LTX on un scored prompts.

**Go (2026-08-19):** wire these into `/m` send and still Draw. Do **not** rewrite live pack `story_json` (First Fleet gold stays as logged). Never Close / New episode / clear Story.

Wired now:

- Missing face → refuse the plate (no partial cast).
- `/m` Save still splits rants, including run-on sentences with no period (≤15 words per clip).
- Cloud IA2V pads speaking clips to **4s** so short gold lines (Fair call) keep their words and still have mouth frames.
- Split speech: clip 1 uses the plate; clip 2+ uses the **previous clip's last frame** as the start still.

Scratch stays stills-only. Speech stays on `/m`.

No prompt template makes the image model succeed 100% of the time. Unattended 100% means: **fail closed** on known-bad kit, **Scratch Pass** before promoting a still prompt, **`/m` Pass** before promoting a speaking clip.

---

## Two benches — do not mix

| Surface | What we test | What we do not test (yet) |
|---|---|---|
| **Scratch** `/scratch` | Still Draw: identity lock, cartoon/human slip, 1-character pose, place + face card | Speech, Saved mp3, lip-sync, rant length |
| **`/m`** | Speech, mp3, Cloud LTX-2.3 IA2V (`workflow/LTX_2.3_IA2V_Cloud.json`), short vs rant | Promoting untested still prompts from Scratch |

Scratch Generate / LTX box exists in the UI, but **speech has not been run there**. Keep it that way until Stuie opens it. Style-slip worries belong on Scratch stills. Lip-sync / hallucination belong on `/m`.

---

## Scratch — 1 character still

**Works:** own stylised place + **one** face card. MCU, facing camera, only that person.

```
Medium close-up of [NAME] at [PLACE]. Upper chest and face fill the frame.
[NAME] is sitting at [PLACE], weight grounded. Facing camera, mouth clear.
Empty hands in her lap. No phone.
Only [NAME] in frame. No other people.
```

(`compileScriptedPosition` — bed/bedroom/cell swaps in “butt on the mattress”.)

**Style lock:** keep the Draw slider on the **original plate**. Slider 0–35 forces cel 2D even on a Skidmarks 3D still (cartoon slip). High slider pulls a cartoon still toward photo-human. Never mix Sunny Banks cel wording onto a Skidmarks plate.

**Never:** 4-view character sheet as the face ref (doubles). Photo street as locked BG. CAST bio in the still prompt.

Score fails with **Style slip** (cartoon / human / photoreal drift) plus Face / Anatomy as today. Export CSV. Promote only Pass.

---

## `/m` — speech min / max (not Scratch)

Cloud Comfy path: **LTX-2.3 IA2V** — plate still + mp3 + one IMAGE MOTION paragraph. Nodes live in `ComfyUI-LTXVideo` (`LTXVImgToVideoInplace`).

**Best speaking prompt** (First Fleet gold, 100% on `/m` Cloud):

```
Use the provided start image as the first frame. [NAME], [short look] is prominent, mouth and head move naturally while speaking, subtle gesture. Only [NAME] in frame, no one else appears. Props and background stay exactly as the start image, nothing new enters frame. [NAME] says: "[line]". Camera holds. Same person and objects as the start image. [show style lock]
```

Lip-sync lead is prepended on send. No `[VISUAL]`. No `[SPEECH]`. Look lock = hair/clothes/props, **not** CAST bio.

| Line | What happens | Fix |
|---|---|---|
| Too short (~&lt;4s, tiny “yes” / “oi” / gold “Fair call”) | Mouth starved of frames if the clip follows the mp3. | Keep the words. Cloud IA2V pads to **4s** (camera holds). Prefer 4–6s when writing new lines. |
| Sweet | **4–6s / ≤15 words** on one still | Send gold speaking motion. |
| Rant on one clip (~&gt;6s / &gt;15 words) | LTX holds the plate then **walkers enter** (logged ~7s into a 39s rant) | `splitSpokenRant` — new mp3 per chunk (sentences, then word cap). Clip 1 = plate; next clips = previous last frame. Words stay Stuie's. |

180s is a safety ceiling, not a quality window.

Official Comfy **LTX-2.5 FLF2V** ([Hub d78377cf53f4](https://comfy.org/workflows/d78377cf53f4-d78377cf53f4/)) is **two stills → in-betweens + invented audio**. It is not `/m` Generate. Full node map: `docs/LTX_25_FLF2V_RESEARCH.md`.

---

## Two or more on one card — not covered by this floor

The gold speaking shape above is **solo**. Counted in `SUNNY_BANKS_IMAGE_MOTION_GOLD.json`:
100 beats, 37 speaking, and **0 speaking beats with two or more people in frame**.
All 16 group beats are holds (`All mouths stay closed.`). There is a proven group
**hold** and no proven group **speak**.

So a two-hander with a spoken line is outside this floor entirely — both the still
(headcount / prop locks are dropped for 2+) and the clip (nothing tells the listener
to keep their mouth shut; the lip-sync lead is frame-wide). Diagnosis, evidence and
the candidate fixes to score: [`SUNNY_BANKS_MULTI_CHARACTER_RESEARCH.md`](./SUNNY_BANKS_MULTI_CHARACTER_RESEARCH.md).

Cheapest reliable answer until something scores: frame two-handers **over-shoulder**
so only the speaker's mouth is in frame — that reduces to the solo case that already
works 100%.

---

## Character slipping (the worry)

The still turning cartoon or “a real human” is a **Scratch Draw** failure (slider / show lock), not a speech failure. On `/m` clips the same face-change happens if CAST bio leaks into IMAGE MOTION, or if the start image is not locked. Fix the still on Scratch first; then speak on `/m` from that still.

---

## How we keep building this

1. Scratch Draw → score Pass / Fail / Style slip → CSV.
2. `/m` Save line → Generate on Cloud IA2V → note short / ok / rant-split (last frame chains).
3. Append a row here (and in `src/lib/plateAutomationArchive.ts`) only when a result is proven. Do not rewrite a live pack's `story_json`.
4. Mute cinema Pass / Fail goes in [`MUTE_CINEMATIC_ARCHIVE.md`](./MUTE_CINEMATIC_ARCHIVE.md) (`layer: "mute"`), not here.

LTX-2.5 FLF2V research (knowledge, no send-path change): `docs/LTX_25_FLF2V_RESEARCH.md`.

Comfy Cloud animation map (Wan-Move, Wan Animate, AnimateDiff, FLF2V, SCAIL2, LTX Director vs our IA2V): [`COMFY_ANIMATION_RESEARCH.md`](./COMFY_ANIMATION_RESEARCH.md).
