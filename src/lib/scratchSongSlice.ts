/**
 * Scratch-only song windows. Studio chops the track; LTX still gets one
 * short slice + one still. Does not change /m Generate. Does not write
 * onto a live episode shot.
 */
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { resolveFfmpeg } from "./mobileStitch";
import { sortableId } from "./types";

export const SCRATCH_SONG_SLICE_DEFAULT_SEC = 15;
export const SCRATCH_SONG_SLICE_MIN_SEC = 4;
export const SCRATCH_SONG_SLICE_MAX_SEC = 30;

export type ScratchSongCut = {
  id: string;
  plateFile: string;
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

function parseFfmpegDuration(stderr: string): number | undefined {
  const m = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!m) return undefined;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  const seconds = Number(m[3]);
  const total = hours * 3600 + minutes * 60 + seconds;
  return Number.isFinite(total) && total > 0 ? total : undefined;
}

/** ffprobe when present; else ffmpeg -i. Missing tools return undefined. */
export function probeSongDurationSec(filePath: string): number | undefined {
  if (!filePath || !fs.existsSync(filePath)) return undefined;
  const { bin } = resolveFfmpeg();
  const ffprobe = bin ? path.join(path.dirname(bin), "ffprobe") : "ffprobe";
  try {
    const out = execFileSync(
      fs.existsSync(ffprobe) ? ffprobe : "ffprobe",
      ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", filePath],
      { encoding: "utf8", timeout: 12_000 },
    ).trim();
    const sec = Number(out);
    if (Number.isFinite(sec) && sec > 0) return sec;
  } catch {
    /* try ffmpeg */
  }
  try {
    execFileSync(bin || "ffmpeg", ["-i", filePath, "-f", "null", "-"], {
      encoding: "utf8",
      timeout: 20_000,
    });
  } catch (e) {
    const text = e instanceof Error ? `${e.message}\n${(e as { stderr?: Buffer }).stderr || ""}` : String(e);
    return parseFfmpegDuration(text);
  }
  return undefined;
}

export function sliceSongMp3(opts: {
  srcPath: string;
  destPath: string;
  startSec: number;
  durationSec: number;
}): string {
  const { bin, tried } = resolveFfmpeg();
  const window = clampSongWindow(opts.startSec, opts.durationSec, 0);
  fs.mkdirSync(path.dirname(opts.destPath), { recursive: true });
  try {
    execFileSync(
      bin || "ffmpeg",
      [
        "-y",
        "-i",
        opts.srcPath,
        "-ss",
        window.startSec.toFixed(2),
        "-t",
        window.durationSec.toFixed(2),
        "-acodec",
        "libmp3lame",
        "-ar",
        "44100",
        "-ac",
        "1",
        "-b:a",
        "128k",
        opts.destPath,
      ],
      { timeout: 60_000, stdio: "pipe" },
    );
  } catch (e) {
    const why = e instanceof Error ? e.message : String(e);
    throw new Error(
      bin
        ? `Couldn't slice that song — ${why}`
        : `No ffmpeg to slice the song. Looked in: ${tried.join(", ")}`,
    );
  }
  if (!fs.existsSync(opts.destPath) || fs.statSync(opts.destPath).size < 200) {
    throw new Error("Song slice came out empty — try a shorter window.");
  }
  return opts.destPath;
}

export function scratchSongSliceTempPath(jobId: string): string {
  return path.join(os.tmpdir(), `scratch-song-${jobId}-${sortableId("slc")}.mp3`);
}

export function nextCutAfter(cuts: ScratchSongCut[], songSec: number): { startSec: number; durationSec: number } {
  const start = scheduledSongSeconds(cuts);
  return clampSongWindow(start, SCRATCH_SONG_SLICE_DEFAULT_SEC, songSec);
}

export function isDroppedPlaceholderLine(line: string): boolean {
  const t = (line || "").trim().toLowerCase();
  return !t || t === "dropped line";
}
