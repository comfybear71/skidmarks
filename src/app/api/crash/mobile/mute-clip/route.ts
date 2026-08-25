import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import {
  finishScratchGrokClip,
  isGrokScratchClipTask,
  submitScratchGrokClip,
} from "@/lib/grokScratchClip";
import { grokVideoConfigured } from "@/lib/grokVideo";
import { GROK_I2V_DEFAULT_SEC, snapGrokI2vDurationSec } from "@/lib/grokI2v";
import { hangClipOnTrack } from "@/lib/musicVideoTrack";
import { hydrateMobilePackOnDisk, readMobileStory, writeMobileStory } from "@/lib/mobileStoryStore";
import { patchMobileGenJob, readMobileGenJob } from "@/lib/mobileGenJob";
import { clipFileBasename } from "@/lib/mobilePlateClips";
import { uploadMobileMedia } from "@/lib/mobileMediaStore";
import { mobileMediaFolder } from "@/lib/mobileJobFolder";
import { stripLtxLipSyncLead } from "@/lib/mobileImageMotion";
import { CRASH_DIR } from "@/lib/paths";
import { newId } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const MUTE_MOTION =
  "Mouth closed. Not singing. Not lip-sync. Empty hands. No instruments. No phone. No extra people. Camera holds. Same face and place as the start image.";

function genDir() {
  const d = path.join(CRASH_DIR, "gen");
  fs.mkdirSync(d, { recursive: true });
  return d;
}

