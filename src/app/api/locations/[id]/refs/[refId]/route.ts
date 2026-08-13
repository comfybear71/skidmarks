import { NextResponse } from "next/server";
import fs from "fs";
import {
  getLocation,
  locationRefPath,
  removeLocationRef,
} from "@/lib/locations";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string; refId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id, refId } = await ctx.params;
  const l = getLocation(id);
  if (!l) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const house = l.references.find((r) => r.id === refId);
  const roomHit = l.rooms
    .map((r) => ({ room: r, ref: r.references.find((x) => x.id === refId) }))
    .find((x) => x.ref);
  const ref = house || roomHit?.ref;
  if (!ref)
    return NextResponse.json({ error: "No reference" }, { status: 404 });
  const filePath = locationRefPath(id, ref.fileName, roomHit?.room.id);
  if (!filePath)
    return NextResponse.json({ error: "Missing file" }, { status: 404 });
  const ext = ref.fileName.slice(ref.fileName.lastIndexOf(".")).toLowerCase();
  const mime =
    ext === ".jpg" || ext === ".jpeg"
      ? "image/jpeg"
      : ext === ".webp"
        ? "image/webp"
        : "image/png";
  return new NextResponse(fs.readFileSync(filePath), {
    headers: { "Content-Type": mime, "Cache-Control": "private, max-age=60" },
  });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id, refId } = await ctx.params;
  const location = removeLocationRef(id, refId);
  if (!location)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ location });
}
