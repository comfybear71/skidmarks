import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { randomUUID } from "crypto";
import { previousDoneClipOnShot } from "./mobileClipQueue";
import { clipFileBasename } from "./mobilePlateClips";
import { clipTailPlateFileName, previousDoneClipOnStill } from "./clipTailStart";
import { mobileMediaFolder } from "./mobileJobFolder";
import { uploadMobileMedia } from "./mobileMediaStore";
import { resolveFfmpeg } from "./mobileStitch";
import { CRASH_DIR } from "./paths";
import type { MobileClipUnit, MobileGenJob } from "./mobileGenJob";
import type { ShowStyleId } from "./showStylePresets";

function ltxClipPath(fileName: string): string {
  return path.join(CRASH_DIR, "ltx", fileName);
}

/** Local ltx/ first (same as /api/crash/mobile/clip), then Blob. */
export async function resolveClipMp4(opts: {
  styleId: ShowStyleId;
  folderName: string;
  clipFile: string;
}): Promise<string | null> {
  const fileName = clipFileBasename(opts.clipFile);
  if (!fileName) return null;
  const localPath = ltxClipPath(fileName);
  const clearedPath = path.join(CRASH_DIR, "ltx", "_cleared", fileName);
  if (fs.existsSync(localPath)) return localPath;
  if (fs.existsSync(clearedPath)) return clearedPath;
  const genPath = path.join(CRASH_DIR, "gen", fileName);
  if (/^(sclip_|gclip_|hclip_)/.test(fileName) && fs.existsSync(genPath)) return genPath;
  if (path.isAbsolute(opts.clipFile) && fs.existsSync(opts.clipFile)) return opts.clipFile;
  const { resolveMobileMedia } = await import("./mobileMediaStore");
  return resolveMobileMedia({
    styleId: opts.styleId,
    folderName: opts.folderName,
    kind: "mp4",
    fileName,
    destPath: /^(sclip_|gclip_|hclip_)/.test(fileName) ? genPath : localPath,
  });
}

/**
 * Last decoded frame of a clip — used as the start still of the next chunk
 * so a split rant does not snap back to the original plate pose.
 */
export function extractClipTailFrame(mp4Path: string): string {
  const { bin, tried } = resolveFfmpeg();
  const ffmpeg = bin || "ffmpeg";
  const out = path.join(os.tmpdir(), `ltx-tail-${randomUUID()}.jpg`);
  const attempts: string[][] = [
    ["-y", "-sseof", "-0.15", "-i", mp4Path, "-frames:v", "1", "-q:v", "2", out],
    ["-y", "-sseof", "-0.04", "-i", mp4Path, "-frames:v", "1", "-q:v", "2", out],
    ["-y", "-i", mp4Path, "-vf", "reverse", "-frames:v", "1", "-q:v", "2", out],
  ];
  let lastWhy = "";
  for (const args of attempts) {
    try {
      execFileSync(ffmpeg, args, { timeout: 60_000, stdio: "pipe" });
      if (fs.existsSync(out) && fs.statSync(out).size > 0) return out;
    } catch (e) {
      lastWhy = e instanceof Error ? e.message : String(e);
    }
  }
  fs.rmSync(out, { force: true });
  throw new Error(
    bin
      ? `Could not pull the last frame from ${path.basename(mp4Path)} using ${bin} — ${lastWhy}`
      : `No packaged ffmpeg found and none on PATH — ${lastWhy}. Looked in: ${tried.join(", ")}`,
  );
}

