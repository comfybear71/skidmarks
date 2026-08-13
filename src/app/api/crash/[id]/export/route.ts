import { NextResponse } from "next/server";
import { addCrashTake, getCrashJob } from "@/lib/crash";

export const runtime = "nodejs";
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

/** Flattened canvas PNG from the browser → new take. */
export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const job = getCrashJob(id);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "Need a PNG file" }, { status: 400 });
  }
  const buf = Buffer.from(await file.arrayBuffer());
  const saved = addCrashTake(id, {
    buffer: buf,
    ext: ".png",
    preset: "composite",
    note: "Composite from Crash Lab board",
  });
  if (!saved) {
    return NextResponse.json({ error: "Save failed" }, { status: 500 });
  }
  return NextResponse.json({ job: saved.job, take: saved.take });
}
