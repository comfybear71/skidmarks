# Sunny Banks — two-or-more on one card

Logged **2026-08-27**. Diagnosis of the two failures Stuie reports on Sunny Banks:
**positioning / staging adding artifacts**, and **lip sync going wrong when two or
more people are in the shot**. Third section covers what a **10-minute episode**
actually costs.

**Status:** F4, F6 and F7 are now **built** (see each section) — F4 and F6 are
prompt changes that still need a Scratch score before they count as gold; F7 only
stops information being discarded. F1, F2, F3, F5 and F8 are still candidates.

**This is not new gold.** No wording here has been through a model yet. Every claim
below is a *code* fact — the exact prompt strings the pipeline builds, printed and
checked. The proposed shapes in "Fixes to test" are **candidates**, not proven
wording. Do not write any of it onto a live pack until Scratch and `/m` score it,
per [`PLATE_AUTOMATION_ARCHIVE.md`](./PLATE_AUTOMATION_ARCHIVE.md).

Proven gold stays where it is: [`SUNNY_BANKS_IMAGE_MOTION_STANDARD.md`](./SUNNY_BANKS_IMAGE_MOTION_STANDARD.md)
+ `SUNNY_BANKS_IMAGE_MOTION_GOLD.json`. Do not rebuild those.

---

## The root finding: the gold is a solo corpus

`SUNNY_BANKS_IMAGE_MOTION_GOLD.json` is the run marked "worked 100%". Counted:

| | beats |
|---|---|
| Total | 100 |
| Speaking (`NAME says:`) | 37 |
| Non-speaking (hold / insert) | 63 |
| **Speaking beats with 2+ people named in frame** | **0** |
| Hold beats with 2+ people named in frame | 16 |
| Speaking beats containing any listener / mouth-closed rule | 0 |

The "100%" is true **and** scoped. In the whole proven corpus, **two people are
never in frame while one of them talks.** Every group beat is a hold with
`All mouths stay closed.` Every speaking beat is one person alone.

So the standard documents a **group hold** shape and has **no group speak shape**,
and the code matches: `buildGroupHoldMotion` exists, and the speaking builder is
still called `oneCharacterSpeakingMotion` in the archive. The moment a Sunny script
puts Bazza and Dazza on one card and gives Bazza a line, the episode is outside
everything that was ever proven, and there is no shape to fall back to.

That is the honest answer to "why does it fail with two or more": **nobody has built
the two-hander yet.** Not a regression — a gap.

---

## Failure 1 — staging / positioning adds artifacts

### 1a. Every anti-extra lock is dropped the moment there are two people

`plateCastStagingNote` (`src/lib/mobilePlateLines.ts`) branches on `solo`. Printed
from the real function, same shot, one name vs two:

**Solo (Nan)** — five separate guards:
```
… Only Nan in frame, no one else appears. Nan is the only person. Empty of extra
people and animals. Do not invent anyone else. … One body in the room — sitting,
leaning, or standing as staged.
```

**Two-hander (Bazza + Dazza)** — the guards are gone, replaced by one line:
```
… Ranger Bazza is prominent if this is their line. … Bodies in the room — sitting,
leaning, mid-stride, using the bar or furniture.
```

Three things are wrong at once:

- **The headcount is never stated.** Solo says "the only person" four different
  ways. Two-hander never says "two". Nothing in the prompt caps the body count.
- **`is prominent if this is their line` is a conditional the image model cannot
  evaluate.** There is no line at plate time — the still is drawn before any beat
  is picked. So the one sentence meant to place the subject resolves to nothing.
- **`Bodies in the room` is plural and open-ended.** Read as an instruction, it
  invites more bodies.

Exactly when the model most needs the count pinned — several figures to place —
the prompt drops every guard it uses when placement is trivial.

### 1b. `Camera: wide three-shot` on a two-face shot

`SUNNY_CAMERAS` offers `wide three-shot` and `over-shoulder two-shot`. The script's
`Camera:` line is copied verbatim into staging by the paste parser
(`Cast: … . Camera: wide three-shot. …`). With two faces supplied and no headcount
lock (1a), the prompt literally asks for a three-shot and the model supplies the
third body. The camera vocabulary and the cast list are never cross-checked.

### 1c. "holds a whistle" silently becomes "Empty hands"

`stagingNamesHeldProp` decides whether the staging already named a prop. It matches
only: the literal words `racket|pie|phone|mobile`, the gerund `holding`, or
`in her/his/their hands`. Printed:

