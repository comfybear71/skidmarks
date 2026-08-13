import { NextResponse } from "next/server";
import { exportEpisodePack } from "@/lib/exportPack";
import { getEpisode, saveEpisode } from "@/lib/store";
import type { Episode } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json()) as { episodeId?: string; episode?: Episode };
  let episode = body.episode;
  if (!episode && body.episodeId) {
    episode = getEpisode(body.episodeId) ?? undefined;
  }
  if (!episode) {
    return NextResponse.json({ error: "No episode" }, { status: 400 });
  }
  saveEpisode(episode);
  const result = exportEpisodePack(episode);
  return NextResponse.json(result);
}
