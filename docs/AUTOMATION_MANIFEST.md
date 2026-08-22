# Automation Manifest

What each build pipeline in this app actually calls, what it needs to run, and exactly where it stops short of finishing on its own — read straight from the code, not inferred. Every claim below traces to a file:line cited in the source.

## Who needs what

Six outside services, one switch. This is fixed by the code — not by which keys happen to be set in any one environment right now.

| Service | Env var | Used by |
|---|---|---|
| XAI Grok Imagine (stills) | `XAI_API_KEY` | `/m` candidates + plate QA · Scratch fallback Draw · Cursor faces/places/plates · Prompt plates |
| ElevenLabs (voice + SFX) | `ELEVENLABS_API_KEY` | `/m` + Scratch voice gen · Cursor & Prompt voice-lock (reuse only) + speak + SFX |
| Siray (spicy stills / i2v) | `SIRAY_API_KEY` | Scratch Draw (preferred engine) · Scratch i2v clip generation |
| Comfy Cloud (LTX video — "the real animate backend") | `COMFY_CLOUD_API_KEY` | `/m` Animate · Scratch LTX clips · Scratch song cuts |
| Self-hosted Comfy (LTX fallback) | `COMFY_URL` | Same call sites, only when Comfy Cloud is absent |
| ffmpeg (stitching) | packaged binary or PATH | `/m` stitch · Scratch song-cut stitch · song slicing |
| Neon + Vercel Blob (cloud store switch) | `DATABASE_URL` + `BLOB_READ_WRITE_TOKEN` | All four — flips job docs + media from local disk to Neon/Blob. Needs **both**, on any host. |

`useCloudStore()` (`src/lib/cloudEnv.ts:20-27`) is the single switch — requires both `DATABASE_URL` and `BLOB_READ_WRITE_TOKEN`, regardless of host.

---

## 01 — `/m` Auto Studio

Cast and places are built freeform first, one face at a time. A script gets pasted in — by the human, not written by the model — then plates, voice, and Animate follow through nine phases to a stitched final cut.

**Stops short at:** the script itself. `screenplay/route.ts` says it outright: *"Grok does not write this."* Everything after a pasted script — plates, voice, Animate, Stitch — can run unattended once the keys below are set. Voice generation is also a deliberate manual tap (`Gen mp3`), by design, not a technical limit.

### Phase chain

1. **Cast / Location build** — no call. Names typed in one at a time; pure job-state edits.
2. **Cast / Location images** — `XAI_API_KEY` required. Swipeable candidate stills via `generateFaceImage()` — model `grok-imagine-image`, 90s timeout per image.
3. **Plates** — `XAI_API_KEY` required. Auto-composited per shot; rebuild/QA pass uses `askGrokVision` against the same key.
4. **Review** — `ELEVENLABS_API_KEY` required. Human edits lines, taps **Gen mp3**. Reuses a library voice before spending a Voice Design credit.
5. **Animate** — `COMFY_CLOUD_API_KEY` required. One clip at a time. Prefers Comfy Cloud; falls back to a reachable `COMFY_URL`.
6. **Stitch** — ffmpeg required. Per-clip mp4s concatenated with a stream copy — no re-encode.

### Exact stops, quoted from source

> "you write the episode (script + shots + beats) as one paste. We lock it onto the pre-built cast and places, then plates and audio follow. Grok does not write this."
> — `src/app/api/crash/mobile/screenplay/route.ts:11-13`

> "No Comfy Cloud key and no reachable COMFY_URL — set one to animate"
> — `src/app/api/crash/mobile/step/route.ts:69`

> "No packaged ffmpeg found and none on PATH — {why}. Looked in: {tried}"
> — `src/lib/mobileStitch.ts:93-98`

### Disk vs cloud

On Vercel, local disk is scratch that vanishes between requests — the job doc comment says so plainly: *"a job written to /tmp by one call is simply gone by the next."* That's why the Neon+Blob switch exists; it needs both env vars, on any host, to turn on.

---

## 02 — Scratch

A sandbox against one throwaway shot — guarded so it can never overwrite a real episode. Same underlying job document as `/m`, confined to a single synthetic slot.

**Stops short at:** nothing structural — this is the closest thing to a one-tap loop in the app. Draw → Save mp3 → Generate clip can run back-to-back once Siray (or Grok, as fallback) and Comfy Cloud/ElevenLabs keys are present.

