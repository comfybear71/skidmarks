import path from "path";
import { NextResponse } from "next/server";
import { resolveMobileBeatAudio } from "@/lib/resolveMobileBeatAudio";
import { resolveMobileMedia, resolveMobileMediaByFilename } from "@/lib/mobileMediaStore";
import { mobileCandidateFolders, mobileMediaFolder } from "@/lib/mobileJobFolder";
import { readMobileGenJob } from "@/lib/mobileGenJob";
import { readMobileStory } from "@/lib/mobileStoryStore";
import { findSongCarrierBeatId, isMusicVideoSongJob } from "@/lib/musicVideoSong";
import { storyDialogueDir } from "@/lib/crashStoryLocations";
import { isSafeMediaName } from "@/lib/cloudMedia";
import { serveMediaFile } from "@/lib/serveMediaFile";
import type { ShowStyleId } from "@/lib/showStylePresets";

export const runtime = "nodejs";

/**
 * Stream the episode's attached song mp3 by job id alone.
 * Cold refresh used to need deskStory loaded before beat-audio had a beatId;
 * this route resolves the carrier beat server-side.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const jobId = (url.searchParams.get("jobId") || "").trim();
  if (!jobId) return NextResponse.json({ error: "Need jobId" }, { status: 400 });

  const job = await readMobileGenJob(jobId);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  const fileName = (
    job.scratchSong?.fileName ||
    job.trackDraft?.songFile ||
    ""
  ).trim();
  if (!fileName || !job.folderName) {
    return NextResponse.json({ error: "No song on this job" }, { status: 404 });
  }

  const explicitBeat = (job.scratchSong?.carrierBeatId || "").trim();
  let beatId = explicitBeat;
  if (!beatId && isMusicVideoSongJob(job)) {
    const story = await readMobileStory(job.styleId, job.folderName);
    beatId = findSongCarrierBeatId(story, fileName, job.shots[0]?.shotId);
  }
  const fromBeat = beatId
    ? await resolveMobileBeatAudio({
        styleId: job.styleId,
        folderName: job.folderName,
        folderCandidates: mobileCandidateFolders(job),
        beatId,
        voiceFile: fileName,
      })
    : null;
  if (fromBeat) {
    return serveMediaFile(req, fromBeat, "audio/mpeg", { "Cache-Control": "private, max-age=300" });
  }

  // Spoken episode with a dropped song — no carrier beat. Same lookup as
  // /api/crash/mobile/track/song.
  if (!isSafeMediaName(fileName)) {
    return NextResponse.json({ error: "Song file missing" }, { status: 404 });
  }
  const destPath = path.join(storyDialogueDir(job.styleId as ShowStyleId), fileName);
  const fromFolder = await resolveMobileMedia({
    styleId: job.styleId,
    folderName: mobileMediaFolder(job),
    kind: "audio",
    fileName,
    destPath,
  });
  const resolved =
    fromFolder ||
    (await resolveMobileMediaByFilename({
      kind: "audio",
      fileName,
      destPath,
    }));
  if (!resolved) return NextResponse.json({ error: "Song file missing" }, { status: 404 });

  return serveMediaFile(req, resolved, "audio/mpeg", { "Cache-Control": "private, max-age=300" });
}
