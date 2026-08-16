import { NextResponse } from "next/server";
import { patchMobileGenJob, readMobileGenJob } from "@/lib/mobileGenJob";
import { bounceStuckStitch } from "@/lib/mobilePipeline";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** GET — poll a mobile run's current state. */
export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  let job = await readMobileGenJob(id);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  const unstick = bounceStuckStitch({ phase: job.phase, error: job.error });
  if (unstick) {
    job = (await patchMobileGenJob(id, { phase: unstick, error: "" })) || job;
  }
  return NextResponse.json({ ok: true, job });
}
