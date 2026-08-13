import { NextResponse } from "next/server";
import { listEpisodes, saveEpisode } from "@/lib/store";
import { emptyEpisode } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ episodes: listEpisodes() });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    title?: string;
    slug?: string;
    logline?: string;
    victimCharacterId?: string;
    torment?: string;
    characterNote?: string;
  };
  const ep = emptyEpisode({
    title: body.title?.trim() || "New episode",
    slug:
      body.slug?.trim() ||
      `episode-${Date.now().toString(36)}`,
    logline: body.logline?.trim() || "",
    victimCharacterId: body.victimCharacterId?.trim() || "",
    torment: body.torment?.trim() || "",
    characterNote: body.characterNote?.trim() || "",
  });
  return NextResponse.json({ episode: saveEpisode(ep) });
}
