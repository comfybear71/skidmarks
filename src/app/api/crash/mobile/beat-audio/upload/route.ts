import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { storyDialogueDir } from "@/lib/crashStoryLocations";
import { uploadMobileMedia, registerMobileMediaBlob } from "@/lib/mobileMediaStore";
import { readMobileStory } from "@/lib/mobileStoryStore";
import { readMobileGenJob } from "@/lib/mobileGenJob";
import { mobileMediaFolder } from "@/lib/mobileJobFolder";
import { isMobileSavedVoiceFile } from "@/lib/mobileSavedVoice";
import { isSafeMediaName } from "@/lib/cloudMedia";
import { blobPathname } from "@/lib/blobStore";
import { useCloudStore } from "@/lib/cloudEnv";
import {
  attachDroppedBeatMp3,
  findDroppedBeat,
  speakerOnJobCast,
  stampDroppedMp3Name,
} from "@/lib/scratchSongAttach";
import { probeSongDurationSec } from "@/lib/scratchSongSlice";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 40 * 1024 * 1024;

function looksLikeMp3(file: File, buf: Buffer): boolean {
  const name = (file.name || "").toLowerCase();
  if (name.endsWith(".mp3")) return true;
  const mime = (file.type || "").toLowerCase();
  if (mime === "audio/mpeg" || mime === "audio/mp3") return true;
  // ID3 or MPEG frame sync
  if (buf.length >= 3 && buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) {
    return true;
  }
  if (buf.length >= 2 && buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) {
    return true;
  }
  return false;
}

/**
 * POST multipart: jobId, beatId, file [, text] — small mp3 through Studio.
 * POST JSON { action: "prepare" | "attach" } — big songs go to Blob first.
 */
