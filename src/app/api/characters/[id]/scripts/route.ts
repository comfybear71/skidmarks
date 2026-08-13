import { NextResponse } from "next/server";
import { addScript, getCharacter } from "@/lib/characters";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!getCharacter(id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    title?: string;
    body?: string;
  };
  if (!body.body || !body.body.trim()) {
    return NextResponse.json({ error: "Script text required" }, { status: 400 });
  }
  const result = addScript(id, { title: body.title, body: body.body });
  if (!result) return NextResponse.json({ error: "Failed" }, { status: 500 });
  return NextResponse.json(result);
}