| Plate line | Detected? | What gets appended |
|---|---|---|
| `Bazza holds a whistle up.` | **no** | `Empty hands. No phone. … Do not invent props.` |
| `Bazza holding a whistle up.` | yes | `Only the held object named in the position.` |
| `Nuggets holds a meat pie.` | yes | (matched on the word "pie", not the grammar) |
| `Shazza has a cigarette.` | **no** | `Empty hands. … Do not invent props.` |
| `Nan sits with a teacup in her hands.` | yes | `Only the held object named in the position.` |

`holds` is the natural way to write it and it fails; `holding` passes. So a normal
Plate line produces a prompt that says **"Bazza holds a whistle up"** and
**"Empty hands … Do not invent props"** in the same paragraph. The model resolves
the contradiction however it likes — prop vanishes, prop duplicates, or a hand
melts around it.

`Shazza has a cigarette` is the weaker case — a cigarette in the mouth is not
"in anyone's hands", so `Do not invent props` is a tension with her gold look lock
rather than a flat contradiction. Left unsolved: `has a` and `with a` are too loose
to add to the detector (they match "has a grin", "with a smile") and widening to
them would punch a hole in the no-props floor.

### 1d. Three faces = two chained generative passes

`PLATE_FACES_PER_PASS = 2` (`src/lib/plateConstants.ts`). `compositeShotPlate`
batches the cast and chains: pass 1 composites A+B onto the location, then pass 2
takes **that rendered image** as its background and composites C onto it.

Pass 2 re-renders the whole frame, A and B included. They were never locked as
finished pixels — they are just part of a background the model is free to redraw.
That is a structural drift source: faces shift, wardrobe changes, bodies double.
The `SUNNY_MAX_FACES = 3` warning I surfaced on the create card is really a
"this shot needs two generative passes" warning.

### 1e. The QA already catches this and the Sunny cook throws the answer away

`judgePlateStill` runs a `peopleCount` check — *"Exactly N distinct people in frame.
No clones of the same face. No extras."* — and retries up to
`PLATE_QA_MAX_ATTEMPTS = 3`. It works. It is looking for exactly this bug.

Then `runSunnyAutoStep` does this on a failed proof that still produced a file:

```ts
shots: rebuilt.job.shots.map((s) =>
  s.shotId === unplated.shotId ? { ...s, error: "" } : s,
),
```

It **clears the shot's error**. Walking on rather than killing the episode is the
right call (`sunnyAutoKeepsFailedProof` is deliberate). Wiping the verdict is not.
The pipeline knows which plates came back with the wrong number of people, and
deletes that knowledge before anyone can look at it. On a 10-minute episode with
~60 plates, that list *is* the review surface.

---

## Failure 2 — lip sync with two or more

Printed from `buildDefaultBeatMotion` → `ltxSendPrompt`, two people on the card,
Bazza speaking:

```
perfect lip sync, clear lip movement, citing the dialogue clearly, facial
expressions and hand gestures are lively, dication is perfect. Use the provided
start image as the first frame. Ranger Bazza, portly park ranger, oversized Akubra,
high-vis vest is prominent, empty hands stay as the start image, no phone, mouth and
head move naturally while speaking, subtle gesture. Only Ranger Bazza and Dazza in
frame, no one else appears. Props and background stay exactly as the start image,
nothing new enters frame. … Ranger Bazza says: "Ten bucks and the turkeys are gone."
Camera holds. Same person and objects as the start image. …
```

The frame lock is right — `Only Ranger Bazza and Dazza in frame` correctly names
both. Everything about *who talks* is wrong:

- **Nothing tells Dazza to keep his mouth shut.** The group *hold* shape has
  `All mouths stay closed.` The group *speak* shape has no listener rule at all
  (0 of 37 gold speaking beats contain one — there was never a two-hander to need
  it). Both faces are in frame, one audio track is attached, and nothing
  distinguishes them.
- **The global lead is frame-wide.** `perfect lip sync, clear lip movement, citing
  the dialogue clearly, facial expressions and hand gestures are lively` is
  prepended to every send with no subject. Read against a two-face frame it is an
  instruction for *both* faces to lip-sync the line. This is the single most likely
  cause of the reported double-mouthing.
- **`is prominent` is the only speaker binding, and it is not spatial.** No
  left/right, no foreground/background, no "the one in the high-vis vest". Two
  rubbery cartoon bodies with big heads are exactly the case where a
  non-spatial binding slips onto the wrong face.
- **`segmentText` is `Ranger Bazza delivers the line, subtle lean and gesture`** —
  names the speaker, says nothing about the listener.

