/**
 * One Make-this-episode step: plate a shot, or voice a line, or queue LTX.
 * Fail stays on the job. Does not mint extra house cards. Does not stitch.
 */
import { synthesizeStoryBeat, resolveBeatAudioPath } from "./crashStorySpeak";
import { uploadMobileMedia } from "./mobileMediaStore";
import { mobileMediaFolder } from "./mobileJobFolder";
import { hydrateMobilePackOnDisk, readMobileStory, writeMobileStory } from "./mobileStoryStore";
import { mergeClipsFromStory } from "./mobileClipQueue";
import { patchMobileGenJob, type MobileGenJob } from "./mobileGenJob";
import { nextUnplatedEpisodeShot, shotHasPlate } from "./mobilePlateGraph";
import { episodeJobShots } from "./mobileScratch";
import { rebuildShotPlate } from "./mobilePlateRebuild";
import { leftoverHydrateBeat } from "./mobilePlateLines";
import { ensureSunnyHoldAudio } from "./sunnyHoldAudio";
import { packAudioDir, rebindJobClipVoices, rebindStoryVoiceFiles } from "./storyVoiceRebind";
import { isSunnyExtraName, isSunnySeriesName } from "./sunnyEpisodeSpec";
import {
  generateSunnyGuestFace,
  generateSunnyPlaceStill,
  nextSunnyGuestNeedingFace,
  nextSunnyPlaceNeedingStill,
} from "./sunnyEpisodeSeed";
import { approvedCandidateFileName } from "./mobileJobReady";

export function isSunnyAutoJob(job: Pick<MobileGenJob, "styleId" | "sunnyAuto">): boolean {
  return job.styleId === "sunny_banks" && Boolean(job.sunnyAuto);
}

/** Make keeps a drawn still and walks on. A red proof must not kill the episode. */
export function sunnyAutoKeepsFailedProof(opts: {
  plateFile?: string;
  qaOk?: boolean;
}): boolean {
  const file = String(opts.plateFile || "").trim();
  if (!file || file === "__error__") return false;
  return opts.qaOk === false;
}

/** Live old Make still throws this. A blank error phase is a wiped stamp. Keep cooking. */
export function sunnyAutoResumeFromStaleError(error: string, phase?: string): boolean {
  const err = String(error || "").trim();
  if (phase === "error" && !err) return true;
  if (/shot has no cast to composite/i.test(err)) return true;
  // One slow Grok still must not kill the episode. Same shot, try again.
  if (/xai image request timed out/i.test(err)) return true;
  return false;
}

/** Phone tap-again must not start a second plate/voice while the first /step is still on it. */
export const SUNNY_STEP_LOCK_MS = 3 * 60 * 1000;

export function sunnyStepIsLocked(
  job: Pick<MobileGenJob, "sunnyStepUntil">,
  now = Date.now(),
): boolean {
  const until = Date.parse(String(job.sunnyStepUntil || ""));
  return Number.isFinite(until) && until > now;
}

function nextUnvoicedBeat(story: Awaited<ReturnType<typeof readMobileStory>>) {
  for (const scene of story.scenes) {
    for (const shot of scene.shots) {
      for (const beat of shot.beats) {
        if (leftoverHydrateBeat(shot.id, beat.id)) continue;
        const speaker = beat.speaker.trim();
        if (!speaker || isSunnyExtraName(speaker)) continue;
        if (!beat.text.trim()) continue;
        if (beat.voiceFile?.trim()) continue;
        return { beatId: beat.id, speaker, text: beat.text };
      }
    }
  }
  return null;
}

