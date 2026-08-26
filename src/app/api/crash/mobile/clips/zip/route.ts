import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { readMobileGenJob } from "@/lib/mobileGenJob";
import { resolveMobileMedia, resolveMobileMediaByFilename } from "@/lib/mobileMediaStore";
import { mobileMediaFolder } from "@/lib/mobileJobFolder";
import { CRASH_DIR } from "@/lib/paths";
import { clipsZipFileName, orderedJobClips } from "@/lib/orderedJobClips";
import { buildStoreZip } from "@/lib/zipStore";
import { buildDirectionPdf, directionLinesFromStory } from "@/lib/episodeDirectionPdf";
import { readMobileStory } from "@/lib/mobileStoryStore";

export const runtime = "nodejs";
export const maxDuration = 120;

function localClipPath(fileName: string): string | null {
  const names = [
    path.join(CRASH_DIR, "gen", fileName),
    path.join(CRASH_DIR, "ltx", fileName),
  ];
  for (const p of names) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/**
 * GET ?jobId= — zip of rendered clips, named in film order.
 * Does not stitch. Does not write the job.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const jobId = (url.searchParams.get("jobId") || "").trim();
  if (!jobId) return NextResponse.json({ error: "Need jobId" }, { status: 400 });
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
  const clips = orderedJobClips(job, story);
  if (!clips.length) {
    return NextResponse.json({ error: "No rendered clips on this episode yet." }, { status: 404 });
  }
  const entries: { name: string; data: Buffer }[] = [];
  for (const clip of clips) {
    const dest = path.join(CRASH_DIR, "gen", clip.clipFile);
    const resolved =
      localClipPath(clip.clipFile) ||
      (await resolveMobileMedia({
        styleId: job.styleId,
        folderName: mobileMediaFolder(job),
        kind: "mp4",
        fileName: clip.clipFile,
        destPath: dest,
      })) ||
      (await resolveMobileMediaByFilename({
        kind: "mp4",
        fileName: clip.clipFile,
        destPath: dest,
      }));
    if (!resolved || !fs.existsSync(resolved)) continue;
    entries.push({ name: clip.zipName, data: fs.readFileSync(resolved) });
  }
  if (!entries.length) {
    return NextResponse.json({ error: "Clip files are missing." }, { status: 404 });
  }
  if (story?.scenes?.length) {
    try {
      entries.push({
        name: "direction.pdf",
        data: buildDirectionPdf(directionLinesFromStory(story)),
      });
    } catch {
      /* clips still zip if the sheet cannot be built */
    }
  }
  const zip = buildStoreZip(entries);
  const fileName = clipsZipFileName(job);
  return new NextResponse(new Uint8Array(zip), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
