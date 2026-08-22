/**
 * Stamp + attach a dropped Scratch mp3 onto the beat and job.scratchSong.
 * Used by the small FormData pipe and by the cloud (Blob) drop.
 */
import { findBeatInStory } from "./crashStorySpeak";
import { dialogueFileName, slugToken } from "./crashStoryNames";
import { writeCrashStory } from "./crashStory";
import { writeMobileStory } from "./mobileStoryStore";
import { patchMobileGenJob, type MobileGenJob } from "./mobileGenJob";
import { upsertPendingClip } from "./mobileClipQueue";
import { isMobileSavedVoiceFile } from "./mobileSavedVoice";
import { voiceNamesMatch } from "./voiceNameMatch";
import { isScratchShotTitle } from "./mobileScratch";
import {
  clampSongWindow,
  SCRATCH_SONG_SLICE_DEFAULT_SEC,
} from "./scratchSongWindow";
import type { CrashStoryDoc } from "./crashStoryTypes";

export function findDroppedBeat(story: CrashStoryDoc, beatId: string): {
  speaker: string;
  existingText: string;
  scratchBeat: boolean;
} | null {
  for (const scene of story.scenes) {
    for (const shot of scene.shots) {
      const beat = shot.beats.find((b) => b.id === beatId);
      if (!beat) continue;
      return {
        speaker: beat.speaker,
        existingText: beat.text || "",
        scratchBeat: isScratchShotTitle(shot.title),
      };
    }
  }
  return null;
}

export function speakerOnJobCast(job: MobileGenJob, speaker: string): boolean {
  if (!job.speakers.length) return true;
  return job.speakers.some(
    (s) =>
      voiceNamesMatch(s, speaker) ||
      s.trim().toLowerCase() === speaker.trim().toLowerCase(),
  );
}

export function stampDroppedMp3Name(opts: {
  story: CrashStoryDoc;
  beatId: string;
  speaker: string;
  line: string;
}): string {
  const ctx = findBeatInStory(opts.story, opts.beatId);
  const baseName = ctx
    ? dialogueFileName({
        shotNum: ctx.shotNum,
        beatNum: ctx.beatNum,
        speaker: opts.speaker,
        text: opts.line,
      })
    : `${opts.beatId}_${slugToken(opts.line, 24)}.mp3`;
  const stamp = Date.now().toString(36);
  const fileName = baseName.replace(/\.mp3$/i, "") + `_${stamp}.mp3`;
  if (!isMobileSavedVoiceFile(fileName)) {
    throw new Error(`Couldn't stamp a Saved take name (${fileName})`);
  }
  return fileName;
}

export async function attachDroppedBeatMp3(opts: {
  job: MobileGenJob;
  jobId: string;
  story: CrashStoryDoc;
  beatId: string;
  fileName: string;
  textOverride?: string;
  scratchBeat: boolean;
  durationSec: number;
}): Promise<{ job: MobileGenJob | null; durationSec: number }> {
  const textOverride = (opts.textOverride || "").trim();
  const next: CrashStoryDoc = {
    ...opts.story,
    scenes: opts.story.scenes.map((sc) => ({
      ...sc,
      shots: sc.shots.map((sh) => ({
        ...sh,
        beats: sh.beats.map((b) =>
          b.id === opts.beatId
            ? {
                ...b,
                voiceFile: opts.fileName,
                ...(textOverride ? { text: textOverride } : {}),
              }
            : b,
        ),
      })),
    })),
  };

  writeCrashStory(next);
  await writeMobileStory(next, opts.job.folderName);

  const clips = upsertPendingClip({ ...opts.job, clips: opts.job.clips || [] }, next, opts.beatId);
  const attachSong = opts.scratchBeat || opts.job.styleId === "music_video";
  const durationSec = attachSong
    ? Number.isFinite(opts.durationSec) && opts.durationSec > 0
      ? opts.durationSec
      : 0
    : 0;
  const window = clampSongWindow(0, SCRATCH_SONG_SLICE_DEFAULT_SEC, durationSec);
  const patched = await patchMobileGenJob(opts.jobId, {
    clips,
    error: "",
    ...(opts.job.phase === "error" || opts.job.phase === "animate" ? { phase: "review" as const } : {}),
    ...(attachSong
      ? {
          scratchSong: {
            fileName: opts.fileName,
            durationSec,
            sliceStartSec: window.startSec,
            sliceDurationSec: window.durationSec,
            cuts: opts.job.scratchSong?.cuts || [],
            ...(opts.job.trackDraft?.waveformPeaks
              ? { waveformPeaks: opts.job.trackDraft.waveformPeaks }
              : {}),
            ...(opts.job.trackDraft?.sectionMarkers
              ? { sectionMarkers: opts.job.trackDraft.sectionMarkers }
              : {}),
            ...(opts.job.trackDraft?.lyricCues
              ? { lyricCues: opts.job.trackDraft.lyricCues }
              : {}),
            ...(opts.job.trackDraft?.plateTimings
              ? { plateTimings: opts.job.trackDraft.plateTimings }
              : {}),
          },
          trackDraft: null,
        }
      : {}),
  });
  return { job: patched, durationSec };
}
