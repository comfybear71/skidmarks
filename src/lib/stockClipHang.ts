import fs from "fs";
import { execFileSync } from "child_process";
import { clipFileBasename } from "./mobilePlateClips";
import { resolveFfmpeg } from "./mobileStitch";
import { msToSec } from "./musicVideoTrack";
import type { ScratchSong, ScratchSongCut } from "./scratchSongWindow";

/**
 * Put a finished stock/BYO mp4 on the TRACK cut that already has this
 * shot's clock. Does not invent 15s rows when plateTimings is empty.
 */
export function hangDoneClipOnTrack(opts: {
  song: ScratchSong | null | undefined;
  shotId: string;
  plateFile: string;
  clipFile: string;
  newCutId: () => string;
}): ScratchSong | null {
  if (!opts.song) return null;
  const shotId = (opts.shotId || "").trim();
  const clipFile = clipFileBasename(opts.clipFile);
  if (!shotId || !clipFile) return opts.song;

  const stampCut = (cut: ScratchSongCut): ScratchSongCut =>
    (cut.shotId || "").trim() === shotId
      ? { ...cut, clipFile, status: "done", error: "" }
      : cut;

  const cuts = (opts.song.cuts || []).map(stampCut);
  const timing = (opts.song.plateTimings || []).find((p) => p.plateId === shotId);
  if (!timing) {
    return { ...opts.song, cuts };
  }
  if (cuts.some((c) => (c.shotId || "").trim() === shotId)) {
    return { ...opts.song, cuts };
  }
  const startSec = msToSec(timing.startMs);
  const durationSec = msToSec(timing.endMs - timing.startMs);
  return {
    ...opts.song,
    cuts: [
      ...cuts,
      {
        id: opts.newCutId(),
        plateFile: opts.plateFile || "",
        shotId,
        startSec,
        durationSec,
        clipFile,
        status: "done",
        error: "",
      },
    ],
  };
}

/** Stock often ships with music we cannot keep under our mix. */
export function stripStockAudio(mp4Path: string): void {
  const { bin } = resolveFfmpeg();
  if (!bin) return;
  const tmp = `${mp4Path}.mute.mp4`;
  try {
    execFileSync(
      bin,
      ["-y", "-i", mp4Path, "-c:v", "copy", "-an", "-movflags", "+faststart", tmp],
      { timeout: 60_000, windowsHide: true },
    );
    if (fs.existsSync(tmp) && fs.statSync(tmp).size > 0) {
      fs.renameSync(tmp, mp4Path);
    }
  } catch {
    if (fs.existsSync(tmp)) {
      try {
        fs.unlinkSync(tmp);
      } catch {
        /* keep the voiced file */
      }
    }
  }
}
