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
import { cacheJobPlateFile } from "./mobilePlateMedia";
import { resolveMobileMedia, uploadMobileMedia } from "./mobileMediaStore";
import { rememberClipTake, withSongCookPendingClip } from "./mobilePlateClips";
import { probeDurationSeconds } from "./mediaDuration";
import { CRASH_DIR } from "./paths";
import { stripLtxLipSyncLead } from "./mobileImageMotion";
import { patchMobileGenJob, readMobileGenJob, type MobileGenJob } from "./mobileGenJob";
import { mobileCandidateFolders, mobileMediaFolder } from "./mobileJobFolder";
import type { CrashStoryBeat, CrashStoryDoc, CrashStoryShot } from "./crashStoryTypes";
import {
  beatForSongCut,
  isMusicVideoSongJob,
  muteSongBeatStub,
  storyShotForSongCut,
} from "./musicVideoSong";
import { hangPlateShotId, songFromTrackDraft } from "./musicVideoTrack";
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

async function resolveGrokPlatePath(
  job: MobileGenJob,
  fileName: string,
): Promise<string | null> {
  const name = fileName.trim();
  if (!name || name === "__error__") return null;
  const local = resolveGenOrPackPlate(name);
  if (local) return local;
  const folders = mobileCandidateFolders(job);
  for (const folder of folders) {
    const resolved = await resolveMobileMedia({
      styleId: job.styleId,
      folderName: folder,
      kind: "plates",
      fileName: name,
      destPath: path.join(CRASH_DIR, "gen", name),
    });
    if (resolved) return resolved;
  }
  return cacheJobPlateFile({
    styleId: job.styleId,
    folders,
    fileName: name,
  });
}

function stubStoryShot(opts: {
  shotId: string;
  plateFile: string;
  beat?: CrashStoryBeat;
}): CrashStoryShot {
  return {
    id: opts.shotId,
    title: "",
    summary: "",
    staging: "",
    plateFile: opts.plateFile,
    beats: opts.beat ? [opts.beat] : [],
    sfx: [],
  };
}

/**
 * Music-video stills live on the story / TRACK hang, not Scratch
 * `job.shots`. Extra hangs are `shotId~take`. Do not require a pad row.
 */
