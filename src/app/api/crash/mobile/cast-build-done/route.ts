import { NextResponse } from "next/server";
import { patchMobileGenJob, readMobileGenJob } from "@/lib/mobileGenJob";

export const runtime = "nodejs";

/**
 * POST { jobId } — cast_build -> location_build. A plain phase flip, but
 * still server-side so a job can't be pushed on to the next build step with
 * zero cast (mirrored by /screenplay's own guard for zero locations).
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { jobId?: string };
    const jobId = (body.jobId || "").trim();
    if (!jobId) return NextResponse.json({ error: "Need jobId" }, { status: 400 });

    const job = await readMobileGenJob(jobId);
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    if (job.phase !== "cast_build") {
      return NextResponse.json({ ok: true, job }); // already past this phase — idempotent
    }
    if (!job.speakers.length) {
      return NextResponse.json({ error: "Add at least one character first" }, { status: 400 });
    }

    const updated = await patchMobileGenJob(jobId, { phase: "location_build" });
    return NextResponse.json({ ok: true, job: updated });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
