import { NextResponse } from "next/server";
import {
  addCrashVehicleRef,
  clearCrashVehicles,
  getCrashJob,
} from "@/lib/crash";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!getCrashJob(id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const form = await req.formData();
  const file = form.get("file");
  const label = String(form.get("label") || "Vehicle");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Need a file" }, { status: 400 });
  }
  const buf = Buffer.from(await file.arrayBuffer());
  const name = file.name || "vehicle.png";
  const ext = name.includes(".") ? `.${name.split(".").pop()}` : ".png";
  const result = addCrashVehicleRef(id, { buffer: buf, ext, label });
  if (!result)
    return NextResponse.json({ error: "Save failed" }, { status: 500 });
  return NextResponse.json({ job: result.job, ref: result.ref });
}

/** Wipe vehicle refs so you can upload your own. */
export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!getCrashJob(id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  const job = clearCrashVehicles(id);
  return NextResponse.json({ job });
}
