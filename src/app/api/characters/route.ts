import { NextResponse } from "next/server";
import { createCharacter, listCharacters } from "@/lib/characters";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json({ characters: listCharacters() });
  } catch (e) {
    console.error("[characters GET]", e);
    return NextResponse.json({ characters: [] });
  }
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    pastNote?: string;
    tormentScratch?: string;
  };
  const character = createCharacter({
    name: body.name?.trim() || "New arsehole",
    pastNote: body.pastNote?.trim() || "",
    tormentScratch: body.tormentScratch?.trim() || "",
  });
  return NextResponse.json({ character });
}
