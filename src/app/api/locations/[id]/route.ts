import { NextResponse } from "next/server";
import {
  deleteLocation,
  getLocation,
  saveLocation,
} from "@/lib/locations";
import type { Location } from "@/lib/types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const location = getLocation(id);
  if (!location)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ location });
}

export async function PUT(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const existing = getLocation(id);
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = (await req.json()) as Partial<Location>;
  const location = saveLocation({
    ...existing,
    ...body,
    id,
    rooms: body.rooms ?? existing.rooms,
    plateAttempts: body.plateAttempts ?? existing.plateAttempts,
    references: body.references ?? existing.references,
  });
  return NextResponse.json({ location });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  deleteLocation(id);
  return NextResponse.json({ ok: true });
}