### The architectural point

Our send is *one mp3 + one whole-frame text prompt*. There is no per-face audio
routing and no face selection. The comparable tools that do this reliably
(e.g. [Dzine's multi-face lip sync](https://www.dzine.ai/tools/multiple-lip-sync/))
work the other way round: you take one image with several characters, **pick which
face animates**, and attach audio **to that face**. Face selection is an input to
the model, not a sentence in a paragraph.

We cannot select a face on LTX-2.3 IA2V. So a two-hander has to be won in one of
two ways, and they should be tested in this order:

1. **Prompt-side** — make the paragraph do the disambiguation (cheap, testable now).
2. **Shot-side** — stop asking. Frame the two-hander so only one mouth is visible.

---

## Fixes to test (candidates — none proven)

Ordered cheapest-first. Each is falsifiable on `/m` with one clip.

### F1 — Listener lock on the group speak shape *(highest value, lowest cost)*

Add to `buildSpeakingMotion` when `shotSpeakers.length > 1`, mirroring the wording
the group hold already proves:

```
Only [SPEAKER]'s mouth moves. [OTHERS] listen in silence, mouths closed, no
speaking, no mouth movement. [SPEAKER] is the only one talking.
```

The `All mouths stay closed.` phrasing is already gold-proven in the 16 group hold
beats — this is the same sentence pattern with one mouth exempted, which is why it
is the first thing to try.

### F2 — Subject the lip-sync lead

`LTX_LIP_SYNC_LEAD` is frame-wide. For a multi-face beat, send a subjected variant:

```
perfect lip sync on [SPEAKER] only, clear lip movement on [SPEAKER], citing the
dialogue clearly, …
```

Keep the gold spelling (`dication`) — the corpus that worked used it, so do not
"fix" it while testing something else. Change one variable at a time.

### F3 — Spatial anchor from the plate

`is prominent` is not a position. The plate's staging already says where people are
(`Bazza holds a whistle up. Dazza leans on the rail.`). Carry a position word into
the motion prompt — `on the left`, `in the foreground`, `nearest camera` — derived
from the staging, so the binding is geometric rather than nominal.

### F4 — Headcount lock on the still, matching solo

In `plateCastStagingNote`, give the multi-person branch the same strength the solo
branch has:

```
Exactly [N] people in frame: [A], [B]. No one else appears. No extras, no walkers,
no animals. Do not invent anyone else. Do not draw the same face twice.
```

`compileConstructionStillPosition` already emits
`Exactly N people in frame: …. No extras.` — but only on the Skidmarks
`[VISUAL_ACTION]` path, which a Sunny script never takes. The sentence exists; it
just never reaches Sunny.

**BUILT, unscored.** Sunny two-handers now get
`Exactly [N] people in frame: [A], [B]. No one else appears. No extras, no walkers,
no animals. Do not invent anyone else. Do not draw the same face twice.` in place of
the conditional. Solo is untouched; other shows are untouched. **Needs a Scratch
score.**

### F5 — Cross-check the camera word against the cast count

`Camera: wide three-shot` with two names is a contradiction the parser should not
pass through. Either drop the camera word to the cast count, or flag it on the
create card next to the over-cast warning.

### F6 — Widen `stagingNamesHeldProp` — **BUILT, unscored**

Sunny only: `holds`, `grips`, `clutches`, `carries`, `cradles`, `waves`, `raises`
now read as a named prop, so a normally-written Plate line stops getting
`Empty hands` stapled onto it. `has a` / `with a` deliberately stay out — they
match "has a grin" and would punch a hole in the no-props floor. An explicit
`Empty hands` in the Position still wins, as before. Every other show is byte-for-byte
unchanged. **Still needs a Scratch score before it is gold.**

### F7 — Keep the QA verdict — **BUILT**

`MobileShotUnit.qaFails` records which checks the kept take failed. Make still keeps
the still and walks on (a red proof must not kill the episode) but no longer clears
the answer, and a later take that passes proof clears the stale verdict. When the
cook finishes, `sunnyPlateProofNote` says *"9 of 62 plates were kept but failed proof
(peopleCount ×7, sameFace ×2). The episode is finished — look at those stills."*
A clean run says nothing.

This one is not a prompt change, so there is nothing to score — it only stops
information being thrown away.

### F8 — Shot-side: write two-handers as over-shoulder

If F1–F3 do not hold, stop fighting it. `SUNNY_CAMERAS` already has
`over-shoulder` and `over-shoulder two-shot`. Framed over the listener's shoulder,
**only the speaker's mouth is in frame** — the model cannot animate a mouth it
cannot see, and the shot reads as a conversation. This is the reliable answer and
costs nothing but a camera word in the script. A group *reaction* shot then stays a
hold (mouths closed), which is already proven gold.

---

## The 10-minute episode

Numbers from the code, not estimates:

| Constant | Value | Source |
|---|---|---|
| Speaking clip sweet spot | 4–6s | `LTX_LIPSYNC_MIN_SEC`, `LTX_RANT_HOLD_SEC` |
| Words per speaking clip | ≤ 15 | `LTX_RANT_MAX_WORDS` (2.5 words/sec × 6s) |
| Silent hold clip | 8s | `SUNNY_HOLD_SEC` |
| Safety ceiling | 180s | `LTX_MAX_DURATION_SEC` — a stop, not a window |
| Faces per composite pass | 2 | `PLATE_FACES_PER_PASS` |
| Plate QA attempts | 3 | `PLATE_QA_MAX_ATTEMPTS` |

600 seconds at a realistic 70/30 speech-to-hold mix (`0.7n×5s + 0.3n×8s = 600`):

- **~100–120 clips.** Every one a separate Cloud LTX cook.
- **~85 speaking clips × 15 words ≈ 1,250 spoken words, hard ceiling.** That is
  the real script constraint for a 10-minute Sunny episode. Longer speeches do not
  buy length — they split into more clips at the same 15-word cap.
- **~50–60 shots** at ~2 lines a shot, so ~50–60 plates to draw.
- **~250 sequential `/step` calls** (plates + faces + places + voices + clips). The
  cook does exactly one unit of work per call by design.

### What that means

At 120 clips, **the per-clip failure rate decides whether the episode exists.** A
5% failure rate is 6 broken clips; 20% — plausible today for two-handers, since
they are outside the proven corpus entirely — is 24 broken clips in one episode.

So the binding constraint on a 10-minute Sunny Banks episode is **not** pipeline
speed, and not the 180s ceiling. It is Failure 1 and Failure 2 above. Fixing the
two-hander is what makes 10 minutes reachable; nothing else on this page matters as
much.

Two structural notes that follow from the arithmetic:

- **Solo shots are the cheap path.** A solo speaking clip is proven gold at 100%.
  Every two-hander converted to over-shoulder (F8) moves a clip from "unproven"
  to "proven" at zero model cost.
- **Stitch is out** (house rule). A 10-minute episode is ~120 ordered unstitched
  mp4s. `orderedJobClips` numbers them by story shot order — which is why the
  script-order fix landed first; at 120 clips an out-of-order zip is unusable.

---

## What to test, in what order

Per the two-bench rule in [`PLATE_AUTOMATION_ARCHIVE.md`](./PLATE_AUTOMATION_ARCHIVE.md)
— Scratch for stills, `/m` for speech. Do not batch.

1. **Scratch**: one two-person still with F4 (headcount lock) vs without. Score
   `peopleCount`. This is a still problem before it is a speech problem.
2. **Scratch**: F6 held-prop wording — "Bazza holds a whistle up" with and without
   the `Empty hands` injection.
3. **`/m`**: one two-hander clip, F1 alone. Does the listener's mouth stay shut?
4. **`/m`**: if F1 is not enough, add F2, then F3. One variable per run.
5. **`/m`**: F8 over-shoulder as the control — it should pass first time, because
   it reduces to the proven solo case.

Append a row to `PLATE_AUTOMATION_ARCHIVE.md` and
`src/lib/plateAutomationArchive.ts` **only** when a run scores it. Until then
everything above stays a candidate.

---

## Open — the reference Stuie sent

Stuie linked an X post (`Framer_X`, status `2092682249124593844`) as an example of
someone doing this easily. **This VM cannot open x.com — the network egress proxy
blocks it, so the post and its video have not been read.** Nothing in this document
is derived from it, and nothing has been guessed about it.

To use it: paste the post text, and the prompt / workflow / tool names shown in the
video, into chat. The things worth pulling out are exactly the ones this page is
short on:

- Is it one shot per speaker (over-shoulder / cutting), or two mouths in one frame?
- If two mouths in one frame — is face selection an input to their model, or is it
  done in the prompt?
- One audio track per clip, or per-face audio?
- Clip length and how a 10-minute run is assembled.

Public search suggests Framer_X has posted about full AI sitcom workflows with
consistent characters and voices, but that is a search summary, not the post, and
it is not evidence. Treat it as unread until pasted.
