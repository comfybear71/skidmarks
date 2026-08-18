import path from "path";
import { resolveGenOrPackPlate } from "./crashActivePack";
import { resolveMobileBeatAudio } from "./resolveMobileBeatAudio";
import { resolveMobileMedia, uploadMobileMedia } from "./mobileMediaStore";
import { rememberClipTake } from "./mobilePlateClips";
import { runLtxSmoke } from "./ltxSmoke";
import { resolveComfyUrl, probeComfyUrl } from "./comfyClient";
import { candidateLookPrompt } from "./mobileJobReady";
import {
  imageMotionNamesLeftovers,
  leftoverHydrateSpeakers,
  shotSpeakersOnCard,
} from "./mobilePlateLines";
import { CRASH_DIR } from "./paths";
import {
  buildDefaultBeatMotion,
  buildSegmentText,
  buildGlobalPrompt,
  ltxSendPrompt,
  stripLtxLipSyncLead,
  imageMotionUsableForLine,
  looksLikePlatePositionPrompt,
} from "./mobileImageMotion";
import { campaignImageMotionForId } from "./mobilePlateLtxCampaign";
import { patchMobileGenJob, type MobileClipUnit, type MobileGenJob } from "./mobileGenJob";
import type { CrashStoryDoc } from "./crashStoryTypes";

async function ensureComfyReady(): Promise<string> {
  const { preferComfyCloudLtx } = await import("./ltxCloudIa2v");
  if (preferComfyCloudLtx()) return "";

  const resolved = await resolveComfyUrl();
  if (resolved.ok) {
    const status = await probeComfyUrl(resolved.url);
    if (status === "up") return resolved.url;
  }
  throw new Error("No Comfy Cloud key and no reachable COMFY_URL — set one to animate");
}

/**
 * One LTX clip for the scratch plate. Does not flip job.phase to animate —
 * /m stays on review. Patches only this beat's clip row.
 */
export async function runScratchLtxClip(opts: {
  job: MobileGenJob;
  story: CrashStoryDoc;
  shotId: string;
  sceneId: string;
  beatId: string;
  poseId?: string;
}): Promise<MobileGenJob> {
  const { story, shotId, sceneId, beatId, poseId } = opts;
  let job = opts.job;
  const jobId = job.id;
  const shot = job.shots.find((s) => s.shotId === shotId);
  const scene = story.scenes.find((sc) => sc.id === sceneId);
  const storyShot = scene?.shots.find((sh) => sh.id === shotId);
  const beat = storyShot?.beats.find((b) => b.id === beatId);
  if (!shot) throw new Error("Scratch plate is not on this job");
  if (shot.plateFile === "__error__") {
    throw new Error(shot.error ? `Plate failed — ${shot.error}` : "Plate failed — pick the face and the place first");
  }
  if (!shot.plateFile) throw new Error("Draw the still first");
  if (!storyShot || !beat) throw new Error("That line is missing from the scratch plate");

  const platePath =
    resolveGenOrPackPlate(shot.plateFile) ||
    (await resolveMobileMedia({
      styleId: job.styleId,
      folderName: job.folderName,
      kind: "plates",
      fileName: shot.plateFile,
      destPath: path.join(CRASH_DIR, "gen", shot.plateFile),
    }));
  if (!platePath) throw new Error("Plate file missing on disk");

  const voiceFile = (beat.voiceFile || "").trim();
  const speaker = (beat.speaker || "").trim();
  const line = (beat.text || "").trim();
  const audioPath = await resolveMobileBeatAudio({
    styleId: job.styleId,
    folderName: job.folderName,
    beatId: beat.id,
    voiceFile,
  });
  if (!audioPath) {
    throw new Error("Save the spoken line first — Play appears when the mp3 is ready.");
  }
  if (looksLikePlatePositionPrompt(line)) {
    throw new Error("That's the still position, not speech. Wipe the line box, type what they say, then Save.");
  }

  const speaking = line.length > 0;
  const lookLock =
    candidateLookPrompt(job.castCandidates, speaker) ||
    job.roster.find((c) => c.name.trim().toLowerCase() === speaker.toLowerCase())?.appearance;
  const leftovers = leftoverHydrateSpeakers(storyShot.id, storyShot.beats);
  const shotCast = shotSpeakersOnCard({
    shotId: storyShot.id,
    title: storyShot.title,
    staging: storyShot.staging,
    summary: storyShot.summary,
    plateFile: storyShot.plateFile,
    jobSpeakers: job.speakers,
    beats: storyShot.beats,
  });
  const stored = stripLtxLipSyncLead(beat.imageMotion || "");
  const fromPose =
    poseId && line
      ? campaignImageMotionForId({
          id: poseId,
          styleId: job.styleId,
          speaker,
          line,
        })
      : "";
  const body =
    (stored &&
    !imageMotionNamesLeftovers(stored, leftovers) &&
    imageMotionUsableForLine(stored, line)
      ? stored
      : "") ||
    fromPose ||
    buildDefaultBeatMotion({
      styleId: job.styleId,
      speaker,
      line,
      lookLock,
      shotSpeakers: shotCast,
      staging: storyShot.staging,
    });
  const imageMotion = ltxSendPrompt(body, storyShot.staging);

  const clips: MobileClipUnit[] = (job.clips || []).some((c) => c.beatId === beatId)
    ? (job.clips || []).map((c) =>
        c.beatId === beatId
          ? {
              ...c,
              shotId,
              sceneId,
              speaker,
              line,
              voiceFile,
              imageMotion,
              clipStatus: "pending",
              error: "",
            }
          : c,
      )
    : [
        ...(job.clips || []),
        {
          beatId,
          shotId,
          sceneId,
          clipFile: "",
          clipStatus: "pending",
          error: "",
          speaker,
          line,
          voiceFile,
          imageMotion,
        },
      ];

  job = (await patchMobileGenJob(jobId, { clips, error: "" }))!;

  try {
    const comfyUrl = await ensureComfyReady();
    const result = await runLtxSmoke({
      platePath,
      audioPath,
      imageMotion,
      segmentText: buildSegmentText(speaker, speaking),
      globalPrompt: buildGlobalPrompt(job.styleId),
      comfyUrl,
      styleId: job.styleId,
      beatId: beat.id,
    });
    try {
      await uploadMobileMedia({
        styleId: job.styleId,
        folderName: job.folderName,
        kind: "mp4",
        localPath: result.localMp4,
      });
    } catch {
      /* clip still usable this request */
    }
    const next = job.clips.map((c) =>
      c.beatId === beatId
        ? { ...c, ...rememberClipTake(c, result.localMp4), clipStatus: "done" as const }
        : c,
    );
    job = (await patchMobileGenJob(jobId, { clips: next }))!;
  } catch (e) {
    const next = job.clips.map((c) =>
      c.beatId === beatId
        ? { ...c, clipStatus: "error" as const, error: e instanceof Error ? e.message : String(e) }
        : c,
    );
    job = (await patchMobileGenJob(jobId, { clips: next }))!;
    throw e;
  }
  return job;
}
