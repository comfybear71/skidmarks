import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { resolveMobileMedia } from "@/lib/mobileMediaStore";
import { cloudBlobRedirect, isSafeMediaName } from "@/lib/cloudMedia";
import { CRASH_DIR } from "@/lib/paths";
import { serveMediaFile } from "@/lib/serveMediaFile";
import type { ShowStyleId } from "@/lib/showStylePresets";
import { parkMobileClipFile } from "@/lib/mobileClipPark";
import { clipQueueError } from "@/lib/mobileClipQueue";
import {
  isEpisodeClipPlanError,
  planBinFailedEpisodeClips,
  planDismissEpisodeClip,
  planRemoveEpisodeClipTake,
} from "@/lib/mobileEpisodeClips";
import { patchMobileGenJob, readMobileGenJob, type MobileGenJob } from "@/lib/mobileGenJob";
import { readMobileStory } from "@/lib/mobileStoryStore";
import { isOffEpisodeDeskShot } from "@/lib/mobileScratch";

export const runtime = "nodejs";

/**
 * GET — stream one shot's mp4 as soon as it renders, rather than only the
 * final stitch. clipFile arrives as a local path from runLtxSmoke, so this
 * only needs the basename either way.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const styleId = (url.searchParams.get("styleId") || "") as ShowStyleId;
  const folderName = url.searchParams.get("folderName") || "";
  const fileName = path.basename(url.searchParams.get("fileName") || "");
  if (!styleId || !folderName || !isSafeMediaName(fileName)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  // LTX clips land in ltx/; Siray Scratch clips land in gen/ as sclip_*.mp4.
  const localPath = path.join(CRASH_DIR, "ltx", fileName);
  const clearedPath = path.join(CRASH_DIR, "ltx", "_cleared", fileName);
  const genPath = path.join(CRASH_DIR, "gen", fileName);
  let filePath: string | null = fs.existsSync(localPath)
    ? localPath
    : fs.existsSync(clearedPath)
      ? clearedPath
      : /^(sclip_|gclip_|hclip_)/.test(fileName) && fs.existsSync(genPath)
        ? genPath
        : null;
  if (!filePath) {
    filePath = await resolveMobileMedia({
      styleId,
      folderName,
      kind: "mp4",
      fileName,
      destPath: /^(sclip_|gclip_|hclip_)/.test(fileName) ? genPath : localPath,
    });
  }
  if (filePath && fs.existsSync(filePath)) {
    return serveMediaFile(req, filePath, "video/mp4", {
      "Cache-Control": "private, max-age=120",
    });
  }
  const cloud = await cloudBlobRedirect("mp4", fileName, req);
  if (cloud) return cloud;
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

/**
 * POST { jobId, action }
 *   remove-clip — park one playable take (✕ on the /m player). File goes to
 *     _cleared/, not deleted. Scratch pad still uses /scratch remove-clip.
 *   dismiss — bin a failed Generate with no mp4 (pink error, no player).
 *     Prior takes stay.
 *   bin-failed — dismiss every failed episode-desk clip. Scratch/campaign
 *     errors stay. If the job was stuck in phase error, it returns to review.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      action?: string;
      jobId?: string;
      beatId?: string;
      fileName?: string;
    };
    const jobId = (body.jobId || "").trim();
    const action = (body.action || "").trim().toLowerCase();
    if (!jobId) return NextResponse.json({ error: "Need jobId" }, { status: 400 });
    if (action !== "remove-clip" && action !== "dismiss" && action !== "bin-failed") {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    const job = await readMobileGenJob(jobId);
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    let story = null;
    if (job.folderName) {
      try {
        story = await readMobileStory(job.styleId, job.folderName);
      } catch {
        story = null;
      }
    }
    const isEpisode = (clip: { shotId: string }) =>
      !isOffEpisodeDeskShot(job, clip.shotId, story);

    const plan =
      action === "remove-clip"
        ? planRemoveEpisodeClipTake(job.clips || [], body.beatId || "", body.fileName || "", isEpisode)
        : action === "dismiss"
          ? planDismissEpisodeClip(job.clips || [], body.beatId || "", isEpisode)
          : planBinFailedEpisodeClips(job.clips || [], isEpisode);
    if (isEpisodeClipPlanError(plan)) {
      return NextResponse.json({ error: plan.error }, { status: plan.status });
    }

    const parked: string[] = [];
    for (const file of plan.filesToPark) {
      const moved = parkMobileClipFile(file);
      if (moved) parked.push(moved);
    }

    const deskClips = plan.next.filter((c) => isEpisode(c));
    const failed = clipQueueError(deskClips);
    const patch: Partial<MobileGenJob> = {
      clips: plan.next,
      error: failed,
    };
    const stillRunning = deskClips.some((c) => c.clipStatus === "running");
    if (job.phase === "error" && plan.clearedEpisodeErrors && !stillRunning) {
      patch.phase = "review";
    }
    const updated = await patchMobileGenJob(jobId, patch);
    return NextResponse.json({
      ok: true,
      job: updated || { ...job, ...patch },
      parked: parked.length ? parked : null,
      parkedIn: parked.length ? "_cleared/" : null,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
