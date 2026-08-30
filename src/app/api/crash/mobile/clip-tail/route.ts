import { NextResponse } from "next/server";
import { landStillClipTailPlate } from "@/lib/clipTailFrame";
import { clipTailPlateLabel, previousDoneClipOnStill } from "@/lib/clipTailStart";
import { MOBILE_JOB_READ_MISS, readMobileGenJob } from "@/lib/mobileGenJob";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Pull the last frame of clip 1 (or a named clip) so clip 2 can start there.
 * Does not cook. Does not overwrite the card still.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      jobId?: string;
      shotId?: string;
      clipFile?: string;
    };
    const jobId = String(body.jobId || "").trim();
    const shotId = String(body.shotId || "").trim();
    if (!jobId || !shotId) {
      return NextResponse.json({ error: "Need jobId and shotId" }, { status: 400 });
    }
    const job = await readMobileGenJob(jobId);
    if (!job) return NextResponse.json({ error: MOBILE_JOB_READ_MISS }, { status: 404 });
    const landed = await landStillClipTailPlate({
      job,
      shotId,
      clipFile: String(body.clipFile || "").trim() || undefined,
    });
    if (!landed) {
      return NextResponse.json(
        { error: "Need a finished clip on this still first." },
        { status: 400 },
      );
    }
    const prior = previousDoneClipOnStill(job.clips, shotId);
    return NextResponse.json({
      ok: true,
      fileName: landed.fileName,
      clipFile: landed.clipFile,
      label: clipTailPlateLabel(1),
      chainedFrom: prior?.shotId || shotId,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
