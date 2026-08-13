import { NextResponse } from "next/server";
import fs from "fs";
import {
  deleteLocationPlate,
  getLocation,
  locationPlatePath,
  setLocationPlateStatus,
} from "@/lib/locations";

export const runtime = "nodejs";

type Ctx = {
  params: Promise<{ id: string; roomId: string; attemptId: string }>;
};

export async function GET(_req: Request, ctx: Ctx) {
  const { id, roomId, attemptId } = await ctx.params;
  const l = getLocation(id);
  if (!l) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const room = l.rooms.find((r) => r.id === roomId);
  const attempt = room?.plateAttempts.find((a) => a.id === attemptId);
  if (!attempt?.fileName)
    return NextResponse.json({ error: "No image" }, { status: 404 });
  const filePath = locationPlatePath(id, attempt.fileName, roomId);
  if (!filePath)
    return NextResponse.json({ error: "Missing file" }, { status: 404 });
  return new NextResponse(fs.readFileSync(filePath), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, max-age=60",
    },
  });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { id, roomId, attemptId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    status?: "pending" | "approved" | "rejected" | "parked";
    reason?: string;
  };
  if (!body.status)
    return NextResponse.json({ error: "status required" }, { status: 400 });
  const location = setLocationPlateStatus(
    id,
    roomId,
    attemptId,
    body.status,
    body.reason || "",
  );
  if (!location)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ location });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id, roomId, attemptId } = await ctx.params;
  try {
    const location = deleteLocationPlate(id, roomId, attemptId);
    if (!location)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ location });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 400 },
    );
  }
}
