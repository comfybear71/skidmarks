import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { CRASH_DIR } from "@/lib/paths";
import { attachCrashStillToEpisode } from "@/lib/store";

export const runtime = "nodejs";

/**
 * POST { fileName, episodeId }
 * Park a Crash Lab generated still on the episode shelf.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      fileName?: string;
      episodeId?: string;
    };
    if (!body.fileName || !/^[\w.\-]+$/.test(body.fileName) || !body.episodeId) {
      return NextResponse.json(
        { error: "Need fileName and episodeId" },
        { status: 400 },
      );
    }
    const src = path.join(CRASH_DIR, "gen", body.fileName);
    if (!fs.existsSync(src)) {
      return NextResponse.json({ error: "Image missing" }, { status: 404 });
    }
    const buffer = fs.readFileSync(src);
    const ext = path.extname(body.fileName) || ".png";
    const result = attachCrashStillToEpisode({
      episodeId: body.episodeId,
      buffer,
      ext,
      label: body.fileName,
    });
    if (!result) {
      return NextResponse.json({ error: "Episode not found" }, { status: 404 });
    }
    return NextResponse.json({
      ok: true,
      entry: result.entry,
      episode: result.episode,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
