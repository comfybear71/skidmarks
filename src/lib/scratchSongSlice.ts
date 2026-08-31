/**
 * Scratch-only ffmpeg slice. Import window math from scratchSongWindow —
 * the phone must not load this file (fs / child_process).
 */
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { resolveFfmpeg } from "./mobileStitch";
import { sortableId } from "./types";
import { clampSongWindow } from "./scratchSongWindow";

export {
  SCRATCH_SONG_SLICE_DEFAULT_SEC,
  SCRATCH_SONG_SLICE_MIN_SEC,
  SCRATCH_SONG_SLICE_MAX_SEC,
  HANG_LENGTH_MIN_SEC,
  HANG_LENGTH_MAX_SEC,
  SCRATCH_SONG_BATCH_SHOTS,
  clampHangLengthSec,
  clampSongSliceDuration,
  clampSongSliceStart,
  clampSongWindow,
  scheduledSongSeconds,
  songWindowLeftSec,
  formatSongClock,
  songWindowLabel,
  nextCutAfter,
  remainingSongWindows,
  isDroppedPlaceholderLine,
} from "./scratchSongWindow";
export type { ScratchSong, ScratchSongCut } from "./scratchSongWindow";

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

/** Cook 5s, hang 2s — keep the first `durationSec` of the mp4. Does not delete the long take. */
export function trimClipMp4(opts: {
  srcPath: string;
  destPath: string;
  durationSec: number;
}): string {
  const { bin, tried } = resolveFfmpeg();
  const t = Math.max(0.4, Number(opts.durationSec) || 0);
  if (!opts.srcPath || !fs.existsSync(opts.srcPath)) {
    throw new Error("Clip to cut is missing.");
  }
  fs.mkdirSync(path.dirname(opts.destPath), { recursive: true });
  try {
    execFileSync(
      bin || "ffmpeg",
      [
        "-y",
        "-i",
        opts.srcPath,
        "-t",
        t.toFixed(2),
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "18",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-movflags",
        "+faststart",
        opts.destPath,
      ],
      { timeout: 120_000, stdio: "pipe" },
    );
  } catch (e) {
    const why = e instanceof Error ? e.message : String(e);
    throw new Error(
      bin ? `Couldn't cut that clip — ${why}` : `No ffmpeg to cut the clip. Looked in: ${tried.join(", ")}`,
    );
  }
  if (!fs.existsSync(opts.destPath) || fs.statSync(opts.destPath).size < 200) {
    throw new Error("Cut clip came out empty.");
  }
  return opts.destPath;
}