export async function startStillForNextClip(opts: {
  styleId: ShowStyleId;
  folderName: string;
  clips: MobileClipUnit[];
  next: Pick<MobileClipUnit, "beatId" | "shotId">;
  defaultPlatePath: string;
  skip?: (clip: Pick<MobileClipUnit, "beatId" | "shotId" | "clipStatus" | "clipFile">) => boolean;
}): Promise<{ platePath: string; chainedFromBeatId: string | null; tailStillPath: string | null }> {
  const prev = previousDoneClipOnShot(opts.clips, opts.next, opts.skip);
  if (!prev) {
    return { platePath: opts.defaultPlatePath, chainedFromBeatId: null, tailStillPath: null };
  }
  const mp4 = await resolveClipMp4({
    styleId: opts.styleId,
    folderName: opts.folderName,
    clipFile: prev.clipFile,
  });
  if (!mp4) {
    throw new Error(
      `Previous clip on this shot (${prev.beatId}) has no mp4 to chain from — ` +
        `the last frame is the next line's first frame`,
    );
  }
  const tailStillPath = extractClipTailFrame(mp4);
  return { platePath: tailStillPath, chainedFromBeatId: prev.beatId, tailStillPath };
}

export function dropTailStill(tailStillPath: string | null | undefined): void {
  if (!tailStillPath) return;
  fs.rmSync(tailStillPath, { force: true });
}

/**
 * Pull the last frame of a clip and keep it as a plate still.
 * Does not overwrite the card's plateFile. Same clip → same tail file.
 */
export async function landClipTailPlate(opts: {
  job: MobileGenJob;
  clipFile: string;
}): Promise<string> {
  const fileName = clipTailPlateFileName(opts.clipFile);
  if (!fileName) throw new Error("That clip has no file to pull a last frame from.");
  const dest = path.join(CRASH_DIR, "gen", fileName);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
    try {
      await uploadMobileMedia({
        styleId: opts.job.styleId,
        folderName: mobileMediaFolder(opts.job),
        kind: "plates",
        localPath: dest,
      });
    } catch {
      /* already on disk this request */
    }
    return fileName;
  }
  const mp4 = await resolveClipMp4({
    styleId: opts.job.styleId,
    folderName: mobileMediaFolder(opts.job),
    clipFile: opts.clipFile,
  });
  if (!mp4) throw new Error("Clip 1 has no file to pull a last frame from.");
  const tmp = extractClipTailFrame(mp4);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(tmp, dest);
  dropTailStill(tmp);
  try {
    await uploadMobileMedia({
      styleId: opts.job.styleId,
      folderName: mobileMediaFolder(opts.job),
      kind: "plates",
      localPath: dest,
    });
  } catch {
    /* still usable this request */
  }
  return fileName;
}

/** Last frame of the latest done clip on this still, saved as a plate. */
export async function landStillClipTailPlate(opts: {
  job: MobileGenJob;
  shotId: string;
  clipFile?: string;
}): Promise<{ fileName: string; clipFile: string } | null> {
  const asked = clipFileBasename(opts.clipFile || "");
  const prior = asked
    ? (opts.job.clips || []).find((c) => clipFileBasename(c.clipFile || "") === asked) ||
      previousDoneClipOnStill(opts.job.clips, opts.shotId)
    : previousDoneClipOnStill(opts.job.clips, opts.shotId);
  const clipFile = asked || clipFileBasename(prior?.clipFile || "");
  if (!clipFile) return null;
  const fileName = await landClipTailPlate({ job: opts.job, clipFile });
  return { fileName, clipFile };
}

/**
 * Clip 2 start still = last frame of clip 1, unless he picked another plate.
 */
export async function resolveStartPlateForNextClip(opts: {
  job: MobileGenJob;
  shotId: string;
  askedPlate?: string;
  fallback?: string;
}): Promise<string> {
  const asked = (opts.askedPlate || "").trim();
  const fallback = (opts.fallback || "").trim();
  const prior = previousDoneClipOnStill(opts.job.clips, opts.shotId);
  const tailName = prior ? clipTailPlateFileName(prior.clipFile || "") : "";
  if (prior && (!asked || asked === tailName || asked === fallback)) {
    const landed = await landStillClipTailPlate({
      job: opts.job,
      shotId: opts.shotId,
      clipFile: prior.clipFile,
    });
    if (landed?.fileName) return landed.fileName;
  }
  return asked || fallback;
}
