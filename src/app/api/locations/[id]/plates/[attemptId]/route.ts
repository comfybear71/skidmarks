import { NextResponse } from "next/server";
import fs from "fs";
import {
  deleteLocationPlate,
  getLocation,
  locationPlatePath,
  setLocationPlateStatus,
} from "@/lib/locations";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string; attemptId: string }> };

function findRoomForAttempt(locationId: string, attemptId: string) {
  const l = getLocation(locationId);
  if (!l) return null;
  for (const room of l.rooms) {
    if (room.plateAttempts.some((a) => a.id === attemptId)) {
      return { location: l, room };
    }
  }
  return null;
}

export async function GET(_req: Request, ctx: Ctx) {
  const { id, attemptId } = await ctx.params;
  const found = findRoomForAttempt(id, attemptId);
  if (!found)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  const attempt = found.room.plateAttempts.find((a) => a.id === attemptId);
  if (!attempt?.fileName)
    return NextResponse.json({ error: "No image" }, { status: 404 });
  const filePath = locationPlatePath(id, attempt.fileName, found.room.id);
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
  const { id, attemptId } = await ctx.params;
  const found = findRoomForAttempt(id, attemptId);
  if (!found)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as {
    status?: "pending" | "approved" | "rejected";
    reason?: string;
  };
  if (!body.status)
    return NextResponse.json({ error: "status required" }, { status: 400 });
  const location = setLocationPlateStatus(
    id,
    found.room.id,
    attemptId,
    body.status,
    body.reason || "",
  );
  return NextResponse.json({ location });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id, attemptId } = await ctx.params;
  const found = findRoomForAttempt(id, attemptId);
  if (!found)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  const location = deleteLocationPlate(id, found.room.id, attemptId);
  return NextResponse.json({ location });
}
