/**
 * Scratch pad clip via MiniMax H3 (first / last frame).
 * Start image is the plate. Optional last still. Motion prompt drives the take.
 * Length is 4–15s (desk chips 5 / 8 / 15). Does not follow the Saved mp3 —
 * that stays LTX. Invented H3 stereo is stripped so the song can sit under.
 * Submit returns a task_id; the browser polls so Vercel does not drop the wait.
 */

import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { resolveGenOrPackPlate } from "./crashActivePack";
import { resolveMobileMedia, uploadMobileMedia } from "./mobileMediaStore";
import { rememberClipTake, withSongCookPendingClip } from "./mobilePlateClips";
import { probeDurationSeconds } from "./mediaDuration";
import { CRASH_DIR } from "./paths";
import { imageMotionLooksEmptyFrame, stripLtxLipSyncLead } from "./mobileImageMotion";
import { patchMobileGenJob, readMobileGenJob, type MobileGenJob } from "./mobileGenJob";
import { mobileMediaFolder } from "./mobileJobFolder";
import type { CrashStoryDoc } from "./crashStoryTypes";
import { sortableId } from "./types";
import { fileToSirayVideoDataUrl } from "./sirayScratchPlate";
import { buildSirayI2vPrompt } from "./sirayI2v";
import {
  MINIMAX_H3_ID,
  MINIMAX_H3_LABEL,
  MINIMAX_H3_MODEL,
  parseMinimaxH3Resolution,
  snapMinimaxH3DurationSec,
  withMinimaxH3CameraCommand,
  type MinimaxH3Resolution,
} from "./minimaxH3";
import {
  minimaxDownloadUrl,
  minimaxPollVideo,
  minimaxSubmitVideo,
  minimaxVideoConfigured,
} from "./minimaxVideo";
import { resolveFfmpeg } from "./mobileStitch";
import type { ScratchClipTask } from "./mobileScratch";
import { hangPlateShotId } from "./musicVideoTrack";

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

async function resolvePlateFile(job: MobileGenJob, fileName: string): Promise<string | null> {
  return (
    resolveGenOrPackPlate(fileName) ||
    (await resolveMobileMedia({
      styleId: job.styleId,
      folderName: job.folderName,
      kind: "plates",
      fileName,
      destPath: path.join(CRASH_DIR, "gen", fileName),
    }))
  );
}

async function markClipError(jobId: string, beatId: string, message: string): Promise<MobileGenJob> {
  const job = await readMobileGenJob(jobId);
  if (!job) throw new Error(message);
  const next = (job.clips || []).map((c) =>
    c.beatId === beatId ? { ...c, clipStatus: "error" as const, error: message } : c,
  );
  return (await patchMobileGenJob(jobId, { clips: next, scratchClip: null, error: message }))!;
}

