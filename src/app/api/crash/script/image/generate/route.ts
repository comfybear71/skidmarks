import { NextResponse } from "next/server";
import { imageKeyPresent } from "@/lib/imageGen";
import { generateEpisodeImages } from "@/lib/scriptImageGen";
import { parseStyleCardId } from "@/lib/styleCardThumbs";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * POST { styleId, folderName }
 * Batch-generate character faces + location world cards for an already
 * script-imported episode pack. Follow-up to /api/crash/script/import.
 */
export async function POST(req: Request) {
  try {
    if (!imageKeyPresent()) {
      return NextResponse.json(
        {
          error:
            "Missing XAI_API_KEY. Add your xAI / Grok key to your environment variables (same place as ElevenLabs), then restart Studio (npm run dev).",
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

    const result = await generateEpisodeImages(styleId, folderName);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
