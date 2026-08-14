import { NextResponse } from "next/server";
import { elevenKeyPresent } from "@/lib/elevenLabs";
import { generateEpisodeVoices } from "@/lib/scriptVoiceGen";
import { parseStyleCardId } from "@/lib/styleCardThumbs";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * POST { styleId, folderName }
 * Batch-cast voices + generate dialogue-beat mp3s for an already
 * script-imported episode pack. Follow-up to /api/crash/script/import.
 */
export async function POST(req: Request) {
  try {
    if (!elevenKeyPresent()) {
      return NextResponse.json(
        {
          error:
            "Missing ELEVENLABS_API_KEY in MY MOVIES\\.env (same place as the xAI key), then restart Studio (npm run dev).",
        },
        { status: 503 },
      );
    }

    const body = (await req.json().catch(() => ({}))) as {
      styleId?: string;
      folderName?: string;
    };
    const styleId = parseStyleCardId(body.styleId || null);
    if (!styleId) {
      return NextResponse.json({ error: "Need a valid styleId" }, { status: 400 });
    }
    const folderName = (body.folderName || "").trim();
    if (!folderName) {
      return NextResponse.json({ error: "Need folderName" }, { status: 400 });
    }

    const result = await generateEpisodeVoices(styleId, folderName);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
