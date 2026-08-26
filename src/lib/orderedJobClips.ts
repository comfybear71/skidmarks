/**
 * Finished mp4s in song / plate order, with human zip names.
 * TRACK hang order wins. Episode uses story shot order.
 * Scratch pad falls back to the clip list.
 */
import type { CrashStoryDoc } from "./crashStoryTypes";
import {
  clipFileBasename,
  clipsUnderPlate,
  humanMediaSlug,
  humanOrderedClipName,
  stackedClipFiles,
} from "./mobilePlateClips";
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

function shotTitleFromStory(story: CrashStoryDoc | null | undefined, shotId: string): string {
  const id = (shotId || "").trim();
  if (!story || !id) return "";
  for (const scene of story.scenes) {
    const shot = scene.shots.find((sh) => sh.id === id);
    if (shot) return (shot.title || "").trim();
  }
  return "";
}

export function orderedJobClips(
  job: MobileGenJob,
  story?: CrashStoryDoc | null,
): OrderedJobClip[] {
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
        title: label || shotTitleFromStory(story, shotId) || title,
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
  } else if (story?.scenes?.length) {
    for (const scene of story.scenes) {
      for (const shot of scene.shots) {
        const beatIds = shot.beats.map((b) => b.id);
        for (const clip of clipsUnderPlate(shot.id, beatIds, job.clips || [])) {
          for (const file of stackedClipFiles(clip)) {
            push(file, clip.speaker || "", clip.shotId, shot.title);
          }
        }
      }
    }
  }

  for (const clip of job.clips || []) {
    for (const file of stackedClipFiles(clip)) {
      push(file, clip.speaker || "", clip.shotId || "");
    }
  }

  return out;
}

export function clipsZipFileName(
  job: Pick<MobileGenJob, "songTitle" | "folderName" | "id">,
): string {
  const slug = humanMediaSlug(job.songTitle || job.folderName || job.id || "clips");
  return `${slug || "clips"}_clips.zip`;
}
