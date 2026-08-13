import { NextResponse } from "next/server";
import { addRoom, getLocation } from "@/lib/locations";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!getLocation(id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    notes?: string;
    lookNote?: string;
  };
  const result = addRoom(id, {
    name: body.name?.trim() || "New room",
    notes: body.notes?.trim() || "",
    lookNote: body.lookNote?.trim() || "",
  });
  if (!result)
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  return NextResponse.json(result);
}
