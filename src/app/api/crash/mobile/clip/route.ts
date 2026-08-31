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
} from "@/lib/mobileEpisodeClips";
import { planParkDeskClipTake } from "@/lib/parkDeskClip";
import { patchMobileGenJob, readMobileGenJob, type MobileGenJob } from "@/lib/mobileGenJob";
import { hydrateMobilePackOnDisk, readMobileStory } from "@/lib/mobileStoryStore";
import { isOffEpisodeDeskShot } from "@/lib/mobileScratch";
import {
  finishScratchMinimaxClip,
  isMinimaxScratchClipTask,
  submitScratchMinimaxClip,
} from "@/lib/minimaxScratchClip";
import {
  finishScratchGrokClip,
  isGrokScratchClipTask,
  submitScratchGrokClip,
} from "@/lib/grokScratchClip";
import { parseScratchClipEngine } from "@/lib/sirayI2v";
import { GROK_I2V_ID } from "@/lib/grokI2v";
import { MINIMAX_H3_ID, parseMinimaxH3Camera, parseMinimaxH3Resolution } from "@/lib/minimaxH3";
import { parseGrokImagineVideoRes } from "@/lib/grokImagine";
import { grokVideoConfigured } from "@/lib/grokVideo";
import { minimaxVideoConfigured } from "@/lib/minimaxVideo";

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
 *     _cleared/, not deleted. Music video also clears the matching song cut
 *     so the Clips rail does not draw the file again. Scratch pad still
 *     uses /scratch remove-clip.
 *   dismiss — bin a failed Generate with no mp4 (pink error, no player).
 *     Prior takes stay.
 *   bin-failed — dismiss every failed episode-desk clip. Scratch/campaign
 *     errors stay. If the job was stuck in phase error, it returns to review.
 *   cook — H3 or GROK on a talking-desk line. Does not rewrite LTX Generate.
 *   cook-poll — one H3 / GROK tick until the mp4 lands.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      action?: string;
      jobId?: string;
      beatId?: string;
      fileName?: string;
      shotId?: string;
      clipEngine?: string;
      durationSec?: number;
      endPlateFile?: string;
      resolution?: string;
      h3Camera?: string;
      plateFile?: string;
      prompt?: string;
      keepAudio?: boolean;
    };
    const jobId = (body.jobId || "").trim();
    const action = (body.action || "").trim().toLowerCase();
    if (!jobId) return NextResponse.json({ error: "Need jobId" }, { status: 400 });
    if (
      action !== "remove-clip" &&
      action !== "dismiss" &&
      action !== "bin-failed" &&
      action !== "cook" &&
      action !== "cook-poll"
    ) {
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

    if (action === "cook" || action === "cook-poll") {
      if (!job.folderName) {
        return NextResponse.json({ error: "Lock the episode first" }, { status: 400 });
      }
      await hydrateMobilePackOnDisk(job.styleId, job.folderName);
      const liveStory = story || (await readMobileStory(job.styleId, job.folderName));
      if (action === "cook-poll") {
        const task = job.scratchClip;
        if (!task?.taskId) {
          const beatId = (body.beatId || "").trim();
          const landed = (job.clips || []).find(
            (c) =>
              (!beatId || c.beatId === beatId) &&
              c.clipFile &&
              c.clipStatus === "done",
          );
          if (landed?.clipFile) {
            return NextResponse.json({ ok: true, pending: false, recovered: true, job });
          }
          return NextResponse.json(
            { error: "No cook in flight — tap Generate again. The episode is still there." },
            { status: 400 },
          );
        }
        try {
          const tick = isMinimaxScratchClipTask(task)
            ? await finishScratchMinimaxClip({ job, task })
            : isGrokScratchClipTask(task)
              ? await finishScratchGrokClip({ job, task })
              : null;
          if (!tick) {
            return NextResponse.json({ error: "That cook is not H3 or GROK." }, { status: 400 });
          }
          return NextResponse.json({ ok: true, pending: tick.pending, job: tick.job });
        } catch (e) {
          return NextResponse.json(
            { error: e instanceof Error ? e.message : String(e) },
            { status: 502 },
          );
        }
      }
      let clipPick: ReturnType<typeof parseScratchClipEngine>;
      try {
        clipPick = parseScratchClipEngine(body.clipEngine);
      } catch (e) {
        return NextResponse.json(
          { error: e instanceof Error ? e.message : String(e) },
          { status: 400 },
        );
      }
      if (clipPick !== MINIMAX_H3_ID && clipPick !== GROK_I2V_ID) {
        return NextResponse.json(
          { error: "Talking desk cook is H3 or GROK. Lip-sync stays on Generate / LTX." },
          { status: 400 },
        );
      }
      const beatId = (body.beatId || "").trim();
      const shotId = (body.shotId || "").trim();
      if (!beatId || !shotId) {
        return NextResponse.json({ error: "Need shotId and beatId" }, { status: 400 });
      }
      const scene = liveStory.scenes.find((sc) => sc.shots.some((sh) => sh.id === shotId));
      const shot = scene?.shots.find((sh) => sh.id === shotId);
      if (!scene || !shot) {
        return NextResponse.json({ error: "That still is not on this pack." }, { status: 404 });
      }
      if (!shot.beats.some((b) => b.id === beatId)) {
        return NextResponse.json({ error: "That line is not on this still." }, { status: 404 });
      }
      if (!job.shots.some((s) => s.shotId === shotId)) {
        return NextResponse.json(
          { error: "That plate is not on this job — Add it on the place, then Generate." },
          { status: 400 },
        );
      }
      try {
        if (clipPick === MINIMAX_H3_ID) {
          if (!minimaxVideoConfigured()) {
            return NextResponse.json({ error: "H3 is not on this Studio." }, { status: 400 });
          }
          const drawn = await submitScratchMinimaxClip({
            job,
            story: liveStory,
            shotId,
            sceneId: scene.id,
            beatId,
            durationSec: body.durationSec,
            endPlateFile: String(body.endPlateFile || "").trim() || undefined,
            resolution: parseMinimaxH3Resolution(body.resolution),
            camera: parseMinimaxH3Camera(body.h3Camera),
          });
          return NextResponse.json({
            ok: true,
            pending: true,
            job: drawn.job,
            backend: "minimax-h3",
            clipEngine: MINIMAX_H3_ID,
            durationSec: drawn.durationSec,
          });
        }
        if (!grokVideoConfigured()) {
          return NextResponse.json({ error: "GROK is not on this Studio." }, { status: 400 });
        }
        const drawn = await submitScratchGrokClip({
          job,
          story: liveStory,
          shotId,
          sceneId: scene.id,
          beatId,
          durationSec: body.durationSec,
          prompt: String(body.prompt || "").trim() || undefined,
          plateFile: String(body.plateFile || "").trim() || undefined,
          resolution: parseGrokImagineVideoRes(body.resolution),
          keepAudio: body.keepAudio === true,
        });
        return NextResponse.json({
          ok: true,
          pending: true,
          job: drawn.job,
          backend: "grok-i2v",
          clipEngine: GROK_I2V_ID,
          durationSec: drawn.durationSec,
        });
      } catch (e) {
        return NextResponse.json(
          { error: e instanceof Error ? e.message : String(e) },
          { status: 502 },
        );
      }
    }

    if (action === "remove-clip") {
      const plan = planParkDeskClipTake({
        clips: job.clips || [],
        song: job.scratchSong,
        beatId: body.beatId || "",
        fileName: body.fileName || "",
        isEpisode,
      });
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
      if (plan.nextSong) patch.scratchSong = plan.nextSong;
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
        stoppedCook: plan.stoppedCook,
      });
    }

    const plan =
      action === "dismiss"
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
