import { NextResponse } from "next/server";
import { parseStyleCardId } from "@/lib/styleCardThumbs";
import {
  cursorFillAnimateDraft,
  cursorGenPlates,
  cursorGenSfx,
  cursorLockVoice,
  cursorSpeakAll,
  cursorWriteStory,
  libraryVoiceNameFor,
  voiceDescFor,
} from "@/lib/cursorStepBuild";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * POST { styleId, action, ... }
 * actions: lockVoice | writeStory | genPlates | speakAll | fillAnimate | genSfx
 * Never sends LTX / Comfy.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      styleId?: string;
      action?: string;
      castKey?: string;
      castName?: string;
      voiceDescription?: string;
      libraryVoiceName?: string;
      folderName?: string;
      worldKeys?: string[];
    };
    const styleId = parseStyleCardId(body.styleId || "skidmarks");
    if (!styleId) {
      return NextResponse.json({ error: "Need styleId" }, { status: 400 });
    }
    const action = String(body.action || "").trim();

    if (action === "lockVoice") {
      const castKey = String(body.castKey || "").trim();
      const castName = String(body.castName || "").trim();
      if (!castKey || !castName) {
        return NextResponse.json(
          { error: "Need castKey + castName" },
          { status: 400 },
        );
      }
      const result = await cursorLockVoice({
        styleId,
        castKey,
        castName,
        voiceDescription:
          String(body.voiceDescription || "").trim() || voiceDescFor(castName),
        libraryVoiceName:
          String(body.libraryVoiceName || "").trim() ||
          libraryVoiceNameFor(castName),
      });
      return NextResponse.json({ ok: true, ...result });
    }

    if (action === "writeStory") {
      const folderName = String(body.folderName || "").trim();
      const worldKeys = Array.isArray(body.worldKeys)
        ? body.worldKeys.map((k) => String(k || "").trim())
        : [];
      if (!folderName) {
        return NextResponse.json({ error: "Need folderName" }, { status: 400 });
      }
      const story = cursorWriteStory({ styleId, folderName, worldKeys });
      return NextResponse.json({ ok: true, story });
    }

    if (action === "genPlates") {
      const result = await cursorGenPlates({ styleId });
      return NextResponse.json({ ok: true, ...result });
    }

    if (action === "speakAll") {
      const result = await cursorSpeakAll({ styleId });
      return NextResponse.json({
        ok: true,
        ...result,
      });
    }

    if (action === "fillAnimate") {
      const draft = cursorFillAnimateDraft({ styleId });
      return NextResponse.json({
        ok: true,
        draft,
        beatCount: Object.keys(draft.beats).length,
      });
    }

    if (action === "genSfx") {
      const result = await cursorGenSfx({ styleId });
      return NextResponse.json({ ok: true, ...result });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