export async function submitScratchMinimaxClip(opts: {
  job: MobileGenJob;
  story: CrashStoryDoc;
  shotId: string;
  sceneId: string;
  beatId: string;
  durationSec?: number;
  endPlateFile?: string;
  resolution?: MinimaxH3Resolution | string;
  camera?: string;
  emptyFrame?: boolean;
  nobodyInShot?: boolean;
}): Promise<{
  job: MobileGenJob;
  task: ScratchClipTask;
  model: string;
  label: string;
  durationSec: number;
}> {
  if (!minimaxVideoConfigured()) {
    throw new Error("Missing MINIMAX_API_KEY — https://platform.minimax.io");
  }
  const { story, sceneId, beatId } = opts;
  const hangId = (opts.shotId || "").trim();
  const shotId = hangPlateShotId(hangId) || hangId;
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

  const platePath = await resolvePlateFile(job, shot.plateFile);
  if (!platePath) throw new Error("Plate file missing on disk");
  const endName = (opts.endPlateFile || "").trim();
  if (endName && endName === shot.plateFile) {
    throw new Error("Pick a different last still — first and last are the same picture.");
  }
  const endPath = endName ? await resolvePlateFile(job, endName) : null;
  if (endName && !endPath) throw new Error("Last still file is missing on disk");

  const voiceFile = (beat.voiceFile || "").trim();
  const motion = stripLtxLipSyncLead(beat.imageMotion || "");
  const emptyFrame =
    opts.emptyFrame === true ||
    opts.nobodyInShot === true ||
    Boolean(storyShot.nobodyInShot) ||
    imageMotionLooksEmptyFrame(motion);
  const speaker = emptyFrame ? "" : (beat.speaker || "").trim();
  const line = (beat.text || "").trim();
  const durationSec = snapMinimaxH3DurationSec(opts.durationSec ?? 5);
  const resolution = parseMinimaxH3Resolution(opts.resolution);
  const prompt = withMinimaxH3CameraCommand(
    [
      buildSirayI2vPrompt({
        speaker,
        motion,
        staging: storyShot.staging || "",
        imageOnly: true,
      }),
      "Silent picture. Do not sing. Do not invent music or speech. Mouth stays closed.",
      endPath ? "The last frame is the second attached still. Travel from the first still to that last still. No hard cut to a new face." : "",
    ]
      .filter(Boolean)
      .join("\n\n"),
    opts.camera,
  );

  const pending = withSongCookPendingClip({
    clips: job.clips || [],
    beatId,
    hangId: hangId || shotId,
    sceneId,
    speaker,
    line,
    voiceFile,
    imageMotion: prompt,
    newBeatId: () => `cut:${sortableId("take")}`,
  });
  const cookBeatId = pending.cookBeatId;

  job = (await patchMobileGenJob(jobId, { clips: pending.clips, error: "" }))!;

  try {
    const taskId = await minimaxSubmitVideo({
      prompt,
      firstImageUrl: await fileToSirayVideoDataUrl(platePath),
      lastImageUrl: endPath ? await fileToSirayVideoDataUrl(endPath) : undefined,
      durationSec,
      resolution,
    });
    const task: ScratchClipTask = {
      taskId,
      shotId: hangId || shotId,
      sceneId,
      beatId: cookBeatId,
      i2v: MINIMAX_H3_ID,
      backend: "minimax-h3",
      model: MINIMAX_H3_MODEL,
      label: `${MINIMAX_H3_LABEL} · ${durationSec}s`,
      durationSec,
      startedAt: new Date().toISOString(),
    };
    job = (await patchMobileGenJob(jobId, { scratchClip: task, error: "" }))!;
    return { job, task, model: MINIMAX_H3_MODEL, label: task.label, durationSec };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    job = await markClipError(jobId, cookBeatId, message);
    throw e;
  }
}

export async function finishScratchMinimaxClip(opts: {
  job: MobileGenJob;
  task: ScratchClipTask;
}): Promise<{ pending: true; job: MobileGenJob } | { pending: false; job: MobileGenJob }> {
  const { task } = opts;
  const jobId = opts.job.id;
  const tick = await minimaxPollVideo(task.taskId);
  if (tick.status === "failed") {
    const message = tick.message || "MiniMax H3 video generation failed";
    await markClipError(jobId, task.beatId, message);
    throw new Error(message);
  }
  if (tick.status !== "done") {
    return { pending: true, job: opts.job };
  }
  const buffer = await minimaxDownloadUrl(tick.url);
  const fileName = `${sortableId("hclip")}.mp4`;
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
  const fileSec = probeDurationSeconds(localMp4);
  const next = (live.clips || []).map((c) =>
    c.beatId === task.beatId
      ? {
          ...c,
          ...rememberClipTake(c, localMp4),
          clipStatus: "done" as const,
          error: "",
          ...(fileSec ? { durationSec: fileSec } : {}),
        }
      : c,
  );
  const job = (await patchMobileGenJob(jobId, { clips: next, scratchClip: null, error: "" }))!;
  return { pending: false, job };
}

export function isMinimaxScratchClipTask(task: ScratchClipTask | null | undefined): boolean {
  if (!task) return false;
  if (task.backend === "minimax-h3") return true;
  if (task.i2v === MINIMAX_H3_ID) return true;
  return (task.model || "").toLowerCase().includes("minimax-h3");
}
