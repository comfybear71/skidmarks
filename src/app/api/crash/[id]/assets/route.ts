import { NextResponse } from "next/server";
import {
  addCrashLayerAsset,
  addCrashPersonRef,
  addCrashVehicleRef,
  getCrashJob,
} from "@/lib/crash";
import type { CrashLayer } from "@/lib/crash";

export const runtime = "nodejs";
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const job = getCrashJob(id);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const form = await req.formData();
  const file = form.get("file");
  const kind = String(form.get("kind") || "vehicle") as
    | "vehicle"
    | CrashLayer["kind"];
  const label = String(form.get("label") || "");

  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "Need a file" }, { status: 400 });
  }
  const buf = Buffer.from(await file.arrayBuffer());
  const name = (file as File).name || "upload.png";
  const ext = name.includes(".") ? `.${name.split(".").pop()}` : ".png";

  if (kind === "vehicle") {
    const r = addCrashVehicleRef(id, {
      buffer: buf,
      ext,
      label: label || "Vehicle",
    });
    if (!r) return NextResponse.json({ error: "Save failed" }, { status: 500 });
    return NextResponse.json({ job: r.job, ref: r.ref });
  }

  if (kind === "person") {
    const r = addCrashPersonRef(id, {
      buffer: buf,
      ext,
      label: label || "Person",
    });
    if (!r) return NextResponse.json({ error: "Save failed" }, { status: 500 });
    return NextResponse.json({ job: r.job, ref: r.ref });
  }

  const r = addCrashLayerAsset(id, {
    buffer: buf,
    ext,
    kind,
    label: label || kind,
  });
  if (!r) return NextResponse.json({ error: "Save failed" }, { status: 500 });
  return NextResponse.json({ job: r.job, layer: r.layer });
}
