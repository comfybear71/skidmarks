/**
 * Scratch pad clip via Grok Imagine video (image-to-video).
 * Start image is the plate. Motion prompt drives the take.
 * Length is 1–15s (desk chips 2 / 3 / 5). Does not follow the Saved mp3 —
 * that stays LTX. Invented Grok audio is stripped so the song can sit under.
 * Submit returns a request_id; the browser polls so Vercel does not drop the wait.
 */

import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { resolveGenOrPackPlate } from "./crashActivePack";
import { resolveMobileMedia, uploadMobileMedia } from "./mobileMediaStore";
import { rememberClipTake } from "./mobilePlateClips";
import { CRASH_DIR } from "./paths";
import { stripLtxLipSyncLead } from "./mobileImageMotion";
import { patchMobileGenJob, readMobileGenJob, type MobileClipUnit, type MobileGenJob } from "./mobileGenJob";
import { mobileMediaFolder } from "./mobileJobFolder";
import type { CrashStoryDoc } from "./crashStoryTypes";
import { sortableId } from "./types";
import { fileToSirayVideoDataUrl } from "./sirayScratchPlate";
import { buildSirayI2vPrompt } from "./sirayI2v";
import {
  GROK_I2V_ID,
  GROK_I2V_LABEL,
  GROK_I2V_MODEL,
  snapGrokI2vDurationSec,
} from "./grokI2v";
import {
  grokDownloadUrl,
  grokPollVideo,
  grokSubmitVideo,
  grokVideoConfigured,
} from "./grokVideo";
import { resolveFfmpeg } from "./mobileStitch";
import type { ScratchClipTask } from "./mobileScratch";

function genDir() {
  const d = path.join(CRASH_DIR, "gen");
  fs.mkdirSync(d, { recursive: true });
  return d;
}

function stripInventedAudio(mp4Path: string) {
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

async function markClipError(jobId: string, beatId: string, message: string): Promise<MobileGenJob> {
  const job = await readMobileGenJob(jobId);
  if (!job) throw new Error(message);
  const next = (job.clips || []).map((c) =>
    c.beatId === beatId ? { ...c, clipStatus: "error" as const, error: message } : c,
  );
  return (await patchMobileGenJob(jobId, { clips: next, scratchClip: null, error: message }))!;
}

export async function submitScratchGrokClip(opts: {
  job: MobileGenJob;
  story: CrashStoryDoc;
  shotId: string;
  sceneId: string;
  beatId: string;
  durationSec?: number;
}): Promise<{
  job: MobileGenJob;
  task: ScratchClipTask;
  model: string;
  label: string;
  durationSec: number;
}> {
  if (!grokVideoConfigured()) {
    throw new Error("Missing XAI_API_KEY — https://console.x.ai");
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
  const durationSec = snapGrokI2vDurationSec(opts.durationSec ?? 5);
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
    const taskId = await grokSubmitVideo({
      prompt,
      imageUrl: await fileToSirayVideoDataUrl(platePath),
      durationSec,
    });
    const task: ScratchClipTask = {
      taskId,
      shotId,
      sceneId,
      beatId,
      i2v: GROK_I2V_ID,
      backend: "grok-i2v",
      model: GROK_I2V_MODEL,
      label: `${GROK_I2V_LABEL} · ${durationSec}s`,
      durationSec,
      startedAt: new Date().toISOString(),
    };
    job = (await patchMobileGenJob(jobId, { scratchClip: task, error: "" }))!;
    return { job, task, model: GROK_I2V_MODEL, label: task.label, durationSec };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    job = await markClipError(jobId, beatId, message);
    throw e;
  }
}

export async function finishScratchGrokClip(opts: {
  job: MobileGenJob;
  task: ScratchClipTask;
}): Promise<{ pending: true; job: MobileGenJob } | { pending: false; job: MobileGenJob }> {
  const { task } = opts;
  const jobId = opts.job.id;
  const tick = await grokPollVideo(task.taskId);
  if (tick.status === "failed") {
    const message = tick.message || "Grok video generation failed";
    await markClipError(jobId, task.beatId, message);
    throw new Error(message);
  }
  if (tick.status !== "done") {
    return { pending: true, job: opts.job };
  }
  const buffer = await grokDownloadUrl(tick.url);
  const fileName = `${sortableId("gclip")}.mp4`;
  const localMp4 = path.join(genDir(), fileName);
  fs.writeFileSync(localMp4, buffer);
  stripInventedAudio(localMp4);
  try {
    await uploadMobileMedia({
      styleId: opts.job.styleId,
      folderName: mobileMediaFolder(opts.job),
      kind: "mp4",
      localPath: localMp4,
    });
  } catch {
    /* clip still usable this request */
  }
  const live = (await readMobileGenJob(jobId)) || opts.job;
  const next = (live.clips || []).map((c) =>
    c.beatId === task.beatId
      ? { ...c, ...rememberClipTake(c, localMp4), clipStatus: "done" as const, error: "" }
      : c,
  );
  const job = (await patchMobileGenJob(jobId, { clips: next, scratchClip: null, error: "" }))!;
  return { pending: false, job };
}

export function isGrokScratchClipTask(task: ScratchClipTask | null | undefined): boolean {
  if (!task) return false;
  if (task.backend === "grok-i2v") return true;
  if (task.i2v === GROK_I2V_ID) return true;
  return (task.model || "").toLowerCase().includes("grok-imagine-video");
}
