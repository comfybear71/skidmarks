import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import {
  applyArsenalEffectFile,
  arsenalOutputName,
  canApplyArsenalEffect,
  parseArsenalEffectId,
} from "@/lib/arsenalEffects";
import { hangDoneClipOnTrack, stripStockAudio } from "@/lib/stockClipHang";
import { rememberClipTake, clipFileBasename } from "@/lib/mobilePlateClips";
import { uploadMobileMedia, resolveMobileMedia, resolveMobileMediaByFilename } from "@/lib/mobileMediaStore";
import { readMobileGenJob, patchMobileGenJob } from "@/lib/mobileGenJob";
import { readMobileStory } from "@/lib/mobileStoryStore";
import { mobileMediaFolder } from "@/lib/mobileJobFolder";
import { isMusicVideoSongJob } from "@/lib/musicVideoSong";
import { findStoryShot, isSupportShot } from "@/lib/stockFootage";
import { CRASH_DIR } from "@/lib/paths";
import { probeDurationSeconds } from "@/lib/mediaDuration";
import { newId } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * POST { jobId, shotId, effectId, text? }
 * Music-video Support stock only. Re-encodes the hung clip, keeps the old
 * take, hangs the new file on the same plateTiming clock. No cook, no stitch.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      jobId?: string;
      shotId?: string;
      effectId?: string;
      text?: string;
    };
    const jobId = String(body.jobId || "").trim();
    const shotId = String(body.shotId || "").trim();
    const effectId = parseArsenalEffectId(body.effectId);
    if (!jobId || !shotId) {
      return NextResponse.json({ error: "Need jobId and shotId" }, { status: 400 });
    }
    if (!effectId) {
      return NextResponse.json({ error: "Unknown Arsenal effect." }, { status: 400 });
    }

    const job = await readMobileGenJob(jobId);
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    if (!isMusicVideoSongJob(job)) {
      return NextResponse.json(
        { error: "Arsenal of effects is music-video stock only." },
        { status: 400 },
      );
    }
    const story = job.folderName ? await readMobileStory(job.styleId, job.folderName) : null;
    const shot = findStoryShot(story, shotId);
    if (!shot) return NextResponse.json({ error: "Shot not found" }, { status: 404 });
    if (!isSupportShot(shot)) {
      return NextResponse.json(
        { error: "Arsenal of effects is Support stock only. Hero stays on LTX." },
        { status: 400 },
      );
    }

    const beatId = shot.beats[0]?.id || "";
    const clip =
      (job.clips || []).find((c) => c.beatId === beatId && clipFileBasename(c.clipFile || "")) ||
      (job.clips || []).find((c) => (c.shotId || "") === shotId && clipFileBasename(c.clipFile || ""));
    const cut = (job.scratchSong?.cuts || []).find(
      (c) => (c.shotId || "").trim() === shotId && clipFileBasename(c.clipFile || ""),
    );
    const srcName = clipFileBasename(clip?.clipFile || cut?.clipFile || "");
    const gate = canApplyArsenalEffect({
      styleId: job.styleId,
      shot,
      clipFile: srcName,
    });
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: 400 });

    const srcPath = path.join(CRASH_DIR, "ltx", srcName);
    const folder = mobileMediaFolder(job);
    let resolved =
      fs.existsSync(srcPath)
        ? srcPath
        : await resolveMobileMedia({
            styleId: job.styleId,
            folderName: folder,
            kind: "mp4",
            fileName: srcName,
            destPath: srcPath,
          });
    if (!resolved) {
      resolved = await resolveMobileMediaByFilename({
        kind: "mp4",
        fileName: srcName,
        destPath: srcPath,
      });
    }
    if (!resolved || !fs.existsSync(resolved)) {
      return NextResponse.json({ error: "Could not open the hung stock clip." }, { status: 404 });
    }

    const outName = arsenalOutputName(srcName, effectId);
    const destPath = path.join(CRASH_DIR, "ltx", outName);
    applyArsenalEffectFile({
      srcPath: resolved,
      destPath,
      effectId,
      text: String(body.text || shot.title || "").trim(),
    });
    stripStockAudio(destPath);

    try {
      await uploadMobileMedia({
        styleId: job.styleId,
        folderName: job.folderName,
        kind: "mp4",
        localPath: destPath,
      });
    } catch {
      /* local file still usable */
    }

    const durationSec = probeDurationSeconds(destPath);
    const nextClips = (job.clips || []).map((c) => {
      const mine =
        (beatId && c.beatId === beatId) || (c.shotId || "") === shotId;
      if (!mine) return c;
      return {
        ...c,
        ...rememberClipTake(c, destPath),
        clipStatus: "done" as const,
        error: "",
        ...(durationSec ? { durationSec } : {}),
        shotId,
      };
    });
    const hung = hangDoneClipOnTrack({
      song: job.scratchSong,
      shotId,
      plateFile: shot.plateFile || "",
      clipFile: outName,
      newCutId: () => newId("cut"),
    });

    const updated = await patchMobileGenJob(jobId, {
      clips: nextClips,
      ...(hung ? { scratchSong: hung } : {}),
    });
    return NextResponse.json({ ok: true, effectId, clipFile: outName, job: updated });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
