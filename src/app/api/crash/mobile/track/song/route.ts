import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { patchMobileGenJob, readMobileGenJob } from "@/lib/mobileGenJob";
import { mobileMediaFolder } from "@/lib/mobileJobFolder";
import { resolveMobileMedia, uploadMobileMedia } from "@/lib/mobileMediaStore";
import { storyDialogueDir } from "@/lib/crashStoryLocations";
import { isSafeMediaName } from "@/lib/cloudMedia";
import { probeSongDurationSec } from "@/lib/scratchSongSlice";
import { serveMediaFile } from "@/lib/serveMediaFile";
import { slugToken } from "@/lib/crashStoryNames";
import { sortableId } from "@/lib/types";
import type { ShowStyleId } from "@/lib/showStylePresets";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_BYTES = 40 * 1024 * 1024;

/**
 * The song, saved the moment it is dropped.
 *
 * It used to be parked in the browser until the episode was locked, so a
 * refresh lost it and the desk came back empty. A song is the spine of a music
 * video — it goes to disk/Blob straight away and the job remembers its name,
 * with or without a story to hang it on.
 */
export async function POST(req: Request) {
  try {
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

    const stamped = `song_${slugToken(file.name.replace(/\.mp3$/i, ""), 32)}_${sortableId("s")}.mp3`;
    if (!isSafeMediaName(stamped)) {
      return NextResponse.json({ error: "Couldn't name that song file" }, { status: 400 });
    }

    const folderName = mobileMediaFolder(job);
    const dir = storyDialogueDir(job.styleId);
    fs.mkdirSync(dir, { recursive: true });
    const localPath = path.join(dir, stamped);
    fs.writeFileSync(localPath, Buffer.from(await file.arrayBuffer()));

    // Best effort: on Vercel the local write is scratch, Blob is the real home.
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
    const updated = await patchMobileGenJob(jobId, {
      trackDraft: {
        ...(job.trackDraft || {}),
        songFile: stamped,
        songDurationSec: durationSec,
        // A different song invalidates the old wave.
        waveformPeaks: undefined,
      },
      error: "",
    });

    return NextResponse.json({ ok: true, job: updated, fileName: stamped, durationSec });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
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
