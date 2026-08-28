/**
 * Song-cut math only — safe on the phone. ffmpeg lives in scratchSongSlice.
 */
import type { LyricCue, PlateTiming, TrackSectionMarker } from "./musicVideoTrack";

export const SCRATCH_SONG_SLICE_DEFAULT_SEC = 15;
export const SCRATCH_SONG_SLICE_MIN_SEC = 4;
export const SCRATCH_SONG_SLICE_MAX_SEC = 30;
/** This still’s TRACK bar / LTX Send — slider 5–40, not snap-only 5/10/15. */
export const HANG_LENGTH_MIN_SEC = 5;
export const HANG_LENGTH_MAX_SEC = 40;
/** Legacy snap stops. The hang slider is 5–40. */
export const HANG_LENGTH_CHIPS_SEC = [5, 10, 15] as const;
export type HangLengthChipSec = (typeof HANG_LENGTH_CHIPS_SEC)[number];

/** 5–40 for this still. 10 stays 10. 31.6 stays 31.6. Not a 15s invent. */
export function clampHangLengthSec(sec: number): number {
  if (!Number.isFinite(sec) || sec <= 0) return SCRATCH_SONG_SLICE_DEFAULT_SEC;
  return Math.max(
    HANG_LENGTH_MIN_SEC,
    Math.min(HANG_LENGTH_MAX_SEC, Math.round(sec * 10) / 10),
  );
}
/** One auto batch — 8 × 15s = 2 minutes, then stop so you can check / swap a plate. */
export const SCRATCH_SONG_BATCH_SHOTS = 8;

export type ScratchSongCut = {
  id: string;
  plateFile: string;
  /** /m Music video — which episode plate this slice uses. Scratch omits it. */
  shotId?: string;
  /** Parked for first→last. Not sent to IA2V — that graph has no last frame. */
  endPlateFile?: string;
  startSec: number;
  durationSec: number;
  clipFile?: string;
  status?: "pending" | "running" | "done" | "error";
  error?: string;
  /** Forgotten who-plays: trumpet plays, Jack sings hidden or walks away. */
  performance?: "play" | "sway" | "sing" | "walk";
};

export type ScratchSong = {
  fileName: string;
  /** Beat the mp3 hangs on — survives refresh without re-loading the story. */
  carrierBeatId?: string;
  durationSec: number;
  sliceStartSec: number;
  sliceDurationSec: number;
  cuts?: ScratchSongCut[];
  stitchedFile?: string;
  /** Plates you tapped Add on. The song list is only these (repeats allowed). */
  songPlateIds?: string[];
  /** N × 15s per list row — same length/order as songPlateIds. */
  rowSlices?: number[];
  /** Off song — still stays in STILLS; hang-plates must not put it back. */
  skipShotIds?: string[];
  /** TRACK timeline — normalized waveform peaks 0..1 */
  waveformPeaks?: number[];
  /** Verse / chorus / sax break regions on the MP3 */
  sectionMarkers?: TrackSectionMarker[];
  /** Per-plate in/out on the song (shotId = plateId) */
  plateTimings?: PlateTiming[];
  /** Lyric lines pinned to a time on the MP3 */
  lyricCues?: LyricCue[];
};

export function clampSongSliceDuration(
  sec: number,
  maxSec = SCRATCH_SONG_SLICE_MAX_SEC,
): number {
  if (!Number.isFinite(sec) || sec <= 0) return SCRATCH_SONG_SLICE_DEFAULT_SEC;
  const cap = Number.isFinite(maxSec) && maxSec > 0 ? maxSec : SCRATCH_SONG_SLICE_MAX_SEC;
  return Math.max(
    SCRATCH_SONG_SLICE_MIN_SEC,
    Math.min(cap, Math.round(sec * 10) / 10),
  );
}

export function clampSongSliceStart(startSec: number, songSec: number): number {
  if (!Number.isFinite(startSec) || startSec < 0) return 0;
  if (!Number.isFinite(songSec) || songSec <= 0) return Math.max(0, startSec);
  return Math.min(startSec, Math.max(0, songSec - SCRATCH_SONG_SLICE_MIN_SEC));
}

export function clampSongWindow(
  startSec: number,
  durationSec: number,
  songSec: number,
  maxSec = SCRATCH_SONG_SLICE_MAX_SEC,
): { startSec: number; durationSec: number } {
  const start = clampSongSliceStart(startSec, songSec);
  let duration = clampSongSliceDuration(durationSec, maxSec);
  if (Number.isFinite(songSec) && songSec > 0) {
    const left = Math.max(SCRATCH_SONG_SLICE_MIN_SEC, songSec - start);
    duration = Math.min(duration, left);
    duration = clampSongSliceDuration(duration, maxSec);
  }
  return { startSec: start, durationSec: duration };
}

export function scheduledSongSeconds(cuts: Pick<ScratchSongCut, "durationSec">[]): number {
  return cuts.reduce((sum, cut) => sum + (Number(cut.durationSec) || 0), 0);
}

export function songWindowLeftSec(songSec: number, cuts: Pick<ScratchSongCut, "durationSec">[]): number {
  if (!Number.isFinite(songSec) || songSec <= 0) return 0;
  return Math.max(0, Math.round((songSec - scheduledSongSeconds(cuts)) * 10) / 10);
}

/** `2:19.4` — same clock as the GeekatPlay scheduler. */
export function formatSongClock(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00.0";
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  const whole = Math.floor(s);
  const tenth = Math.round((s - whole) * 10);
  const adj = tenth === 10 ? { whole: whole + 1, tenth: 0 } : { whole, tenth };
  return `${m}:${String(adj.whole).padStart(2, "0")}.${adj.tenth}`;
}

export function songWindowLabel(songSec: number, cuts: Pick<ScratchSongCut, "durationSec">[]): string {
  const scheduled = scheduledSongSeconds(cuts);
  const left = songWindowLeftSec(songSec, cuts);
  return `Song window ${formatSongClock(songSec)} | scheduled ${formatSongClock(scheduled)} | left ${formatSongClock(left)}`;
}

export function nextCutAfter(cuts: ScratchSongCut[], songSec: number): { startSec: number; durationSec: number } {
  const start = scheduledSongSeconds(cuts);
  return clampSongWindow(start, SCRATCH_SONG_SLICE_DEFAULT_SEC, songSec);
}

/** Next 15s windows. Default one batch (8 / 2 min). Pass a higher limit to fill further. */
export function remainingSongWindows(
  cuts: Pick<ScratchSongCut, "durationSec">[],
  songSec: number,
  limit = SCRATCH_SONG_BATCH_SHOTS,
): { startSec: number; durationSec: number }[] {
  const cap = Math.max(0, Math.min(48, Math.floor(Number(limit) || 0)));
  const scheduled: Pick<ScratchSongCut, "durationSec">[] = [...cuts];
  const out: { startSec: number; durationSec: number }[] = [];
  for (let i = 0; i < cap; i++) {
    if (songWindowLeftSec(songSec, scheduled) < SCRATCH_SONG_SLICE_MIN_SEC) break;
    const window = nextCutAfter(scheduled as ScratchSongCut[], songSec);
    if (window.durationSec < SCRATCH_SONG_SLICE_MIN_SEC) break;
    scheduled.push(window);
    out.push(window);
  }
  return out;
}

export function isDroppedPlaceholderLine(line: string): boolean {
  const t = (line || "").trim().toLowerCase();
  return !t || t === "dropped line";
}
