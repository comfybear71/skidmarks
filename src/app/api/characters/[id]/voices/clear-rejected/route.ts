import { NextResponse } from "next/server";
import { clearRejectedVoices, getCharacter } from "@/lib/characters";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!getCharacter(id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  const character = clearRejectedVoices(id);
  return NextResponse.json({ character });
}
