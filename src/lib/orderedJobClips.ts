/**
 * Finished mp4s in song / plate order, with human zip names.
 * TRACK hang order wins. Scratch pad falls back to the clip list.
 */
import { clipFileBasename, humanOrderedClipName, stackedClipFiles } from "./mobilePlateClips";
import type { MobileGenJob } from "./mobileGenJob";
import { sortPlateTimings } from "./musicVideoTrack";

export type OrderedJobClip = {
  clipFile: string;
  zipName: string;
  shotId: string;
  speaker: string;
};

export function hungClipFileForPlate(
  job: Pick<MobileGenJob, "clips" | "scratchSong">,
  shotId: string,
): string {
  const id = (shotId || "").trim();
  if (!id) return "";
  const timed = (job.scratchSong?.cuts || [])
    .filter((c) => (c.shotId || "").trim() === id && clipFileBasename(c.clipFile || ""))
    .sort((a, b) => (a.startSec || 0) - (b.startSec || 0));
  const fromCut = clipFileBasename(timed.at(-1)?.clipFile || "");
  if (fromCut) return fromCut;
  const fromClip = (job.clips || []).find(
    (c) => (c.shotId || "").trim() === id && clipFileBasename(c.clipFile || ""),
  );
  return clipFileBasename(fromClip?.clipFile || "");
}

export function orderedJobClips(job: MobileGenJob): OrderedJobClip[] {
  const seen = new Set<string>();
  const out: OrderedJobClip[] = [];
  const title = (job.songTitle || "").trim();
  const timings = sortPlateTimings(job.scratchSong?.plateTimings || job.trackDraft?.plateTimings || []);
  const cuts = [...(job.scratchSong?.cuts || [])].sort((a, b) => (a.startSec || 0) - (b.startSec || 0));

  const push = (clipFile: string, speaker: string, shotId: string, label?: string) => {
    const file = clipFileBasename(clipFile);
    if (!file || seen.has(file)) return;
    seen.add(file);
    out.push({
      clipFile: file,
      zipName: humanOrderedClipName({
        index: out.length + 1,
        speaker: speaker || "clip",
        title: label || title,
      }),
      shotId,
      speaker: speaker || "",
    });
  };

  if (timings.length) {
    for (const timing of timings) {
      const shotId = timing.plateId;
      const cut = cuts.find((c) => (c.shotId || "").trim() === shotId && c.clipFile);
      const clip = (job.clips || []).find((c) => (c.shotId || "").trim() === shotId && c.clipFile);
      push(cut?.clipFile || clip?.clipFile || "", clip?.speaker || "", shotId);
    }
  } else if (cuts.some((c) => c.clipFile)) {
    for (const cut of cuts) {
      if (!cut.clipFile) continue;
      const clip = (job.clips || []).find((c) => clipFileBasename(c.clipFile || "") === clipFileBasename(cut.clipFile || ""));
      push(cut.clipFile, clip?.speaker || "", cut.shotId || "");
    }
  }

  for (const clip of job.clips || []) {
    for (const file of stackedClipFiles(clip)) {
      push(file, clip.speaker || "", clip.shotId || "");
    }
  }

  return out;
}

export function clipsZipFileName(job: Pick<MobileGenJob, "songTitle" | "id">): string {
  const slug = (job.songTitle || job.id || "clips")
    .trim()
    .replace(/['’]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
  return `${slug || "clips"}_clips.zip`;
}
