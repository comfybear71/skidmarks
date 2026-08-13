import { NextResponse } from "next/server";
import { deleteRoom, getLocation, updateRoom } from "@/lib/locations";
import type { Room } from "@/lib/types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string; roomId: string }> };

export async function PUT(req: Request, ctx: Ctx) {
  const { id, roomId } = await ctx.params;
  if (!getLocation(id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = (await req.json()) as Partial<Room>;
  const location = updateRoom(id, roomId, {
    name: body.name,
    notes: body.notes,
    lookNote: body.lookNote,
  });
  if (!location)
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  return NextResponse.json({ location });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id, roomId } = await ctx.params;
  try {
    const location = deleteRoom(id, roomId);
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
