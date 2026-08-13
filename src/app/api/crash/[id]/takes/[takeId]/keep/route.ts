import { NextResponse } from "next/server";
import { getCrashJob, setCrashTakeStatus } from "@/lib/crash";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string; takeId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { id, takeId } = await ctx.params;
  if (!getCrashJob(id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as {
    status?: "approved" | "rejected" | "pending";
  };
  const status = body.status || "approved";
  const job = setCrashTakeStatus(id, takeId, status);
  if (!job) return NextResponse.json({ error: "Take not found" }, { status: 404 });
  return NextResponse.json({ job });
}
