import { NextResponse } from "next/server";
import { importScriptEpisodes } from "@/lib/scriptImport";
import { parseStyleCardId } from "@/lib/styleCardThumbs";
import type { ScriptEpisodeData } from "@/lib/types";

export const runtime = "nodejs";

/**
 * POST { styleId, episodes: ScriptEpisodeData[] }
 * Creates one real Crash Lab episode pack per parsed episode (same
 * pipeline as CURSOR/PROMPT) — the follow-up to /api/crash/script/upload,
 * which only parses and never persisted anything.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      styleId?: string;
      episodes?: ScriptEpisodeData[];
    };
    const styleId = parseStyleCardId(body.styleId || null);
    if (!styleId) {
      return NextResponse.json({ error: "Need a valid styleId" }, { status: 400 });
    }
    if (!Array.isArray(body.episodes) || !body.episodes.length) {
      return NextResponse.json({ error: "Need at least one parsed episode" }, { status: 400 });
    }

    const imported = await importScriptEpisodes(styleId, body.episodes);
    return NextResponse.json({ ok: true, imported });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