/**
 * Mute Grok clips on a live episode plate — not Scratch, not LTX+mp3.
 *   start — submit Imagine video from the still
 *   poll  — finish when xAI is done
 *   hang  — one TRACK write: cut clipFile+done and plateTiming
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      action?: string;
      jobId?: string;
      shotId?: string;
      beatId?: string;
      durationSec?: number;
      startMs?: number;
      endMs?: number;
      sortIndex?: number;
      clipFile?: string;
      fileName?: string;
      imageMotion?: string;
    };
    const action = (body.action || "").trim();
    const jobId = (body.jobId || "").trim();
    if (!jobId) return NextResponse.json({ error: "Need jobId" }, { status: 400 });
    const job = await readMobileGenJob(jobId);
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    if (!job.folderName) {
      return NextResponse.json({ error: "Lock the pack first" }, { status: 400 });
    }

    if (action === "start") {
      if (!grokVideoConfigured()) {
        return NextResponse.json({ error: "Missing XAI_API_KEY — https://console.x.ai" }, { status: 400 });
      }
      const shotId = (body.shotId || "").trim();
      if (!shotId) return NextResponse.json({ error: "Need shotId" }, { status: 400 });
      await hydrateMobilePackOnDisk(job.styleId, job.folderName);
      let story = await readMobileStory(job.styleId, job.folderName);
      const scene = story.scenes.find((sc) => sc.shots.some((sh) => sh.id === shotId));
      const shot = scene?.shots.find((sh) => sh.id === shotId);
      if (!scene || !shot) {
        return NextResponse.json({ error: "That plate is not on this episode" }, { status: 404 });
      }
      const wantBeat = (body.beatId || "").trim();
      const beat =
        (wantBeat && shot.beats.find((b) => b.id === wantBeat)) ||
        shot.beats[0];
      if (!beat) {
        return NextResponse.json({ error: "That plate has no beat" }, { status: 400 });
      }
      const motion = stripLtxLipSyncLead(body.imageMotion || beat.imageMotion || MUTE_MOTION);
      if (stripLtxLipSyncLead(beat.imageMotion || "") !== motion) {
        story = {
          ...story,
          scenes: story.scenes.map((sc) => ({
            ...sc,
            shots: sc.shots.map((sh) =>
              sh.id !== shotId
                ? sh
                : {
                    ...sh,
                    beats: sh.beats.map((b) => (b.id === beat.id ? { ...b, imageMotion: motion } : b)),
                  },
            ),
          })),
        };
        await writeMobileStory(story, job.folderName);
      }
      const durationSec = snapGrokI2vDurationSec(Number(body.durationSec ?? GROK_I2V_DEFAULT_SEC));
      const drawn = await submitScratchGrokClip({
        job,
        story,
        shotId,
        sceneId: scene.id,
        beatId: beat.id,
        durationSec,
      });
      return NextResponse.json({
        ok: true,
        pending: true,
        job: drawn.job,
        shotId,
        beatId: beat.id,
        durationSec: drawn.durationSec,
        model: drawn.model,
        label: drawn.label,
      });
    }

    if (action === "poll") {
      const task = job.scratchClip;
      if (!task?.taskId || !isGrokScratchClipTask(task)) {
        const shotId = (body.shotId || "").trim();
        const landed = (job.clips || []).find(
          (c) =>
            c.clipFile &&
            c.clipStatus === "done" &&
            (!shotId || c.shotId === shotId),
        );
        if (landed?.clipFile) {
          return NextResponse.json({
            ok: true,
            pending: false,
            recovered: true,
            job,
            clipFile: clipFileBasename(landed.clipFile),
            shotId: landed.shotId,
            beatId: landed.beatId,
          });
        }
        return NextResponse.json({ error: "No mute Grok clip in flight" }, { status: 400 });
      }
      const tick = await finishScratchGrokClip({ job, task });
      if (tick.pending) {
        return NextResponse.json({
          ok: true,
          pending: true,
          job: tick.job,
          shotId: task.shotId,
          beatId: task.beatId,
        });
      }
      const landed = (tick.job.clips || []).find((c) => c.beatId === task.beatId && c.clipFile);
      return NextResponse.json({
        ok: true,
        pending: false,
        job: tick.job,
        clipFile: clipFileBasename(landed?.clipFile || ""),
        shotId: task.shotId,
        beatId: task.beatId,
      });
    }

    if (action === "hang") {
      const song = job.scratchSong;
      if (!song?.fileName) {
        return NextResponse.json({ error: "Add the song before you hang a clip" }, { status: 400 });
      }
      const shotId = (body.shotId || "").trim();
      if (!shotId) return NextResponse.json({ error: "Need shotId" }, { status: 400 });
      const shot = job.shots.find((s) => s.shotId === shotId);
      const plateFile = (shot?.plateFile || "").trim();
      if (!plateFile || plateFile === "__error__") {
        return NextResponse.json({ error: "Draw the still first" }, { status: 400 });
      }
      let clipFile = clipFileBasename(body.clipFile || "");
      if (!clipFile) {
        const fromClip = (job.clips || []).find((c) => c.shotId === shotId && c.clipFile);
        clipFile = clipFileBasename(fromClip?.clipFile || "");
      }
      if (!clipFile) {
        return NextResponse.json({ error: "Need a finished clip file" }, { status: 400 });
      }
      const wantName = clipFileBasename(body.fileName || "");
      if (wantName && wantName !== clipFile) {
        const src = path.join(genDir(), clipFile);
        const dest = path.join(genDir(), wantName);
        if (fs.existsSync(src) && src !== dest) {
          fs.copyFileSync(src, dest);
          try {
            await uploadMobileMedia({
              styleId: job.styleId,
              folderName: mobileMediaFolder(job),
              kind: "mp4",
              localPath: dest,
            });
          } catch {
            /* hang still uses the local name */
          }
          clipFile = wantName;
        }
      }
      const durationSec = Math.max(1, (Number(body.endMs) - Number(body.startMs)) / 1000 || 5);
      const startMs = Math.max(0, Math.round(Number(body.startMs) || 0));
      const endMs = Math.max(startMs + 100, Math.round(Number(body.endMs) || startMs + durationSec * 1000));
      const sortIndex = Math.round(Number(body.sortIndex) ?? (song.plateTimings || []).length);
      const hung = hangClipOnTrack(song, {
        plateId: shotId,
        plateFile,
        clipFile,
        startMs,
        endMs,
        sortIndex,
        newCutId: () => newId("cut"),
      });
      let clips = job.clips || [];
      if (clips.some((c) => c.shotId === shotId)) {
        clips = clips.map((c) =>
          c.shotId === shotId ? { ...c, clipFile, clipStatus: "done" as const, error: "" } : c,
        );
      }
      const updated = await patchMobileGenJob(jobId, {
        clips,
        scratchSong: { ...song, plateTimings: hung.plateTimings, cuts: hung.cuts },
        error: "",
      });
      return NextResponse.json({
        ok: true,
        job: updated,
        clipFile,
        fileName: wantName || clipFile,
        timing: hung.plateTimings.find((p) => p.plateId === shotId),
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
