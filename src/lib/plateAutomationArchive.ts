/**
 * Living archive of what will / won't work for unattended plates + clips.
 *
 * Surfaces (do not mix):
 *   Scratch `/scratch` — still Draw only for now (identity, style, 1-char pose).
 *     No speech / mp3 / lip-sync tests here yet.
 *   `/m` — speech, Saved mp3, Cloud LTX IA2V. That is where short/long line
 *     failures are logged.
 *   Mute cinema — picture to music, mouths shut. Human list:
 *     docs/MUTE_CINEMATIC_ARCHIVE.md. Do not mix with speech send.
 *
 * Promote a still prompt only after Scratch Pass. Do not write wording onto
 * a live pack unless Stuie says go. First Fleet IMAGE MOTION gold stays in
 * docs/SUNNY_BANKS_IMAGE_MOTION_STANDARD.md.
 */

import {
  LTX_LIPSYNC_MIN_SEC,
  LTX_MAX_DURATION_SEC,
  LTX_MIN_DURATION_SEC,
} from "./ltxDuration";
import {
  LTX_RANT_HOLD_SEC,
  LTX_RANT_MAX_WORDS,
  LTX_RANT_WORDS_PER_SEC,
  splitSpokenRant,
  wordCount,
} from "./mobileRantSplit";
import { compileScriptedPosition } from "./mobilePlateScript";
import { buildSpeakingMotion } from "./mobileImageMotion";
import type { ShowStyleId } from "./showStylePresets";
import { SIRAY_I2V_MODELS } from "./sirayI2v";

/** Seedance 2.0 / Cloud IA2V quality floor — short mp3s pad to this, words stay. */
export const SPEECH_QUALITY_MIN_SEC = LTX_LIPSYNC_MIN_SEC;
/** Walker / hallucinate cliff logged on LTX rants (same still, extras enter). */
export const SPEECH_QUALITY_MAX_SEC = LTX_RANT_HOLD_SEC;
export const SPEECH_QUALITY_MAX_WORDS = LTX_RANT_MAX_WORDS;
export const SPEECH_WORDS_PER_SEC = LTX_RANT_WORDS_PER_SEC;

export type ArchiveSurface = "scratch" | "mobile" | "both";
export type ArchiveLayer = "pre_send" | "still" | "speech" | "mute";
export type ArchiveVerdict = "works" | "fails" | "unknown_until_model";

export type ArchiveEntry = {
  id: string;
  surface: ArchiveSurface;
  layer: ArchiveLayer;
  verdict: ArchiveVerdict;
  title: string;
  why: string;
  fix: string;
};

