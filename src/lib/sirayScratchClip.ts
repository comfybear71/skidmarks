/**
 * Scratch pad clip via Siray Seedance 2.0 i2v Spicy.
 * Start image is the plate. Motion prompt drives the take.
 * Does not lip-sync the Saved mp3 — that stays LTX / Comfy.
 */

import fs from "fs";
import path from "path";
import { resolveGenOrPackPlate } from "./crashActivePack";
import { resolveMobileBeatAudio } from "./resolveMobileBeatAudio";
import { resolveMobileMedia, uploadMobileMedia } from "./mobileMediaStore";
import { rememberClipTake } from "./mobilePlateClips";
import { probeDurationSeconds } from "./mediaDuration";
import { CRASH_DIR } from "./paths";
import { stripLtxLipSyncLead } from "./mobileImageMotion";
import { patchMobileGenJob, type MobileClipUnit, type MobileGenJob } from "./mobileGenJob";
import type { CrashStoryDoc } from "./crashStoryTypes";
import { sortableId } from "./types";
import { fileToSirayVideoDataUrl } from "./sirayScratchPlate";
import {
  clampSirayI2vDurationSec,
  sirayConfigured,
  sirayDownloadUrl,
  siraySubmitVideoAsync,
  sirayWaitVideoOutputs,
} from "./sirayClient";
import {
  buildSirayI2vPrompt,
  SIRAY_I2V_DEFAULT,
  sirayI2vSpec,
  snapSirayI2vDurationSec,
  type SirayI2vId,
} from "./sirayI2v";

function genDir() {
  const d = path.join(CRASH_DIR, "gen");
  fs.mkdirSync(d, { recursive: true });
  return d;
}

export { buildSirayI2vPrompt } from "./sirayI2v";

/**
 * One Seedance spicy clip for the scratch plate. Does not flip job.phase.
 * /m stays on review. Patches only this beat's clip row.
 */
export async function runScratchSirayClip(opts: {
  job: MobileGenJob;
  story: CrashStoryDoc;
  shotId: string;
  sceneId: string;
  beatId: string;
  i2v?: SirayI2vId;
}): Promise<{ job: MobileGenJob; i2v: SirayI2vId; model: string; label: string }> {
  if (!sirayConfigured()) {
    throw new Error("Missing SIRAY_API_KEY — https://console.siray.ai/keys");
  }
  const { story, shotId, sceneId, beatId } = opts;
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
  const audioPath = voiceFile
    ? await resolveMobileBeatAudio({
        styleId: job.styleId,
        folderName: job.folderName,
        beatId: beat.id,
        voiceFile,
      })
    : "";
  const i2v = opts.i2v || SIRAY_I2V_DEFAULT;
  const spec = sirayI2vSpec(i2v);
  const probed = audioPath ? probeDurationSeconds(audioPath) : undefined;
  const duration = snapSirayI2vDurationSec(probed ?? 5, spec);
  const motion = stripLtxLipSyncLead(beat.imageMotion || "");
  const prompt = buildSirayI2vPrompt({
    speaker,
    motion,
    staging: storyShot.staging || "",
    imageOnly: true,
  });

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
              imageMotion: prompt,
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
          imageMotion: prompt,
        },
      ];

  job = (await patchMobileGenJob(jobId, { clips, error: "" }))!;

  try {
    const taskId = await siraySubmitVideoAsync({
      model: spec.model,
      prompt,
      image: await fileToSirayVideoDataUrl(platePath),
      duration,
      size: spec.size,
      ...(spec.aspectRatio ? { aspect_ratio: spec.aspectRatio } : {}),
      ...(spec.id === "wan-27" ? { prompt_expansion_enable: false } : {}),
      audio_enable: false,
    });
    const urls = await sirayWaitVideoOutputs(taskId);
    const buffer = await sirayDownloadUrl(urls[0]);
    const fileName = `${sortableId("sclip")}.mp4`;
    const localMp4 = path.join(genDir(), fileName);
    fs.writeFileSync(localMp4, buffer);
    try {
      await uploadMobileMedia({
        styleId: job.styleId,
        folderName: job.folderName,
        kind: "mp4",
        localPath: localMp4,
      });
    } catch {
      /* clip still usable this request */
    }
    const next = job.clips.map((c) =>
      c.beatId === beatId
        ? { ...c, ...rememberClipTake(c, localMp4), clipStatus: "done" as const }
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
  return { job, i2v, model: spec.model, label: spec.label };
}
