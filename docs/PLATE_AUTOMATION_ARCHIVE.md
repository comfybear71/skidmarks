# Plate / clip automation archive

Logged **2026-08-19**. Living list of what we can know before send. Append when Scratch or `/m` proves a new Pass or Fail. Do **not** write these onto a live pack unless Stuie says **go**.

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
| Too short (~&lt;4s, tiny “yes” / “oi”) | Mouth never really lip-syncs. LTX floor is 2s — that is a clamp, not a quality window. | Write a full sentence that lands **4–6s** (~10–15 words at 2.5 wps). |
| Sweet | **4–6s / ≤15 words** on one still | Send gold speaking motion. |
| Rant on one clip (~&gt;6s / &gt;15 words) | LTX holds the plate then **walkers enter** (logged ~7s into a 39s rant) | `splitSpokenRant` — same plate, new mp3 per sentence chunk. Words stay Stuie's. |

180s is a safety ceiling, not a quality window.

---

## Character slipping (the worry)

The still turning cartoon or “a real human” is a **Scratch Draw** failure (slider / show lock), not a speech failure. On `/m` clips the same face-change happens if CAST bio leaks into IMAGE MOTION, or if the start image is not locked. Fix the still on Scratch first; then speak on `/m` from that still.

---

## How we keep building this

1. Scratch Draw → score Pass / Fail / Style slip → CSV.
2. `/m` Save line → Generate on Cloud IA2V → note short / ok / rant-split.
3. Append a row here (and in `src/lib/plateAutomationArchive.ts`) only when a result is proven. No live-pack rewrite.
