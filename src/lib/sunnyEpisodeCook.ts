/**
 * One Make-this-episode step: plate a shot, or voice a line, or queue LTX.
 * Fail stays on the job. Does not mint extra house cards. Does not stitch.
 */
import { synthesizeStoryBeat } from "./crashStorySpeak";
import { hydrateMobilePackOnDisk, readMobileStory, writeMobileStory } from "./mobileStoryStore";
import { mergeClipsFromStory } from "./mobileClipQueue";
import { patchMobileGenJob, type MobileGenJob } from "./mobileGenJob";
import { nextUnplatedEpisodeShot } from "./mobilePlateGraph";
import { rebuildShotPlate } from "./mobilePlateRebuild";
import { leftoverHydrateBeat } from "./mobilePlateLines";
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

  const unplated = nextUnplatedEpisodeShot(job, story);
  if (unplated) {
    try {
      const rebuilt = await rebuildShotPlate({
        job,
        story,
        shotId: unplated.shotId,
        qa: true,
      });
      if (rebuilt.qa && rebuilt.qa.ok === false) {
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

  const unvoiced = nextUnvoicedBeat(story);
  if (unvoiced) {
    try {
      const result = await synthesizeStoryBeat({
        styleId: job.styleId,
        beatId: unvoiced.beatId,
        speaker: unvoiced.speaker,
        text: unvoiced.text,
      });
      const voiced = {
        ...story,
        scenes: story.scenes.map((sc) => ({
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

  const fresh = await readMobileStory(job.styleId, job.folderName);
  const clips = mergeClipsFromStory(job, fresh, { requeueSaved: false });
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
