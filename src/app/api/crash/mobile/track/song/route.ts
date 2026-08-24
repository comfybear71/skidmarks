import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { patchMobileGenJob, readMobileGenJob } from "@/lib/mobileGenJob";
import { mobileMediaFolder } from "@/lib/mobileJobFolder";
import { registerMobileMediaBlob, resolveMobileMedia, uploadMobileMedia } from "@/lib/mobileMediaStore";
import { storyDialogueDir } from "@/lib/crashStoryLocations";
import { isSafeMediaName } from "@/lib/cloudMedia";
import { probeSongDurationSec } from "@/lib/scratchSongSlice";
import { serveMediaFile } from "@/lib/serveMediaFile";
import { slugToken } from "@/lib/crashStoryNames";
import { sortableId } from "@/lib/types";
import { blobPathname } from "@/lib/blobStore";
import { useCloudStore } from "@/lib/cloudEnv";
import type { ShowStyleId } from "@/lib/showStylePresets";
import type { MobileGenJob } from "@/lib/mobileGenJob";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_BYTES = 40 * 1024 * 1024;

function stampTrackSongName(rawName: string): string {
  return `song_${slugToken(rawName.replace(/\.mp3$/i, ""), 32)}_${sortableId("s")}.mp3`;
}

async function rememberTrackSong(
  jobId: string,
  job: MobileGenJob,
  stamped: string,
  durationSec: number,
): Promise<MobileGenJob | null> {
  return patchMobileGenJob(jobId, {
    trackDraft: {
      ...(job.trackDraft || {}),
      songFile: stamped,
      songDurationSec: durationSec,
      waveformPeaks: undefined,
    },
    error: "",
  });
}

/**
 * The song, saved the moment it is dropped.
 *
 * Small files can come through Studio as FormData. Jack Ash songs are bigger
 * than Vercel's ~4.5MB body limit, so those prepare → client Blob → attach.
 * No beat needed — the job remembers the file name.
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
    name?: string;
    fileName?: string;
    blobUrl?: string;
    durationSec?: number;
  };
  const action = String(body.action || "").trim();
  const jobId = String(body.jobId || "").trim();
  if (!jobId) {
    return NextResponse.json({ error: "Need jobId" }, { status: 400 });
  }

  const job = await readMobileGenJob(jobId);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  const folderName = mobileMediaFolder(job);

  if (action === "prepare") {
    if (!useCloudStore()) {
      return NextResponse.json(
        { error: "Cloud song drop is off here — drop a smaller mp3 through Studio." },
        { status: 409 },
      );
    }
    const stamped = stampTrackSongName(String(body.name || "song.mp3"));
    if (!isSafeMediaName(stamped)) {
      return NextResponse.json({ error: "Couldn't name that song file" }, { status: 400 });
    }
    return NextResponse.json({
      ok: true,
      fileName: stamped,
      pathname: blobPathname(job.styleId, folderName, "audio", stamped),
      folderName,
    });
  }

  if (action === "attach") {
    const fileName = String(body.fileName || "").trim();
    const blobUrl = String(body.blobUrl || "").trim();
    if (!fileName || !isSafeMediaName(fileName)) {
      return NextResponse.json({ error: "Need the stamped song file name" }, { status: 400 });
    }
    if (!blobUrl) {
      return NextResponse.json({ error: "Need the cloud song URL" }, { status: 400 });
    }
    await registerMobileMediaBlob({
      styleId: job.styleId,
      folderName,
      kind: "audio",
      fileName,
      blobUrl,
      blobPathname: blobPathname(job.styleId, folderName, "audio", fileName),
    });
    const durationSec = Number(body.durationSec) || 0;
    const updated = await rememberTrackSong(jobId, job, fileName, durationSec);
    return NextResponse.json({ ok: true, job: updated, fileName, durationSec });
  }

  return NextResponse.json({ error: "Need action prepare or attach" }, { status: 400 });
}

async function handleMultipart(req: Request) {
  const form = await req.formData();
  const jobId = String(form.get("jobId") || "").trim();
  const file = form.get("file");
  if (!jobId || !(file instanceof File)) {
    return NextResponse.json({ error: "Need jobId and an mp3" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "That mp3 is too big for a direct upload" }, { status: 413 });
  }

  const job = await readMobileGenJob(jobId);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const stamped = stampTrackSongName(file.name || "song.mp3");
  if (!isSafeMediaName(stamped)) {
    return NextResponse.json({ error: "Couldn't name that song file" }, { status: 400 });
  }

  const folderName = mobileMediaFolder(job);
  const dir = storyDialogueDir(job.styleId);
  fs.mkdirSync(dir, { recursive: true });
  const localPath = path.join(dir, stamped);
  fs.writeFileSync(localPath, Buffer.from(await file.arrayBuffer()));

  try {
    await uploadMobileMedia({
      styleId: job.styleId,
      folderName,
      kind: "audio",
      localPath,
    });
  } catch {
    /* keep the local copy — the desk can still play it this session */
  }

  const durationSec = probeSongDurationSec(localPath) || 0;
  const updated = await rememberTrackSong(jobId, job, stamped, durationSec);
  return NextResponse.json({ ok: true, job: updated, fileName: stamped, durationSec });
}

/** Stream the saved song back — no beat needed, the job knows its own name. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const jobId = (url.searchParams.get("jobId") || "").trim();
  if (!jobId) return NextResponse.json({ error: "Need jobId" }, { status: 400 });

  const job = await readMobileGenJob(jobId);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const fileName = (job.trackDraft?.songFile || "").trim();
  if (!fileName || !isSafeMediaName(fileName)) {
    return NextResponse.json({ error: "No song on this job" }, { status: 404 });
  }

  const destPath = path.join(storyDialogueDir(job.styleId as ShowStyleId), fileName);
  const resolved = await resolveMobileMedia({
    styleId: job.styleId,
    folderName: mobileMediaFolder(job),
    kind: "audio",
    fileName,
    destPath,
  });
  if (!resolved) return NextResponse.json({ error: "Song file missing" }, { status: 404 });

  return serveMediaFile(req, resolved, "audio/mpeg");
}
