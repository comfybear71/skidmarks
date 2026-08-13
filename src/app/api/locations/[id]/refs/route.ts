import { NextResponse } from "next/server";
import path from "path";
import { addLocationRef, getLocation } from "@/lib/locations";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!getLocation(id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  const form = await req.formData();
  const file = form.get("file");
  if (!file || typeof file !== "object" || !("arrayBuffer" in file)) {
    return NextResponse.json({ error: "Reference required" }, { status: 400 });
  }
  const f = file as File;
  const buffer = Buffer.from(await f.arrayBuffer());
  const ext = path.extname(f.name || "") || ".png";
  const roomId = String(form.get("roomId") || "") || undefined;
  const result = addLocationRef(id, {
    buffer,
    ext,
    label: String(form.get("label") || f.name),
    roomId,
  });
  if (!result)
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  return NextResponse.json(result);
}