export const PLATE_AUTOMATION_ENTRIES: ArchiveEntry[] = [
  {
    id: "scratch-stills-only",
    surface: "scratch",
    layer: "still",
    verdict: "works",
    title: "Scratch tests stills, not speech",
    why: "Speech / mp3 / lip-sync have not been run on Scratch. Mixing a speaking prompt into Draw is how faces melt and style slips.",
    fix: "Scratch = place + face card + position. Score Style slip / Face / Anatomy. Promote a still prompt only after Pass. Speech stays on /m.",
  },
  {
    id: "stylised-place-plus-face-card",
    surface: "both",
    layer: "still",
    verdict: "works",
    title: "Own stylised place + one face card",
    why: "Cafe plating (2026-08-06) worked far better than photo streets or freehand two-shots.",
    fix: "Lock a generated place still. Compositor gets the single cast card, never the 4-view character sheet.",
  },
  {
    id: "one-character-mcu",
    surface: "scratch",
    layer: "still",
    verdict: "works",
    title: "One-character still (Scratch)",
    why: "Solo MCU + only-NAME-in-frame stops extras. compileScriptedPosition is the talking-plate default — the still, not the spoken line.",
    fix: "Use oneCharacterStillPrompt(name, place). Medium close-up, facing camera, empty hands unless a prop is named, only that person.",
  },
  {
    id: "style-slider-mismatch",
    surface: "scratch",
    layer: "still",
    verdict: "fails",
    title: "Cartoon / human style slip",
    why: "buildCrashGenLook at slider 0–35 forces cel 2D even on a Skidmarks 3D plate. High slider pulls a cartoon plate toward photo-human. Mixing Sunny Banks cel lock onto Skidmarks (or the reverse) is the same slip.",
    fix: "Keep the Draw slider on the original plate's look. Tag Scratch fails as Style slip. Do not send Sunny cel wording at a Skidmarks still.",
  },
  {
    id: "character-sheet-as-ref",
    surface: "both",
    layer: "pre_send",
    verdict: "fails",
    title: "Turnaround sheet as identity ref",
    why: "A 4-view sheet is several copies of one person — compositor draws doubles.",
    fix: "Sheet is QA-only. Plate stills use the single approved face card.",
  },
  {
    id: "photo-bg-under-cast",
    surface: "both",
    layer: "still",
    verdict: "fails",
    title: "Photo street as locked BG",
    why: "Characters sit on the place. A camera photo under a sculpted cast drifts the whole still.",
    fix: "Generate our own stylised location plate. Never lock a real photo as BG.",
  },
  {
    id: "gold-speaking-motion",
    surface: "mobile",
    layer: "speech",
    verdict: "works",
    title: "Gold speaking clip on /m (Cloud LTX IA2V)",
    why: "First Fleet Cloud IMAGE MOTION worked 100% with start-image lock + look lock + mouth/head + NAME says + show style lock. Workflow: workflow/LTX_2.3_IA2V_Cloud.json.",
    fix: "Use oneCharacterSpeakingMotion on /m. LTX only. Never [VISUAL]/[SPEECH] on this gold. Do not test this on Scratch until speech is opened there.",
  },
  {
    id: "cast-bio-in-motion",
    surface: "mobile",
    layer: "speech",
    verdict: "fails",
    title: "CAST bio reinvented the person",
    why: "Long bios (younger, cleaner, loves a beer) make LTX drop the start plate and draw a cousin.",
    fix: "shortLtxLookLock only — hair, clothes, props. Start image is the face. Log this on /m, not Scratch.",
  },
  {
    id: "speech-too-short",
    surface: "mobile",
    layer: "speech",
    verdict: "fails",
    title: "Line too short to lip-sync (/m)",
    why: "Sub-4s mp3s (one-word / tiny lines) do not give the mouth enough frames. Gold still has short lines like Fair call — do not rewrite the words.",
    fix: "Keep Stuie's line. Cloud IA2V pads clip length to 4s (camera holds, nothing new). Prefer ~4–6s / 10–15 words when writing new lines.",
  },
  {
    id: "speech-rant-unsplit",
    surface: "mobile",
    layer: "speech",
    verdict: "fails",
    title: "Rant on one clip hallucinates (/m)",
    why: "LTX holds the solo plate ~6s then walkers enter (logged on a 39s rant). Same still, extras invented.",
    fix: "splitSpokenRant at sentence ends so each clip stays ≤15 words / ~6s. Insert chunks next to each other. Clip 1 uses the plate; clip 2+ uses the previous take's last frame. Words stay Stuie's.",
  },
  {
    id: "speech-clip-chain",
    surface: "mobile",
    layer: "speech",
    verdict: "works",
    title: "Split speech chains last frame → next first frame (/m)",
    why: "Re-using the original plate for every rant chunk snaps the mouth/pose back to T=0. FLF2V / Director overlap the same way: the last frame of clip N is the start still of clip N+1.",
    fix: "nextClipToAnimate waits on earlier same-shot takes. startStillForNextClip extracts the previous mp4's last frame with ffmpeg and hands it to Cloud IA2V. First chunk still uses the plate.",
  },
  {
    id: "ltx-25-flf2v-not-speech",
    surface: "mobile",
    layer: "speech",
    verdict: "fails",
    title: "Official LTX-2.5 FLF2V is not /m speech",
    why: "Hub graph d78377cf53f4 interpolates two stills and invents audio from the Audio VAE. There is no LoadAudio. Pointing Generate at it would drop Stuie's mp3.",
    fix: "Keep /m on LTX-2.3 IA2V (plate + mp3). FLF2V is two scored stills → silent/camera move later. See docs/LTX_25_FLF2V_RESEARCH.md.",
  },
  {
    id: "ltx-25-flf2v-two-guides",
    surface: "both",
    layer: "speech",
    verdict: "works",
    title: "FLF2V locks start at frame 0 and end at frame -1",
    why: "Official subgraph uses two LTXVAddGuide nodes, strength 0.7, CRF 18 preprocess, duration×fps+1 frames, distilled CFG 1. That is first+last still interpolation, not one-plate lip-sync.",
    fix: "If we ever test pose-to-pose on Scratch: two same-aspect stills, start+end prompt lock, no mp3. Do not use the original plate as the last frame of a talking chunk (snaps the mouth back).",
  },
  {
    id: "concert-loop-not-speech",
    surface: "mobile",
    layer: "speech",
    verdict: "fails",
    title: "LTX-2.5 I2V concert loops are not /m speech",
    why: "Hub video_ltx2_5_i2v is image-only and invents audio. Pointing Generate at it would drop the Jack Ash mp3 and skip lip-sync.",
    fix: "People clips stay LTX-2.3 IA2V + Saved mp3. Concert loops are a separate muted I2V pass. See docs/CONCERT_LOOP_PLATE.md.",
  },
  {
    id: "concert-loop-art-plate",
    surface: "both",
    layer: "still",
    verdict: "unknown_until_model",
    title: "Concert loop stills have no band on them",
    why: "Double Talkin' Jive-style gold/black art is a backdrop, not a member still. Drawing Jack/Horn onto it fights the loop.",
    fix: "Holy still first, no people, no character sheet. Low-motion LTX-2.5 I2V (~5s, 24fps) only after he names the test. Mute invented audio.",
  },
  {
    id: "mute-not-speech",
    surface: "mobile",
    layer: "mute",
    verdict: "fails",
    title: "Song mp3 is not mute-clip audio",
    why: "Feeding the song mix into IA2V or H3 makes mouths follow the track. That is lip-sync of the wrong file.",
    fix: "Mute I2V / FLF2V / H3: duration as a number. Hang on TRACK. Strip invented audio. Speech mp3 stays on the lip-sync floor. See docs/MUTE_CINEMATIC_ARCHIVE.md.",
  },
  {
    id: "mute-one-engine-film",
    surface: "mobile",
    layer: "mute",
    verdict: "fails",
    title: "Do not send every mute shot to Grok video",
    why: "An earlier Bright cook put every mute clip on Grok Imagine video. Comfy, H3, and first-last were never tried. Gaps appeared when the clock was shrunk to save money.",
    fix: "Stills first. Then pick the tool per shot. Full song picture, or stop and ask. Do not invent a cheaper film.",
  },
  {
    id: "mute-empty-draw-needs-character",
    surface: "mobile",
    layer: "mute",
    verdict: "fails",
    title: "Empty-stage /m Draw needs a character",
    why: "draw-start returns Need a character on this plate before Draw. Siray ref2i also wants a face card.",
    fix: "Nobody on the card: Siray Seedream 4.5 T2I (no face ref), 16:9 2560x1440. Do not name a person who is not on the pad.",
  },
  {
    id: "mute-coastal-reads-beach",
    surface: "both",
    layer: "mute",
    verdict: "fails",
    title: "Coastal waters stills come back as beach",
    why: "Act I 1.3 takes 1–2 (2026-08-25, Siray T2I) drew black-sand shore + sea when the prompt said coastal waters / two waters meeting.",
    fix: "WATER FILLS THE ENTIRE FRAME. Two currents meeting. No beach, no sand, no land, no shoreline.",
  },
  {
    id: "mute-act1-invents-path-fire",
    surface: "both",
    layer: "mute",
    verdict: "fails",
    title: "Act I hill invents a white path and fire",
    why: "Act I 1.4 take 1 (2026-08-25, Siray T2I) added painted-looking path bands and orange embers. Fire belongs at the end of this song, not the open.",
    fix: "Forbid path / trail / white stripe / fire / sparks / orange. Silhouettes only — do not name the faces.",
  },
  {
    id: "mute-siray-t2i-empty-stage",
    surface: "mobile",
    layer: "mute",
    verdict: "works",
    title: "Siray T2I for empty mute stills",
    why: "Act I 1.1 seed and 1.2 ground (2026-08-25) passed first take on bytedance/seedream-4.5-t2i-spicy at 2560x1440. Cold photo look, no people.",
    fix: "Fresh T2I, not location More (More edits the last place still). Siray has no balance API — say so before a batch. Test, not gold.",
  },
];