export async function runSunnyAutoStep(job: MobileGenJob): Promise<MobileGenJob> {
  if (sunnyAutoResumeFromStaleError(job.error, job.phase)) {
    const cleared = await patchMobileGenJob(job.id, { phase: "plates", error: "" });
    if (cleared) job = cleared;
  }
  if (!job.folderName) {
    return (
      (await patchMobileGenJob(job.id, {
        phase: "error",
        error: "Make did not lock a pack.",
      })) || job
    );
  }

  await hydrateMobilePackOnDisk(job.styleId, job.folderName);
  const story = await readMobileStory(job.styleId, job.folderName);

  const missingSeries = job.speakers.filter(
    (name) =>
      isSunnySeriesName(name) && !approvedCandidateFileName(job.castCandidates, name),
  );
  if (missingSeries.length) {
    return (
      (await patchMobileGenJob(job.id, {
        phase: "error",
        error: `Couldn't find the locked ${missingSeries.join(", ")} face. Those stay the series cards — won't invent them.`,
      })) || job
    );
  }

  const guest = nextSunnyGuestNeedingFace(job);
  if (guest) {
    if (isSunnySeriesName(guest) && !approvedCandidateFileName(job.castCandidates, guest)) {
      return (
        (await patchMobileGenJob(job.id, {
          phase: "error",
          error: `Couldn't find the locked ${guest} face. Open the series pack — don't invent them.`,
        })) || job
      );
    }
    try {
      const look =
        job.roster.find((c) => c.name.trim().toLowerCase() === guest.toLowerCase())
          ?.appearance || guest;
      const take = await generateSunnyGuestFace(job, guest, look);
      return (
        (await patchMobileGenJob(job.id, {
          castCandidates: {
            ...job.castCandidates,
            [guest]: [take],
          },
          error: "",
        })) || job
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return (
        (await patchMobileGenJob(job.id, { phase: "error", error: message })) || job
      );
    }
  }

  const place = nextSunnyPlaceNeedingStill(job);
  if (place) {
    try {
      const take = await generateSunnyPlaceStill(job, place.placeName);
      return (
        (await patchMobileGenJob(job.id, {
          locationCandidates: {
            ...job.locationCandidates,
            [place.sceneId]: [take],
          },
          error: "",
        })) || job
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return (
        (await patchMobileGenJob(job.id, { phase: "error", error: message })) || job
      );
    }
  }

  const unplated =
    episodeJobShots(job, story).find((s) => !shotHasPlate(s)) ||
    nextUnplatedEpisodeShot(job, story);
  if (unplated) {
    try {
      const rebuilt = await rebuildShotPlate({
        job,
        story,
        shotId: unplated.shotId,
        qa: true,
      });
      if (rebuilt.qa && rebuilt.qa.ok === false) {
        if (sunnyAutoKeepsFailedProof({ plateFile: rebuilt.plateFile, qaOk: false })) {
          return (
            (await patchMobileGenJob(job.id, {
              phase: "plates",
              error: "",
              shots: rebuilt.job.shots.map((s) =>
                s.shotId === unplated.shotId ? { ...s, error: "" } : s,
              ),
            })) || rebuilt.job
          );
        }
        return (
          (await patchMobileGenJob(job.id, {
            phase: "error",
            error:
              rebuilt.job.shots.find((s) => s.shotId === unplated.shotId)?.error ||
              "A still failed proof. FAIL stays red.",
            shots: rebuilt.job.shots,
          })) || rebuilt.job
        );
      }
      return rebuilt.job;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return (
        (await patchMobileGenJob(job.id, {
          phase: "error",
          error: message,
        })) || job
      );
    }
  }

  const held = await ensureSunnyHoldAudio(job, story);
  if (held.wrote) {
    await writeMobileStory(held.story, job.folderName);
  }
  const liveStory = held.story;
  const audioDir = packAudioDir(job.styleId, job.folderName);
  if (audioDir) {
    const rebound = rebindStoryVoiceFiles(liveStory, audioDir);
    if (rebound.rebound) {
      await writeMobileStory(liveStory, job.folderName);
    }
  }

  const unvoiced = nextUnvoicedBeat(liveStory);
  if (unvoiced) {
    try {
      const result = await synthesizeStoryBeat({
        styleId: job.styleId,
        beatId: unvoiced.beatId,
        speaker: unvoiced.speaker,
        text: unvoiced.text,
      });
      const voiced = {
        ...liveStory,
        scenes: liveStory.scenes.map((sc) => ({
          ...sc,
          shots: sc.shots.map((sh) => ({
            ...sh,
            beats: sh.beats.map((b) =>
              b.id === unvoiced.beatId ? { ...b, voiceFile: result.voiceFile } : b,
            ),
          })),
        })),
      };
      await writeMobileStory(voiced, job.folderName);
      const localVoice = resolveBeatAudioPath(
        job.styleId,
        unvoiced.beatId,
        result.voiceFile,
      );
      if (localVoice) {
        try {
          await uploadMobileMedia({
            styleId: job.styleId,
            folderName: mobileMediaFolder(job),
            kind: "audio",
            localPath: localVoice,
          });
        } catch {
          /* Hear still works from disk; Generate needs Blob */
        }
      }
      return job;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return (
        (await patchMobileGenJob(job.id, {
          phase: "error",
          error: message,
        })) || job
      );
    }
  }

  const clips = audioDir
    ? rebindJobClipVoices(mergeClipsFromStory(job, liveStory, { requeueSaved: false }), audioDir)
        .clips
    : mergeClipsFromStory(job, liveStory, { requeueSaved: false });
  const pending = clips.filter((c) => c.clipStatus === "pending" && c.voiceFile?.trim());
  if (!pending.length) {
    return (
      (await patchMobileGenJob(job.id, {
        clips,
        phase: "review",
        error: clips.length ? "" : "Locked. No spoken lines to cook.",
      })) || job
    );
  }
  return (
    (await patchMobileGenJob(job.id, {
      clips,
      phase: "animate",
      error: "",
    })) || job
  );
}
