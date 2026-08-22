import { NextResponse } from "next/server";
import {
  addCastVoiceAttempts,
  getCastMember,
  updateCastMember,
} from "@/lib/episodeCast";
import { designVoicePreviews, elevenKeyPresent } from "@/lib/elevenLabs";
import { getEpisode } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 120;

type Ctx = { params: Promise<{ id: string; castId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { id, castId } = await ctx.params;
  if (!getEpisode(id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  const m = getCastMember(id, castId);
  if (!m) return NextResponse.json({ error: "Cast not found" }, { status: 404 });

  if (!elevenKeyPresent()) {
    return NextResponse.json(
      { error: "Missing ELEVENLABS_API_KEY in your environment variables" },
      { status: 503 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    voiceDescription?: string;
    previewText?: string;
  };

  const voiceDescription = (
    body.voiceDescription ||
    m.voiceDescription ||
    m.roleNote ||
    ""
  ).trim();
  if (!voiceDescription) {
    return NextResponse.json(
      { error: "Write a voice description first" },
      { status: 400 },
    );
  }

  if (voiceDescription !== m.voiceDescription) {
    updateCastMember(id, castId, { voiceDescription });
  }

  const fresh = getCastMember(id, castId)!;
  const rejectHints = fresh.voiceAttempts
    .filter((a) => a.status === "rejected" && a.reason)
    .slice(0, 8)
    .map((a) => a.reason);

  const previewText =
    body.previewText ||
    fresh.previewText ||
    `G'day, I'm ${fresh.name}.`;

  try {
    const previews = await designVoicePreviews({
      voiceDescription,
      previewText,
      rejectHints,
    });
    const episode = addCastVoiceAttempts(
      id,
      castId,
      previews.map((p) => ({
        generatedVoiceId: p.generatedVoiceId,
        audioBase64: p.audioBase64,
        previewText: p.previewText,
        description: voiceDescription,
      })),
    );
    if (!episode)
      return NextResponse.json({ error: "Save failed" }, { status: 500 });
    return NextResponse.json({ episode, count: previews.length });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