export type SpeechClipAdvice = {
  status: "too_short" | "ok" | "split";
  words: number;
  estimatedSec: number;
  chunks: string[];
  entryId: "speech-too-short" | "gold-speaking-motion" | "speech-rant-unsplit";
  fix: string;
};

export function estimateSpeechSec(text: string): number {
  return wordCount(text) / SPEECH_WORDS_PER_SEC;
}

/** Spoken-line advice for /m only — Scratch has not run speech yet. */
export function adviseSpeechClip(text: string, durationSec?: number): SpeechClipAdvice {
  const words = wordCount(text);
  const estimatedSec =
    Number.isFinite(durationSec) && (durationSec as number) > 0
      ? (durationSec as number)
      : estimateSpeechSec(text);
  const chunks = splitSpokenRant(text);
  if (estimatedSec < SPEECH_QUALITY_MIN_SEC || words < 8) {
    return {
      status: "too_short",
      words,
      estimatedSec,
      chunks,
      entryId: "speech-too-short",
      fix: `Line is ~${estimatedSec.toFixed(1)}s / ${words} words. Keep the words. /m Cloud IA2V pads the clip to ${SPEECH_QUALITY_MIN_SEC}s so the mouth has frames. Prefer ${SPEECH_QUALITY_MIN_SEC}–${SPEECH_QUALITY_MAX_SEC}s (~${SPEECH_QUALITY_MAX_WORDS} words) when writing new lines.`,
    };
  }
  if (chunks.length > 1 || words > SPEECH_QUALITY_MAX_WORDS) {
    return {
      status: "split",
      words,
      estimatedSec,
      chunks,
      entryId: "speech-rant-unsplit",
      fix: `Rant is ~${estimatedSec.toFixed(1)}s / ${words} words. Split into ${chunks.length} clips (≤${SPEECH_QUALITY_MAX_WORDS} words / ~${SPEECH_QUALITY_MAX_SEC}s each). Clip 1 starts on the plate; each later clip starts on the previous clip's last frame.`,
    };
  }
  return {
    status: "ok",
    words,
    estimatedSec,
    chunks,
    entryId: "gold-speaking-motion",
    fix: `In the ${SPEECH_QUALITY_MIN_SEC}–${SPEECH_QUALITY_MAX_SEC}s window. Send gold speaking motion on /m Cloud LTX. Do not test speech on Scratch yet.`,
  };
}

