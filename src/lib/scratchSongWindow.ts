/**
 * Song-cut math only — safe on the phone. ffmpeg lives in scratchSongSlice.
 */

export const SCRATCH_SONG_SLICE_DEFAULT_SEC = 15;
export const SCRATCH_SONG_SLICE_MIN_SEC = 4;
export const SCRATCH_SONG_SLICE_MAX_SEC = 30;
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
};

export type ScratchSong = {
  fileName: string;
  durationSec: number;
  sliceStartSec: number;
  sliceDurationSec: number;
  cuts?: ScratchSongCut[];
  stitchedFile?: string;
  /** Plates you tapped Add on. The song list is only these. */
  songPlateIds?: string[];
  /** Legacy hide-list. Desk no longer uses this. */
  skipShotIds?: string[];
};

export function clampSongSliceDuration(sec: number): number {
  if (!Number.isFinite(sec) || sec <= 0) return SCRATCH_SONG_SLICE_DEFAULT_SEC;
  return Math.max(
    SCRATCH_SONG_SLICE_MIN_SEC,
    Math.min(SCRATCH_SONG_SLICE_MAX_SEC, Math.round(sec * 10) / 10),
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
): { startSec: number; durationSec: number } {
  const start = clampSongSliceStart(startSec, songSec);
  let duration = clampSongSliceDuration(durationSec);
  if (Number.isFinite(songSec) && songSec > 0) {
    const left = Math.max(SCRATCH_SONG_SLICE_MIN_SEC, songSec - start);
    duration = Math.min(duration, left);
    duration = clampSongSliceDuration(duration);
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
