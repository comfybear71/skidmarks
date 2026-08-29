import fs from "fs";
import { execFileSync } from "child_process";
import { clipFileBasename } from "./mobilePlateClips";
import { resolveFfmpeg } from "./mobileStitch";
import { hangOneClipOnWave, msToSec } from "./musicVideoTrack";
import type { ScratchSong } from "./scratchSongWindow";

/** Hang this cook on its own still — never stamp the same mp4 onto the next plate. */
export function clipOwnsHangPlate(clipShotId: string, hangShotId: string): boolean {
  const clip = (clipShotId || "").trim();
  const hang = (hangShotId || "").trim();
  if (!hang) return false;
  if (!clip) return true;
  return clip === hang;
}

/**
 * Put a finished stock/BYO/Send mp4 on TRACK. First cook on an empty cut
 * stamps that cut only — exact hang id (`jack~still2`), not every cut
 * with the still's shotId. A second cook appends (`shotId~tail`) — never
 * replaces clip 4 or clip 5's clipFile. Does not invent 15s rows when
 * plateTimings is empty.
 */
export function hangDoneClipOnTrack(opts: {
  song: ScratchSong | null | undefined;
  shotId: string;
  plateFile: string;
  clipFile: string;
  newCutId: () => string;
  /** Plate that already owns this mp4 in job.clips. Empty = stock / BYO hang. */
  ownerShotId?: string;
  durationSec?: number;
}): ScratchSong | null {
  if (!opts.song) return null;
  const shotId = (opts.shotId || "").trim();
  const clipFile = clipFileBasename(opts.clipFile);
  if (!shotId || !clipFile) return opts.song;
  if (!clipOwnsHangPlate(opts.ownerShotId || "", shotId)) return opts.song;
  const cuts = opts.song.cuts || [];
  if (cuts.some((c) => clipFileBasename(c.clipFile || "") === clipFile)) {
    return opts.song;
  }

  const onShot = cuts.filter((c) => (c.shotId || "").trim() === shotId);
  const hasDone = onShot.some((c) => clipFileBasename(c.clipFile || ""));
  if (hasDone) {
    const hung = hangOneClipOnWave({
      plateTimings: opts.song.plateTimings,
      cuts,
      shotId,
      plateFile: opts.plateFile,
      clipFile,
      durationSec: opts.durationSec,
      newCutId: opts.newCutId,
    });
    if (!hung) return opts.song;
    return { ...opts.song, cuts: hung.cuts, plateTimings: hung.plateTimings };
  }

  const empty = onShot.find((c) => !clipFileBasename(c.clipFile || ""));
  if (empty) {
    return {
      ...opts.song,
      cuts: cuts.map((c) =>
        c.id === empty.id ? { ...c, clipFile, status: "done" as const, error: "" } : c,
      ),
    };
  }

  const timing = (opts.song.plateTimings || []).find((p) => p.plateId === shotId);
  if (!timing) {
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