export async function POST(req: Request) {
  const ctype = req.headers.get("content-type") || "";
  try {
    if (ctype.includes("application/json")) {
      return await handleJson(req);
    }
    return await handleMultipart(req);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

async function handleJson(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    jobId?: string;
    beatId?: string;
    text?: string;
    fileName?: string;
    blobUrl?: string;
    durationSec?: number;
  };
  const action = String(body.action || "").trim();
  const jobId = String(body.jobId || "").trim();
  const beatId = String(body.beatId || "").trim();
  const textOverride = String(body.text || "").trim();
  if (!jobId || !beatId) {
    return NextResponse.json({ error: "Need jobId and beatId" }, { status: 400 });
  }

  const job = await readMobileGenJob(jobId);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  const story = await readMobileStory(job.styleId, job.folderName);
  const found = findDroppedBeat(story, beatId);
  if (!found?.speaker) {
    return NextResponse.json(
      { error: "No Scratch beat yet — Draw with a face on the pad first, then drop the mp3." },
      { status: 400 },
    );
  }
  if (!speakerOnJobCast(job, found.speaker)) {
    return NextResponse.json(
      { error: "That line isn't this job's cast — leftover Comfy/Land audio stays parked" },
      { status: 400 },
    );
  }

  const line = textOverride || found.existingText || "dropped line";
  const folderName = mobileMediaFolder(job);

  if (action === "prepare") {
    if (!useCloudStore()) {
      return NextResponse.json(
        { error: "Cloud song drop is off here — drop a smaller mp3 through Studio." },
        { status: 409 },
      );
    }
    const fileName = stampDroppedMp3Name({
      story,
      beatId,
      speaker: found.speaker,
      line,
    });
    const pathname = blobPathname(job.styleId, folderName, "audio", fileName);
    return NextResponse.json({
      ok: true,
      fileName,
      pathname,
      folderName,
    });
  }

  if (action === "attach") {
    const fileName = String(body.fileName || "").trim();
    const blobUrl = String(body.blobUrl || "").trim();
    if (!fileName || !isSafeMediaName(fileName) || !isMobileSavedVoiceFile(fileName)) {
      return NextResponse.json({ error: "Need the stamped song file name" }, { status: 400 });
    }
    if (!blobUrl) {
      return NextResponse.json({ error: "Need the cloud song URL" }, { status: 400 });
    }
    const pathname = blobPathname(job.styleId, folderName, "audio", fileName);
    await registerMobileMediaBlob({
      styleId: job.styleId,
      folderName,
      kind: "audio",
      fileName,
      blobUrl,
      blobPathname: pathname,
    });
    const attachSong = found.scratchBeat || job.styleId === "music_video";
    const attached = await attachDroppedBeatMp3({
      job,
      jobId,
      story,
      beatId,
      fileName,
      textOverride,
      scratchBeat: attachSong,
      durationSec: Number(body.durationSec) || 0,
    });
    return NextResponse.json({
      ok: true,
      voiceFile: fileName,
      job: attached.job,
      durationSec: attachSong ? attached.durationSec : undefined,
    });
  }

  return NextResponse.json({ error: "Need action prepare or attach" }, { status: 400 });
}

async function handleMultipart(req: Request) {
  const form = await req.formData();
  const jobId = String(form.get("jobId") || "").trim();
  const beatId = String(form.get("beatId") || "").trim();
  const textOverride = String(form.get("text") || "").trim();
  const file = form.get("file");
  if (!jobId || !beatId) {
    return NextResponse.json({ error: "Need jobId and beatId" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Need an mp3 file" }, { status: 400 });
  }
  if (file.size <= 0) {
    return NextResponse.json({ error: "That mp3 is empty" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "That mp3 is too large" }, { status: 400 });
  }

  const job = await readMobileGenJob(jobId);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const story = await readMobileStory(job.styleId, job.folderName);
  const found = findDroppedBeat(story, beatId);
  if (!found?.speaker) {
    return NextResponse.json(
      { error: "No Scratch beat yet — Draw with a face on the pad first, then drop the mp3." },
      { status: 400 },
    );
  }
  if (!speakerOnJobCast(job, found.speaker)) {
    return NextResponse.json(
      { error: "That line isn't this job's cast — leftover Comfy/Land audio stays parked" },
      { status: 400 },
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  if (!looksLikeMp3(file, buf)) {
    return NextResponse.json(
      { error: "Need an mp3 — LTX lip-sync only takes mpeg audio." },
      { status: 400 },
    );
  }

  const line = textOverride || found.existingText || "dropped line";
  const fileName = stampDroppedMp3Name({
    story,
    beatId,
    speaker: found.speaker,
    line,
  });

  const dir = storyDialogueDir(job.styleId);
  fs.mkdirSync(dir, { recursive: true });
  const localPath = path.join(dir, fileName);
  fs.writeFileSync(localPath, buf);

  const attachSong = found.scratchBeat || job.styleId === "music_video";
  const durationSec = attachSong ? probeSongDurationSec(localPath) || 0 : 0;
  const attached = await attachDroppedBeatMp3({
    job,
    jobId,
    story,
    beatId,
    fileName,
    textOverride,
    scratchBeat: attachSong,
    durationSec,
  });

  const mediaFolder = mobileMediaFolder(job);
  try {
    await uploadMobileMedia({
      styleId: job.styleId,
      folderName: mediaFolder,
      kind: "audio",
      localPath,
    });
  } catch {
    try {
      await uploadMobileMedia({
        styleId: job.styleId,
        folderName: mediaFolder,
        kind: "audio",
        localPath,
      });
    } catch (e2) {
      const detail = e2 instanceof Error ? e2.message : String(e2);
      return NextResponse.json(
        {
          error: `Mp3 landed on disk but failed to reach cloud storage — ${detail}. Drop it again.`,
        },
        { status: 502 },
      );
    }
  }

  return NextResponse.json({
    ok: true,
    voiceFile: fileName,
    job: attached.job,
    durationSec: attachSong ? attached.durationSec : undefined,
  });
}
