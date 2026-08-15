import fs from "fs";
import { NextResponse } from "next/server";
import { readMobileGenJob } from "@/lib/mobileGenJob";
import { mobileFinalVideoPath } from "@/lib/mobileStitch";

export const runtime = "nodejs";

/** GET ?jobId= — stream the finished stitched video. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const jobId = url.searchParams.get("jobId") || "";
  const job = await readMobileGenJob(jobId);
  if (!job?.finalVideoFile) {
    return NextResponse.json({ error: "No finished video for this job" }, { status: 404 });
  }
  const filePath = mobileFinalVideoPath(job.finalVideoFile);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "Video file missing on disk" }, { status: 404 });
  }
  return new NextResponse(fs.readFileSync(filePath), {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Disposition": `inline; filename="${job.finalVideoFile}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
