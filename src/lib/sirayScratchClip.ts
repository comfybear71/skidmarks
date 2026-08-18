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
import { candidateLookPrompt } from "./mobileJobReady";
import { CRASH_DIR } from "./paths";
import { stripLtxLipSyncLead } from "./mobileImageMotion";
import { patchMobileGenJob, type MobileClipUnit, type MobileGenJob } from "./mobileGenJob";
import type { CrashStoryDoc } from "./crashStoryTypes";
import { sortableId } from "./types";
import { fileToDataUrl } from "./sirayScratchPlate";
import {
  SIRAY_SEEDANCE_20_I2V_SPICY,
  clampSirayI2vDurationSec,
  sirayConfigured,
  sirayDownloadUrl,
  siraySubmitVideoAsync,
  sirayWaitVideoOutputs,
} from "./sirayClient";

function genDir() {
  const d = path.join(CRASH_DIR, "gen");
  fs.mkdirSync(d, { recursive: true });
  return d;
}

export function buildSirayI2vPrompt(opts: {
  speaker: string;
  line: string;
  motion: string;
  staging: string;
}): string {
  const motion = stripLtxLipSyncLead(opts.motion || "").trim();
  const staging = (opts.staging || "").trim();
  const line = (opts.line || "").trim();
  const who = (opts.speaker || "").trim();
  return [
    "Use the provided start image as the first frame. Keep that face, body, wardrobe and place.",
    motion || staging || `${who || "The person"} moves naturally in place.`,
    line && who ? `${who} is speaking: "${line}"` : "",
    "Camera holds. No new people. No text, no captions, no watermarks.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

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
}): Promise<MobileGenJob> {
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
  const probed = audioPath ? probeDurationSeconds(audioPath) : undefined;
  const duration = clampSirayI2vDurationSec(probed ?? 5);
  const lookLock =
    candidateLookPrompt(job.castCandidates, speaker) ||
    job.roster.find((c) => c.name.trim().toLowerCase() === speaker.toLowerCase())?.appearance ||
    "";
  const motion = stripLtxLipSyncLead(beat.imageMotion || "");
  const prompt = buildSirayI2vPrompt({
    speaker,
    line,
    motion: motion || lookLock,
    staging: storyShot.staging || "",
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
      model: SIRAY_SEEDANCE_20_I2V_SPICY,
      prompt,
      image: fileToDataUrl(platePath),
      duration,
      size: "720p",
      aspect_ratio: "adaptive",
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
  return job;
}
