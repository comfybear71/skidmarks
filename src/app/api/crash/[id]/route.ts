import { NextResponse } from "next/server";
import {
  getCrashJob,
  saveCrashJob,
  setCrashPreset,
  type CrashPreset,
} from "@/lib/crash";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const job = getCrashJob(id);
    if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ job });
  } catch (e) {
    console.error("[crash id GET]", e);
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  let job = getCrashJob(id);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as {
    title?: string;
    characterId?: string;
    preset?: CrashPreset;
    approvedVehicleId?: string;
  };
  if (body.title !== undefined) job.title = body.title.trim() || job.title;
  if (body.characterId !== undefined) job.characterId = body.characterId;
  if (body.approvedVehicleId !== undefined)
    job.approvedVehicleId = body.approvedVehicleId;
  if (body.preset) {
    const patched = setCrashPreset(id, body.preset);
    if (patched) job = patched;
  } else {
    job = saveCrashJob(job);
  }
  return NextResponse.json({ job });
}
