import { NextResponse } from "next/server";
import {
  listStyleCardStatus,
  looksLikeWorldPlacePrompt,
  parseStyleCardId,
  saveGenStillAsStyleCard,
} from "@/lib/styleCardThumbs";
import { mirrorFaceIntoCrashLabCharacters } from "@/lib/crashLabSharedAssets";
import { getShowStylePreset } from "@/lib/showStylePresets";
import { useCloudStore } from "@/lib/cloudEnv";
import { cloudStyleCardStatus } from "@/lib/cloudShelf";

export const runtime = "nodejs";

/** GET — which style cards already have a thumb PNG. */
export async function GET() {
  try {
    if (useCloudStore()) {
      return NextResponse.json({ cards: await cloudStyleCardStatus() });
    }
    return NextResponse.json({ cards: listStyleCardStatus() });
  } catch (e) {
    console.error("[style-cards GET]", e);
    return NextResponse.json({ cards: [] });
  }
}

/** POST { genFileName, styleId?, keepDraft? } — append still to style-cards/{id}/ gallery */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      genFileName?: string;
      styleId?: string;
      keepDraft?: boolean;
      prompt?: string;
    };
    const genFileName = String(body.genFileName || "").trim();
    const styleId = parseStyleCardId(body.styleId || null);
    if (!genFileName) {
      return NextResponse.json({ error: "Need genFileName" }, { status: 400 });
    }
    if (!styleId) {
      return NextResponse.json(
        { error: "Pick a show style in Script desk first" },
        { status: 400 },
      );
    }
    const prompt = String(body.prompt || "").trim();
    if (prompt && looksLikeWorldPlacePrompt(prompt)) {
      return NextResponse.json(
        {
          error:
            "That prompt is a place, not a face — use Add to World on the World step, not Add to cast.",
        },
        { status: 400 },
      );
    }
    const { thumbPath, thumbKey, label } = saveGenStillAsStyleCard({
      genFileName,
      styleId,
      prompt: prompt || undefined,
    });
    // Ensemble shows — specials also land in _CRASH_LAB\images\characters\
    if (
      getShowStylePreset(styleId).characterMode === "ensemble" &&
      label?.name?.trim()
    ) {
      mirrorFaceIntoCrashLabCharacters({
        styleId,
        thumbKey,
        name: label.name.trim(),
      });
    }
    return NextResponse.json({
      ok: true,
      styleId,
      thumbPath,
      thumbKey,
      label,
      url: `/api/crash/style-cards/file?styleId=${encodeURIComponent(styleId)}&thumb=${encodeURIComponent(thumbKey)}&t=${Date.now()}`,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
