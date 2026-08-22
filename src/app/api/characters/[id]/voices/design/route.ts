import { NextResponse } from "next/server";
import { addVoiceAttempts, getCharacter, saveCharacter } from "@/lib/characters";
import { designVoicePreviews, elevenKeyPresent } from "@/lib/elevenLabs";

export const runtime = "nodejs";
export const maxDuration = 120;

type Ctx = { params: Promise<{ id: string }> };

export async function GET() {
  return NextResponse.json({ elevenReady: elevenKeyPresent() });
}

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const c = getCharacter(id);
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!elevenKeyPresent()) {
    return NextResponse.json(
      {
        error:
          "Missing ELEVENLABS_API_KEY in your environment variables — restart Studio after adding.",
      },
      { status: 503 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    voiceDescription?: string;
    previewText?: string;
  };

  const voiceDescription = (
    body.voiceDescription ||
    c.voiceDescription ||
    ""
  ).trim();
  if (!voiceDescription) {
    return NextResponse.json(
      { error: "Write a voice description first" },
      { status: 400 },
    );
  }

  // Persist casting note on character
  if (voiceDescription !== c.voiceDescription) {
    saveCharacter({ ...c, voiceDescription });
  }

  const fresh = getCharacter(id)!;
  const rejectHints = fresh.voiceAttempts
    .filter((a) => a.status === "rejected" && a.reason)
    .slice(0, 8)
    .map((a) => a.reason);

  try {
    const previews = await designVoicePreviews({
      voiceDescription,
      previewText: body.previewText,
      rejectHints,
    });
    const character = addVoiceAttempts(
      id,
      previews.map((p) => ({
        ...p,
        description: voiceDescription,
      })),
    );
    return NextResponse.json({
      character,
      count: previews.length,
      usedRejectHints: rejectHints,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