### Step chain

1. **Ensure cast + place** — no call. Wires an approved face + place onto the one scratch shot.
2. **Draw** — Siray preferred (`SIRAY_API_KEY`, returns pending, client polls); falls back to the same Grok plate-compositing path as `/m` if absent.
3. **Save line / Gen mp3** — `ELEVENLABS_API_KEY` required. Same voice path as `/m` review.
4. **Generate clip** — engine picked client-side: LTX (`COMFY_CLOUD_API_KEY`) or one of four Siray i2v models (Seedance 2.0/2.5, Wan 2.7/3.0).
5. **Song cuts** — Comfy Cloud + ffmpeg. Multi-camera cut list against a dropped mp3, each cut through the LTX path, then stitched.

### Guardrails, quoted from source

> "Scratch will not rewrite a live episode shot. Park on the Scratch plate."
> — `src/app/api/crash/mobile/scratch/route.ts:633-638`

> "Scratch Draw does not silently fall back to XAI."
> — `.env.example`

Removed clips are parked in `_cleared/`, never deleted.

---

## 03 — Cursor (Crash Lab, magenta button)

"New CURSOR_ pack → Character → Cast → Places… you only click Proceed." An 11-step wizard against hardcoded demo data — tap through, it does the work at each stop.

**Stops short at:** Animate never sends to Comfy. The step only fills the LTX prompt fields into a local draft file — the code says so directly: *"Never sends LTX / Comfy."* The tour's own label admits it: *"Animate — LTX fields ready (no Send)."* Every run ends the same way: storyboard open, waiting for a human to hit Send. Script is not AI-written here either — it's assembled from a fixed local shot plan, no model call at all.

### Step chain

1. **Character / Cast / Locations** — `XAI_API_KEY`. Mints new faces/places if the resumed pack doesn't already have them.
2. **Voice / Cast voice** — `ELEVENLABS_API_KEY`, reuse only. Matches an existing library voice by name — never Voice Design. No match, no lock: hard stop.
3. **Scene kit / Script** — no call. Pure local assembly from a hardcoded shot plan.
4. **Plates** — `XAI_API_KEY` + `ELEVENLABS_API_KEY`. Composites cast onto locations, then speaks every beat — throws if a speaker has no locked voice from step 2.
5. **Animate** — draft only. Fills LTX fields into `_RECIPE/comfy-draft.json`. Does not render.
6. **SFX** — `ELEVENLABS_API_KEY`. Sound-generation call per SFX slot.
7. **Storyboard** — display only. Tour ends: *"Stop — {folder}. Storyboard open. You Save. Animate Send later."*

---

## 04 — Prompt (Crash Lab, acid-green button)

"Paste full script → next numbered episode folder." Take a template out to an external AI tool, get a script back, paste it in. From there it runs the same 11-step tour as Cursor.

**Stops short at:** two places. First, the parsing itself is deterministic — regex against `EPISODE:` / `--- SHOT N ---` blocks, no model call. Second, and stricter than Cursor: every cast name and place in the pasted script must already exist as a gallery face/card — Prompt cannot mint a brand-new character the way Cursor can. Animate ends the same draft-only way as Cursor — never sends to Comfy.

### Step chain

1. **Parse + bootstrap** — regex only. Mints the next numbered pack folder; every field is validated against your existing gallery, not generated.
2. **Character / Cast / Locations** — gallery reuse only. Resolves names to existing thumbnails — no fresh Grok Imagine call here.
3. **Voice / Cast voice** — `ELEVENLABS_API_KEY`, reuse only. Same reuse-only lock as Cursor.
4. **Plates** — `XAI_API_KEY` + `ELEVENLABS_API_KEY`. Same call chain as Cursor's plates step.
5. **Animate / SFX / Storyboard** — draft-only Animate, real SFX call, manual Send after. Identical tail to Cursor.

### Exact stops, quoted from source

> `Need EPISODE: line at the top (e.g. EPISODE: Laundry meltdown)`
> — `src/lib/cursorPromptBuild.ts:171`

> `SHOT ${idx+1}: unknown cast "${name}" for ${styleId}`
> — `src/lib/cursorPromptBuild.ts:238-244`

> `No gallery face for "${name}" in ${styleId}`
> — `src/lib/cursorPromptBuild.ts:305`
