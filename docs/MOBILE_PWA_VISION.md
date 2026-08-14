# Mobile / PWA — a different app, not a shrunk desktop (logged, not now)

Logged **2026-08-14** from Stuie's brief after Stage 3 (voice) shipped. **No code yet — plan + build only when Stuie says go.**

## The core idea

The desktop Crash Lab (`/crash`) is a producer's workbench — panels, toolbar, manual drag/drop, multiple episodes on shelves. **The mobile/PWA version is not a cut-down version of that.** It's a separate, purpose-built app for one thing: turn a prompt into a finished short automatically, full-screen, on a phone.

- **Desktop/PC stays exactly as it is.** This is additive, not a redesign of `/crash`.
- Same backend engine both ends (script parsing, image gen, compositing, voice, Comfy animation) — mobile is a different *frontend* and a different *orchestration* over the same primitives, not a rebuilt engine.
- Likely also the right shape for iPad. Desktop/PC keeps the panel workbench.

## The flow (as described)

1. **Prompt.** User taps a big "New" style button, optionally pre-filling a script, a scene description, or a bare word/idea. Claude/the pipeline decides what it needs from there.
2. **Cast.** Pipeline auto-generates candidate characters; user swipes through a **full-screen carousel** to accept/reject/pick.
3. **Location.** Same carousel pattern for the place the scene happens.
4. **Plate.** Cast placed onto the location automatically (no manual drag — see "What already exists" below).
5. **Script/dialogue.** Screenplay/lines auto-written for the cast in that location.
6. **Voice.** A voice auto-cast and generated per character/line.
7. **Animate.** Plate + audio sent to Comfy (LTX) automatically to produce the moving clip — "can even be automated up to Comfy UI if the prompts are correct."
8. **Export.** Save to the phone, to cloud, or share/post directly.

Style spans **cartoon to photoreal/cinematic**. Duration spans **~1 minute to 20–30 minutes**. Every step above is meant to run without the user touching a settings panel — the carousels are the only manual touchpoint, and even those could eventually be skippable ("automated up to Comfy").

## What already exists and is directly reusable

Nothing here needs inventing from scratch — the hard AI pieces are built and working today, just triggered by hand via desk panel buttons instead of chained automatically:

| Stage | Existing code |
|---|---|
| Script/prompt → cast + scenes | `scriptParser.ts`, `scriptToStory.ts`, `scriptImport.ts` (Stage 0). Also `cursorPromptBuild.ts` / CURSOR·PROMPT already build an episode shell from a short prompt today — closest existing precedent for step 1. |
| Character + location images | `scriptImageGen.ts` (Stage 1) |
| Cast-onto-location plate | **`plateCastIntoGen()`** (`src/lib/plateCast.ts`) — the *AI* compositor, still live (used by `cursorPopulate.ts`, `/api/crash/story/gen-plate`). Note: Stage 2 built a **manual** drag/scale compositor for desktop by Stuie's explicit choice — mobile automation should call the AI path instead, not the manual one. |
| Voice casting + line generation | `scriptVoiceGen.ts`, `crashVoice.ts`, `crashStorySpeak.ts` (Stage 3) |
| Animate (plate + mp3 → mp4) | Comfy/LTX pipeline already wired (`/api/crash/comfy/ltx`, the existing Animate panel) |

## Real gaps — what's actually new work

1. **An end-to-end orchestrator.** Today every stage above is a separate button a human clicks in sequence on the desk. Nothing chains "prompt in → finished mp4 out" automatically. This is the biggest genuinely new piece.
2. **An actual PWA.** No manifest, no service worker, no installability today — confirmed nothing exists yet. Needed for "save to phone" / add-to-homescreen to feel real.
3. **Save/share out.** No download-to-device or Web Share integration exists yet.
4. **The carousel UI itself.** Full-screen, swipeable, one-thing-at-a-time — a new component family, deliberately not reusing the desktop panel components.
5. **Screenplay-from-a-word generation.** The pipeline today *ingests* an already-written script well; going from a bare one-line idea to a full multi-scene screenplay automatically is a step up from what CURSOR/PROMPT does today and needs its own design pass.
6. **Quota reality check.** ElevenLabs is capped at 95 voice-designs/month (tracked as of Stage 3) and image gen has its own real costs — a fully automated phone flow that casts + generates on every run will burn through that fast. Needs a deliberate budget/guardrail design (e.g. only design a new voice once per character ever, reuse aggressively, maybe a per-run cost estimate shown before Comfy kicks off) before this goes live to real users.

## Bottom line

Not a dream — every AI capability described already exists and works in this codebase. What's missing is the automated glue between stages, a real installable PWA shell, and a new full-screen mobile UI. That's a genuinely large build, but it's assembly + new frontend, not new AI research.
