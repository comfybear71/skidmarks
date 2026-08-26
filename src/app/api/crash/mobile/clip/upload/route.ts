import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { readMobileGenJob, patchMobileGenJob, type MobileClipUnit } from "@/lib/mobileGenJob";
import { humanOrderedClipName, rememberClipTake } from "@/lib/mobilePlateClips";
import { uploadMobileMedia } from "@/lib/mobileMediaStore";
import { readMobileStory } from "@/lib/mobileStoryStore";
import { newId, sortableId } from "@/lib/types";
import { CRASH_DIR } from "@/lib/paths";
import { probeDurationSeconds } from "@/lib/mediaDuration";
import { hangDoneClipOnTrack, stripStockAudio } from "@/lib/stockClipHang";
import { isMusicVideoSongJob } from "@/lib/musicVideoSong";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST multipart: jobId, beatId, file — attach a clip made elsewhere (Grok
 * video, an earlier LTX Director export, stock, anything) as this beat's
 * finished clip, instead of generating one. Marks the clip done and skips
 * it on the next animate step, the same way a successful render would.
 *
 * source=stock — strip audio (our mix stays on TRACK) and hang the cut
 * onto an existing plateTiming clock. Does not invent 15s rows.
 */
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const jobId = String(form.get("jobId") || "").trim();
    const beatId = String(form.get("beatId") || "").trim();
    const source = String(form.get("source") || "").trim().toLowerCase();
    const file = form.get("file");
    if (!jobId || !beatId) {
      return NextResponse.json({ error: "Need jobId and beatId" }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Need a video file" }, { status: 400 });
    }

    const job = await readMobileGenJob(jobId);
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    const story = job.folderName ? await readMobileStory(job.styleId, job.folderName) : null;
    let home: {
      shotId: string;
      sceneId: string;
      speaker: string;
      line: string;
      title: string;
      plateFile: string;
    } | null = null;
    for (const scene of story?.scenes || []) {
      for (const shot of scene.shots) {
        const beat = shot.beats.find((b) => b.id === beatId);
        if (!beat) continue;
        home = {
          shotId: shot.id,
          sceneId: scene.id,
          speaker: beat.speaker,
          line: beat.text,
          title: shot.title,
          plateFile: shot.plateFile || "",
        };
        break;
      }
      if (home) break;
    }

    let clips = job.clips || [];
    if (!clips.some((c) => c.beatId === beatId)) {
      if (!home) {
        return NextResponse.json({ error: "No such clip on this job" }, { status: 404 });
      }
      const fresh: MobileClipUnit = {
        beatId,
        shotId: home.shotId,
        sceneId: home.sceneId,
        clipFile: "",
        clipStatus: "pending",
        error: "",
        speaker: home.speaker,
        line: home.line,
      };
      clips = [...clips, fresh];
    }

    const dir = path.join(CRASH_DIR, "ltx");
    fs.mkdirSync(dir, { recursive: true });
    const existing = clips.filter((c) => c.clipFile).length + 1;
    const fileName =
      source === "stock"
        ? humanOrderedClipName({
            index: existing,
            speaker: "stock",
            title: home?.title || "clip",
          })
        : `${sortableId("byoclip")}.mp4`;
    const localPath = path.join(dir, fileName);
    fs.writeFileSync(localPath, Buffer.from(await file.arrayBuffer()));
    if (source === "stock") stripStockAudio(localPath);
    const durationSec = probeDurationSeconds(localPath);

    try {
      await uploadMobileMedia({
        styleId: job.styleId,
        folderName: job.folderName,
        kind: "mp4",
        localPath,
      });
    } catch {
      /* best effort — clip still usable this request; stitch falls back to local disk */
    }

    const next = clips.map((c) =>
      c.beatId === beatId
        ? {
            ...c,
            ...rememberClipTake(c, localPath),
            clipStatus: "done" as const,
            error: "",
            ...(durationSec ? { durationSec } : {}),
            ...(home ? { shotId: home.shotId, sceneId: home.sceneId } : {}),
          }
        : c,
    );
    const hung =
      isMusicVideoSongJob(job) && home
        ? hangDoneClipOnTrack({
            song: job.scratchSong,
            shotId: home.shotId,
            plateFile: home.plateFile,
            clipFile: fileName,
            newCutId: () => newId("cut"),
          })
        : null;
    const updated = await patchMobileGenJob(jobId, {
      clips: next,
      ...(hung ? { scratchSong: hung } : {}),
    });
    return NextResponse.json({ ok: true, job: updated });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