export function resolveGrokClipRefs(opts: {
  job: MobileGenJob;
  story: CrashStoryDoc;
  shotId: string;
  sceneId: string;
  beatId: string;
  plateFile?: string;
}): {
  hangId: string;
  stillId: string;
  sceneId: string;
  plateFile: string;
  storyShot: CrashStoryShot;
  beat: CrashStoryBeat;
} {
  const hangId = (opts.shotId || "").trim();
  const stillId = hangPlateShotId(hangId) || hangId;
  const askedPlate = (opts.plateFile || "").trim();
  const jobShot =
    opts.job.shots.find((s) => s.shotId === stillId) ||
    opts.job.shots.find((s) => s.shotId === hangId) ||
    (askedPlate
      ? opts.job.shots.find((s) => (s.plateFile || "").trim() === askedPlate)
      : undefined);
  const found = storyShotForSongCut({
    story: opts.story,
    jobShots: opts.job.shots,
    cut: {
      shotId: hangId || stillId,
      plateFile: askedPlate || jobShot?.plateFile,
    },
  });
  const scene =
    opts.story.scenes.find((sc) => sc.id === (opts.sceneId || "").trim()) ||
    opts.story.scenes.find((sc) => sc.id === found?.sceneId) ||
    opts.story.scenes.find((sc) => sc.shots.some((sh) => sh.id === stillId));
  let storyShot: CrashStoryShot | undefined =
    found?.shot || scene?.shots.find((sh) => sh.id === stillId);
  const plateFile = (
    askedPlate ||
    jobShot?.plateFile ||
    storyShot?.plateFile ||
    ""
  ).trim();
  if (plateFile === "__error__") {
    throw new Error(
      jobShot?.error
        ? `Plate failed — ${jobShot.error}`
        : "Plate failed — pick the face and the place first",
    );
  }
  if (!plateFile) {
    throw new Error("Add a plate image first — tap + on GROK.");
  }
  const song = songFromTrackDraft(opts.job.trackDraft, opts.job.scratchSong);
  let beat: CrashStoryBeat | undefined | null =
    storyShot?.beats.find((b) => b.id === opts.beatId) ||
    beatForSongCut({
      story: opts.story,
      storyShot,
      beatId: opts.beatId,
      songFile: song?.fileName,
    });
  if (!beat && (isMusicVideoSongJob(opts.job) || (song?.fileName || "").trim())) {
    beat = muteSongBeatStub({
      beatId: opts.beatId,
      songFile: song?.fileName,
    });
  }
  if (!storyShot) {
    storyShot = stubStoryShot({
      shotId: stillId || jobShot?.shotId || "shot",
      plateFile,
      beat: beat || undefined,
    });
  }
  if (!beat) {
    throw new Error(
      isMusicVideoSongJob(opts.job)
        ? "That still is not ready. Draw it again, then Send."
        : "That line is missing from the scratch plate",
    );
  }
  return {
    hangId: hangId || stillId,
    stillId: stillId || storyShot.id,
    sceneId: (opts.sceneId || found?.sceneId || scene?.id || jobShot?.sceneId || "").trim(),
    plateFile,
    storyShot,
    beat,
  };
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
  prompt?: string;
  plateFile?: string;
  resolution?: "480p" | "720p" | "1080p";
  keepAudio?: boolean;
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
  const refs = resolveGrokClipRefs(opts);
  const { storyShot, beat, plateFile } = refs;
  const shotId = refs.hangId;
  const sceneId = refs.sceneId;
  const beatId = opts.beatId;
  let job = opts.job;
  const jobId = job.id;

  const platePath = await resolveGrokPlatePath(job, plateFile);
  if (!platePath) throw new Error("Plate file missing on disk");

  const voiceFile = (beat.voiceFile || "").trim();
  const speaker = (beat.speaker || "").trim();
  const line = (beat.text || "").trim();
  const durationSec = snapGrokI2vDurationSec(opts.durationSec ?? 5);
  const motion = stripLtxLipSyncLead(beat.imageMotion || "");
  const typed = (opts.prompt || "").trim();
  const prompt =
    typed ||
    buildSirayI2vPrompt({
      speaker,
      motion,
      staging: storyShot.staging || "",
      imageOnly: true,
    });

  const pending = withSongCookPendingClip({
    clips: job.clips || [],
    beatId,
    hangId: shotId,
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
    const taskId = await grokSubmitVideo({
      prompt,
      imageUrl: await fileToSirayVideoDataUrl(platePath),
      durationSec,
      resolution: opts.resolution,
    });
    const task: ScratchClipTask = {
      taskId,
      shotId,
      sceneId,
      beatId: cookBeatId,
      i2v: GROK_I2V_ID,
      backend: "grok-i2v",
      model: GROK_I2V_MODEL,
      label: `${GROK_I2V_LABEL} · ${durationSec}s`,
      durationSec,
      keepAudio: opts.keepAudio === true,
      startedAt: new Date().toISOString(),
    };
    job = (await patchMobileGenJob(jobId, { scratchClip: task, error: "" }))!;
    return { job, task, model: GROK_I2V_MODEL, label: task.label, durationSec };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    job = await markClipError(jobId, cookBeatId, message);
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
  if (task.keepAudio !== true) stripInventedAudio(localMp4);
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

export function isGrokScratchClipTask(task: ScratchClipTask | null | undefined): boolean {
  if (!task) return false;
  if (task.backend === "grok-i2v") return true;
  if (task.i2v === GROK_I2V_ID) return true;
  return (task.model || "").toLowerCase().includes("grok-imagine-video");
}
