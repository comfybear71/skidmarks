import { NextResponse } from "next/server";
import {
  assistSystem,
  assistUser,
  cleanAssistText,
  isAssistKind,
} from "@/lib/mobileAssist";
import { parseStyleCardId } from "@/lib/styleCardThumbs";
import { askGrok, missingXaiMessage, textKeyPresent } from "@/lib/textGen";

export const runtime = "nodejs";
export const maxDuration = 180;

/** POST { kind, text, styleId, hint? } — draft the box. Press again for another take. */
export async function POST(req: Request) {
  try {
    if (!textKeyPresent()) {
      return NextResponse.json(
        { error: missingXaiMessage() },
        { status: 503 },
      );
    }

    const body = (await req.json().catch(() => ({}))) as {
      kind?: string;
      text?: string;
      styleId?: string;
      hint?: string;
    };
    const kind = (body.kind || "").trim();
    if (!isAssistKind(kind)) {
      return NextResponse.json({ error: "Need a prompt kind" }, { status: 400 });
    }
    const styleId = parseStyleCardId(body.styleId || null);
    if (!styleId) {
      return NextResponse.json({ error: "Need a valid styleId" }, { status: 400 });
    }

    const text = await askGrok({
      system: assistSystem(styleId, kind),
      user: assistUser({
        kind,
        text: body.text || "",
        hint: body.hint,
      }),
      maxTokens: kind === "episode" ? 4000 : kind === "vibe" ? 220 : kind === "shot" ? 400 : 180,
    });
    return NextResponse.json({ ok: true, text: cleanAssistText(text) });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
