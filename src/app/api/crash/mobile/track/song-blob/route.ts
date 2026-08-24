import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { blobPathname } from "@/lib/blobStore";
import { isSafeMediaName } from "@/lib/cloudMedia";
import { useCloudStore } from "@/lib/cloudEnv";
import { mobileMediaFolder } from "@/lib/mobileJobFolder";
import { readMobileGenJob } from "@/lib/mobileGenJob";

export const runtime = "nodejs";

/**
 * Client token for a track song drop that is too big for the Studio POST.
 * Phone uploads straight to Blob. No beat needed — this is the job's song.
 */
export async function POST(req: Request) {
  if (!useCloudStore()) {
    return NextResponse.json({ error: "Cloud song drop is off here" }, { status: 409 });
  }
  const body = (await req.json().catch(() => ({}))) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const parsed = JSON.parse(clientPayload || "{}") as {
          jobId?: string;
          fileName?: string;
        };
        const jobId = String(parsed.jobId || "").trim();
        const fileName = String(parsed.fileName || "").trim();
        if (!jobId || !fileName || !isSafeMediaName(fileName)) {
          throw new Error("Bad song drop token");
        }
        const job = await readMobileGenJob(jobId);
        if (!job) throw new Error("Job not found");
        const want = blobPathname(job.styleId, mobileMediaFolder(job), "audio", fileName);
        if (pathname !== want) throw new Error("Song path does not match this job");
        return {
          allowedContentTypes: ["audio/mpeg", "audio/mp3", "audio/mpeg3"],
          maximumSizeInBytes: 40 * 1024 * 1024,
          addRandomSuffix: false,
          allowOverwrite: true,
        };
      },
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 400 },
    );
  }
}
