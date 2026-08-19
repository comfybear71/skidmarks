import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { randomUUID } from "crypto";
import { previousDoneClipOnShot } from "./mobileClipQueue";
import { clipFileBasename } from "./mobilePlateClips";
import { resolveFfmpeg } from "./mobileStitch";
import { CRASH_DIR } from "./paths";
import type { MobileClipUnit } from "./mobileGenJob";
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
  if (path.isAbsolute(opts.clipFile) && fs.existsSync(opts.clipFile)) return opts.clipFile;
  const { resolveMobileMedia } = await import("./mobileMediaStore");
  return resolveMobileMedia({
    styleId: opts.styleId,
    folderName: opts.folderName,
    kind: "mp4",
    fileName,
    destPath: localPath,
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
