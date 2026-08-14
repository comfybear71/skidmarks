import { NextResponse } from "next/server";
import { readMobileGenJob } from "@/lib/mobileGenJob";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** GET — poll a mobile run's current state. */
export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const job = readMobileGenJob(id);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  return NextResponse.json({ ok: true, job });
}
