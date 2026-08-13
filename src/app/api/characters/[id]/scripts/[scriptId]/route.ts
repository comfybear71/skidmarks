import { NextResponse } from "next/server";
import { deleteScript, getCharacter } from "@/lib/characters";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string; scriptId: string }> };

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id, scriptId } = await ctx.params;
  if (!getCharacter(id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  const character = deleteScript(id, scriptId);
  if (!character) return NextResponse.json({ error: "Failed" }, { status: 500 });
  return NextResponse.json({ character });
}
