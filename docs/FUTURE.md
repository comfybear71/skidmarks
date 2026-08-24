# Skidmarks — later (logged, not now)

Logged **2026-08-06** after cafe plating worked 100% better with stylised location plates + characters on top (not photo BGs).

---

## 0a. Vibe Director — remove a cast/place, tap thumb → character plate

**Logged 2026-08-16** on CRAZY BIG HOLE JO (`mgen_20260816055919862_906`). Stuie asked while the tree was already picked — **do not build this mid-episode. Write the script first.**

| Need | Why |
|------|-----|
| **Remove** a character or location from the CAST / LOCATIONS row | + only adds. A wrong name or a leftover has no way off the tree. Must not delete the still — park it. Must not wipe the job. |
| **Tap a picked cast thumb → series character plate** (the 4-view sheet), not a bigger profile pic | Profile is the pick still. The plate is the series lock (front / 3/4 / profile / back). If no plate exists yet, show the pick still and say the sheet is not made. |

**No code until Stuie says go after this episode's script.** Script path is now: template → AI draft on the locked cast/places → refine → lock (Crash Lab pack). Do not build remove-cast mid-episode.

---

## 0. Mobile / PWA — separate automated app, not a shrunk desktop

**Logged 2026-08-14.** Full brief in [`MOBILE_PWA_VISION.md`](./MOBILE_PWA_VISION.md) — a fully-automated, carousel-driven mobile/PWA experience (prompt → cast → location → plate → script → voice → Comfy animate → export), completely separate from the `/crash` desktop workbench, which stays as-is. **No code yet — plan + build only when Stuie says go.**

---

## 1. Image gen — multi-character plates

**Need:** Drop **1, 2, 3 or more** cast faces into image gen / Crash Lab plating and build a full shot plate in one go (location BG + people).

**Why:** Stylised empty place + Kim plated worked far better than photo streets or freehand photo-glam two-shots.

**Downstream hope (after that works):** Shot Desk can slim down — plate comes from that tool, so the day-to-day fill might shrink toward **audio (mp3) + IMAGE prompt** only (GLOBAL still for lips). Not deleting fields yet — earn it first.

---

## 2. Location plates — interiors & better places

**Need:** Location Lab plates good enough for **inside** places too — bank, cafe interior, lounge, etc. — same Skidmarks sculpted look as streets.

**Why:** Outdoor high street is usable now; bank / indoors still weak or wrong. Characters sit on the place — if the place plate is wrong, the shot plate fails.

**Rule already proved:** generate **our own** stylised location plates. Never lock a real photo as BG under cast.

---

## 3. Shot Desk — AI Nudge / Build-plate-from-prompt (not required anymore)

**Logged 2026-08-06 (Stuie's call): we don't need this path anymore.** No UI delete yet — just stop relying on it.

| Skip | Why |
|------|-----|
| **AI Nudge** (beat + **GLOBAL AI Nudge**) | Doesn't hold style; plates come from image gen / own stills now — empty Global nudge box not needed |
| **PLATE PROMPT → AI → Rebuild plate** as the main way to make shot plates | Drifted photo / wrong Kim; own stylised place + character plate wins |

**Keep using:** drop finished plate into the beat · mp3 · IMAGE `[VISUAL]`/`[SPEECH]` · GLOBAL · Comfy.

When we slim the UI later (see §1), these fields are candidates to hide or gut — **no code until Stuie says.**

---

## 4. Shot Desk — IMAGE / TEXT / ACTION / GAP seconds (not required anymore)

**Logged 2026-08-06:** don't need the beat timing boxes (**IMAGE SEC · TEXT SEC · ACTION SEC · GAP AFTER**) in the day-to-day flow anymore.

**Why:** Timing is set on the Comfy Director timeline to the mp3 / clip. Studio second boxes were for paste-sheet planning; they fight the real waveform now.

**No code yet** — leave the fields in the UI; stop filling them as gospel. Hide/remove when we slim Shot Desk.

---

## 4b. Music video — concert loop plates (Jack Ash)

**Logged 2026-08-24.** He wants looping gold/black concert art — the **Double Talkin' Jive** LED look from the **Bangkok Thunderdome** World Tour (golden skulls, metallic snakes, fire, hypnotic loops behind long guitar solos). **Not only band member stills.** Full study: [`CONCERT_LOOP_PLATE.md`](./CONCERT_LOOP_PLATE.md). Queue: [`JACK_ASH_QUEUE.md`](./JACK_ASH_QUEUE.md).

**Hold:** a few more video test runs, then implement. No generate, no node graph, until he says go. Speech stays LTX-2.3 IA2V. Loop motion is LTX-2.5 I2V, muted.

---

## 5. Shot Desk — KEEP (day-to-day)

**Logged 2026-08-06:** this is what we **want** on the beat after the plate is made elsewhere:

| Keep | Job |
|------|-----|
| **IMAGE — [VISUAL] / [SPEECH]** | Comfy IMAGE prompt under the plate |
| **TEXT — line for mp3** + Rebuild / player | ElevenLabs voice · v3 tags OK |
| **SEGMENT TEXT — action** | Add Text body action after the talk IMAGE (when needed) |

Plate still drops onto the beat (from image gen / own still) — not built from PLATE PROMPT AI anymore.

**No code yet** — when we slim the UI, keep these; cut §3–§4 junk.

---

## 6. Scratch — add your own Prompt bible chips (rapid iteration)

**Logged 2026-08-19.** PR **#185** removed the Frame / Body / Holding / … dropdowns from `/scratch`. **Prompt bible only** now — chips edit the prompt box; **Draw** is separate (~60s). Every old built-in dropdown preset was merged into the bible (Composition, Pose, Wardrobe, Props, Drama, Atmosphere, Crowd / multi).

| Need | Why |
|------|-----|
| **Add new chips** to the Prompt bible while Stuie rapid-iterates | Winners from the prompt box (undress ladder, pose locks, wardrobe lines) should be one tap next time — not retyped. Built-ins are frozen in code until we ship this. |
| **Save under a section** (Composition, Pose, Wardrobe, …) | Same accordion, same Append / Replace flow. Highlight picked chips like today. |
| **No auto-Draw on save** | Picking or saving a chip must **not** fire Draw — only edit the prompt until Stuie taps Draw. |

**Not now:** Stuie said he will concern himself with this later; keep testing bible-only `/scratch` first. When we build it, prefer browser-local or Neon-backed customs — not a return to dropdown rows that burn a draw per pick.
