import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { morphRunDir } from "@/lib/morph";
import { attachCrashMorphToEpisode } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST { runId, episodeId }
 * Park morph.mp4 on episode Crash Lab shelf (assign to beat later in Scene kit).
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      runId?: string;
      episodeId?: string;
    };
    if (!body.runId || !/^morph_[\w]+$/.test(body.runId) || !body.episodeId) {
      return NextResponse.json(
        { error: "Need runId and episodeId" },
        { status: 400 },
      );
    }

    const src = path.join(morphRunDir(body.runId), "morph.mp4");
    if (!fs.existsSync(src)) {
      return NextResponse.json({ error: "Morph mp4 missing" }, { status: 404 });
    }

    const buffer = fs.readFileSync(src);
    const result = attachCrashMorphToEpisode({
      episodeId: body.episodeId,
      runId: body.runId,
      buffer,
    });
    if (!result) {
      return NextResponse.json({ error: "Episode not found" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      entry: result.entry,
      episode: result.episode,
      url: `/api/episodes/${body.episodeId}/plates/${encodeURIComponent(result.entry.fileName)}`,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
