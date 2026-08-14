# Skidmarks — later (logged, not now)

Logged **2026-08-06** after cafe plating worked 100% better with stylised location plates + characters on top (not photo BGs).

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

## 5. Shot Desk — KEEP (day-to-day)

**Logged 2026-08-06:** this is what we **want** on the beat after the plate is made elsewhere:

| Keep | Job |
|------|-----|
| **IMAGE — [VISUAL] / [SPEECH]** | Comfy IMAGE prompt under the plate |
| **TEXT — line for mp3** + Rebuild / player | ElevenLabs voice · v3 tags OK |
| **SEGMENT TEXT — action** | Add Text body action after the talk IMAGE (when needed) |

Plate still drops onto the beat (from image gen / own still) — not built from PLATE PROMPT AI anymore.

**No code yet** — when we slim the UI, keep these; cut §3–§4 junk.
