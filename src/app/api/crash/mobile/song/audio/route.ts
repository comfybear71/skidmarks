import { NextResponse } from "next/server";
import { resolveMobileBeatAudio } from "@/lib/resolveMobileBeatAudio";
import { mobileCandidateFolders, mobileMediaFolder } from "@/lib/mobileJobFolder";
import { readMobileGenJob } from "@/lib/mobileGenJob";
import { readMobileStory } from "@/lib/mobileStoryStore";
import { findSongCarrierBeatId } from "@/lib/musicVideoSong";
import { serveMediaFile } from "@/lib/serveMediaFile";

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
  const fileName = (job.scratchSong?.fileName || "").trim();
  if (!fileName || !job.folderName) {
    return NextResponse.json({ error: "No song on this job" }, { status: 404 });
  }

  const story = await readMobileStory(job.styleId, job.folderName);
  const beatId =
    (job.scratchSong?.carrierBeatId || "").trim() ||
    findSongCarrierBeatId(story, fileName, job.shots[0]?.shotId);
  if (!beatId) {
    return NextResponse.json({ error: "Song beat not found on this episode" }, { status: 404 });
  }

  const filePath = await resolveMobileBeatAudio({
    styleId: job.styleId,
    folderName: job.folderName,
    folderCandidates: mobileCandidateFolders(job),
    beatId,
    voiceFile: fileName,
  });
  if (!filePath) {
    return NextResponse.json({ error: "Song file missing" }, { status: 404 });
  }

  return serveMediaFile(req, filePath, "audio/mpeg", { "Cache-Control": "private, max-age=300" });
}
