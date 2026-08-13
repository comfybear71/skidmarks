import { NextResponse } from "next/server";
import { addCrashSpxGeneratedSound } from "@/lib/crashSpx";
import { generateSoundEffect, elevenKeyPresent } from "@/lib/elevenLabs";
import { parseStyleCardId } from "@/lib/styleCardThumbs";

export const runtime = "nodejs";
export const maxDuration = 60;

/** POST { styleId, prompt, label?, durationSeconds? } — ElevenLabs SFX → project shelf. */
export async function POST(req: Request) {
  try {
    if (!elevenKeyPresent()) {
      return NextResponse.json(
        {
          error:
            "Missing ELEVENLABS_API_KEY in MY MOVIES\\.env — restart Studio after adding.",
        },
        { status: 503 },
      );
    }

    const body = (await req.json().catch(() => ({}))) as {
      styleId?: string;
      prompt?: string;
      label?: string;
      durationSeconds?: number;
    };
    const styleId = parseStyleCardId(body.styleId || null);
    const prompt = String(body.prompt || "").trim();
    if (!styleId || !prompt) {
      return NextResponse.json(
        { error: "Need styleId and prompt" },
        { status: 400 },
      );
    }

    const buf = await generateSoundEffect({
      text: prompt,
      durationSeconds: body.durationSeconds,
    });

    const label =
      String(body.label || "").trim() ||
      prompt.split(/[.,—–-]/)[0]?.trim().slice(0, 48) ||
      "SFX";

    const item = addCrashSpxGeneratedSound({
      styleId,
      buffer: buf,
      label,
      prompt,
    });

    return NextResponse.json({
      ok: true,
      item,
      url: `/api/crash/spx/file?styleId=${encodeURIComponent(styleId)}&kind=sfx&file=${encodeURIComponent(item.fileName)}&t=${item.mtime}`,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
