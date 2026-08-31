/**
 * Song listen — the mp3 is the record, not the pins.
 *
 * Marquee pins are an even spread of pasted lyrics across the song
 * (see musicVideoTrack.ts `evenLineStartMs`). This file compares that
 * guess against what ffmpeg's silencedetect actually measured on the
 * real mp3, so the miss can be seen in seconds.
 *
 * Honest limit: silencedetect finds near-silence by amplitude. It cannot
 * tell "instrumental" from "vocal" — only quiet from not-quiet. A pin
 * sitting inside real silence, or a long quiet stretch with no pin near
 * it, is a trustworthy signal that the even-spread guess missed. Do not
 * read "sound" as "this is definitely a voice."
 *
 * This file only detects and reports. It does not cook, hang, or rewrite
 * pins, Script, or Script Go.
 */

import type { LyricCue } from "./musicVideoTrack";

export type SilenceWindow = { startMs: number; endMs: number };

export type SoundWindow = { startMs: number; endMs: number; kind: "sound" | "silence" };

export type PinListenDrift = {
  lineIndex: number;
  pinAtMs: number;
  /**
   * Nearest moment sound (re)starts, before or after the pin — only when
   * that's within LISTEN_MAX_MEANINGFUL_DRIFT_MS or the pin is in silence.
   * Null means Listen has no nearby finding here, not that the pin is fine.
   */
  nearestSoundStartMs: number | null;
  /** nearestSoundStartMs - pinAtMs. Positive: sound starts after the pin. Negative: before it. */
  driftMs: number | null;
  /** The pin lands inside a detected silence — a strong sign the line isn't actually sung there. */
  pinInSilence: boolean;
  /** Best-effort word lookup from a saved Script beat at this exact pin time. Not always filled. */
  line?: string;
};

export type ListenReport = {
  songDurationMs: number;
  soundWindows: SoundWindow[];
  /** Quiet stretches long enough to be a candidate instrumental break (intro/solo/outro — "clip 6"). */
  longQuietStretches: SilenceWindow[];
  pinDrift: PinListenDrift[];
};

/** Stretches at least this long are worth flagging as a possible instrumental break. */
export const LISTEN_LONG_QUIET_MS = 3000;

/**
 * How far a "nearest sound restart" can be from a pin before it stops being
 * a finding. A dense mix can go a long stretch — sometimes the whole song
 * after the intro — without ever dropping below the silence threshold, so
 * "nearest sound window start" can land far away with nothing to do with
 * this pin. Reporting that distance as "drift" would read as a huge, scary
 * number that is really just the size of one continuous sound block, not
 * a measured miss. Only a nearby restart, or the pin sitting in silence, is
 * something Listen can actually back up.
 */
export const LISTEN_MAX_MEANINGFUL_DRIFT_MS = 8000;

function clampMs(n: number, max: number): number {
  return Math.max(0, Math.min(max, n));
}

/** Invert detected silence into an ordered, gap-free timeline of sound/silence windows. */
export function soundWindowsFromSilence(
  silences: SilenceWindow[],
  songDurationMs: number,
): SoundWindow[] {
  const duration = Math.max(0, songDurationMs);
  const sorted = [...(silences || [])]
    .map((s) => ({ startMs: clampMs(s.startMs, duration), endMs: clampMs(s.endMs, duration) }))
    .filter((s) => s.endMs > s.startMs)
    .sort((a, b) => a.startMs - b.startMs);

  const out: SoundWindow[] = [];
  let cursor = 0;
  for (const s of sorted) {
    if (s.startMs > cursor) out.push({ startMs: cursor, endMs: s.startMs, kind: "sound" });
    out.push({ startMs: s.startMs, endMs: s.endMs, kind: "silence" });
    cursor = Math.max(cursor, s.endMs);
  }
  if (cursor < duration) out.push({ startMs: cursor, endMs: duration, kind: "sound" });
  return out;
}

export function longQuietStretches(
  silences: SilenceWindow[],
  minMs: number = LISTEN_LONG_QUIET_MS,
): SilenceWindow[] {
  return (silences || []).filter((s) => s.endMs - s.startMs >= minMs);
}

export function isInSilence(silences: SilenceWindow[], atMs: number): boolean {
  return (silences || []).some((s) => atMs >= s.startMs && atMs < s.endMs);
}

/** The nearest sound-window onset to atMs, in either direction. Null if there is no sound at all. */
export function nearestSoundStart(soundWindows: SoundWindow[], atMs: number): number | null {
  let best: number | null = null;
  let bestDist = Infinity;
  for (const w of soundWindows) {
    if (w.kind !== "sound") continue;
    const dist = Math.abs(w.startMs - atMs);
    if (dist < bestDist) {
      bestDist = dist;
      best = w.startMs;
    }
  }
  return best;
}

export function compareListenClockToPins(
  cues: LyricCue[],
  silences: SilenceWindow[],
  soundWindows: SoundWindow[],
): PinListenDrift[] {
  return (cues || [])
    .slice()
    .sort((a, b) => a.atMs - b.atMs)
    .map((cue) => {
      const pinInSilence = isInSilence(silences, cue.atMs);
      const nearest = nearestSoundStart(soundWindows, cue.atMs);
      const rawDrift = nearest === null ? null : nearest - cue.atMs;
      // A pin already on real sound with nothing nearby to compare against
      // has no backed-up finding — see LISTEN_MAX_MEANINGFUL_DRIFT_MS.
      const meaningful =
        pinInSilence || (rawDrift !== null && Math.abs(rawDrift) <= LISTEN_MAX_MEANINGFUL_DRIFT_MS);
      return {
        lineIndex: cue.lineIndex,
        pinAtMs: cue.atMs,
        nearestSoundStartMs: meaningful ? nearest : null,
        driftMs: meaningful ? rawDrift : null,
        pinInSilence,
      };
    });
}

export function buildListenReport(args: {
  songDurationMs: number;
  silences: SilenceWindow[];
  cues: LyricCue[];
}): ListenReport {
  const soundWindows = soundWindowsFromSilence(args.silences, args.songDurationMs);
  return {
    songDurationMs: args.songDurationMs,
    soundWindows,
    longQuietStretches: longQuietStretches(args.silences),
    pinDrift: compareListenClockToPins(args.cues, args.silences, soundWindows),
  };
}