/** Talking-plate still — one person, MCU, not a lineup. Test on Scratch. */
export function oneCharacterStillPrompt(name: string, place: string): string {
  return compileScriptedPosition({ name, place });
}

/** LTX speaking body for /m. Lip-sync lead is prepended on send. */
export function oneCharacterSpeakingMotion(opts: {
  styleId: ShowStyleId;
  speaker: string;
  line: string;
  lookLock?: string;
  staging?: string;
}): string {
  return buildSpeakingMotion({
    styleId: opts.styleId,
    speaker: opts.speaker,
    line: opts.line,
    lookLock: opts.lookLock,
    shotSpeakers: [opts.speaker],
    staging: opts.staging,
  });
}

export function archiveEntry(id: string): ArchiveEntry | undefined {
  return PLATE_AUTOMATION_ENTRIES.find((row) => row.id === id);
}

export function archiveForSurface(surface: ArchiveSurface): ArchiveEntry[] {
  return PLATE_AUTOMATION_ENTRIES.filter(
    (row) => row.surface === surface || row.surface === "both",
  );
}

export const SPEECH_ENGINE_WINDOWS = {
  ltxMinSec: LTX_MIN_DURATION_SEC,
  ltxSafetyMaxSec: LTX_MAX_DURATION_SEC,
  qualityMinSec: SPEECH_QUALITY_MIN_SEC,
  qualityMaxSec: SPEECH_QUALITY_MAX_SEC,
  qualityMaxWords: SPEECH_QUALITY_MAX_WORDS,
  siray: SIRAY_I2V_MODELS.map((row) => ({
    id: row.id,
    minSec: row.minSec,
    maxSec: row.maxSec,
  })),
};
