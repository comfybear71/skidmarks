import fs from "fs";
import { NextResponse } from "next/server";
import {
  castVoicePath,
  deleteCastVoiceAttempt,
  getCastMember,
  setCastVoiceStatus,
  voiceIdStillInUse,
} from "@/lib/episodeCast";
import { createLibraryVoice, deleteLibraryVoice } from "@/lib/elevenLabs";
import type { AttemptStatus } from "@/lib/types";

export const runtime = "nodejs";

type Ctx = {
  params: Promise<{ id: string; castId: string; attemptId: string }>;
};

export async function GET(_req: Request, ctx: Ctx) {
  const { id, castId, attemptId } = await ctx.params;
  const m = getCastMember(id, castId);
  if (!m) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const attempt = m.voiceAttempts.find((a) => a.id === attemptId);
  if (!attempt?.fileName)
    return NextResponse.json({ error: "No audio" }, { status: 404 });
  const filePath = castVoicePath(id, castId, attempt.fileName);
  if (!filePath)
    return NextResponse.json({ error: "Missing file" }, { status: 404 });
  const buf = fs.readFileSync(filePath);
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "private, max-age=60",
    },
  });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { id, castId, attemptId } = await ctx.params;
  const m = getCastMember(id, castId);
  if (!m) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const attempt = m.voiceAttempts.find((a) => a.id === attemptId);
  if (!attempt)
    return NextResponse.json({ error: "Attempt not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    status?: AttemptStatus;
    reason?: string;
  };
  if (!body.status) {
    return NextResponse.json({ error: "Need status" }, { status: 400 });
  }

  let libraryVoiceId = attempt.voiceId || "";
  if (body.status === "approved" && attempt.generatedVoiceId && !libraryVoiceId) {
    try {
      libraryVoiceId = await createLibraryVoice({
        voiceName: `${m.name.slice(0, 70)}` || "Skidmarks cast",
        voiceDescription: attempt.description || m.voiceDescription || m.name,
        generatedVoiceId: attempt.generatedVoiceId,
      });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : String(e) },
        { status: 502 },
      );
    }
  }

  const previousVoiceId = m.approvedVoiceId || "";

  const episode = setCastVoiceStatus(
    id,
    castId,
    attemptId,
    body.status,
    body.reason || "",
    libraryVoiceId,
  );
  if (!episode)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Keeping a new take frees the old one's slot on the ElevenLabs account —
  // but only if nothing else still relies on it.
  let freedVoiceId = "";
  if (
    body.status === "approved" &&
    previousVoiceId &&
    previousVoiceId !== libraryVoiceId &&
    !voiceIdStillInUse(previousVoiceId)
  ) {
    if (await deleteLibraryVoice(previousVoiceId)) {
      freedVoiceId = previousVoiceId;
    }
  }

  return NextResponse.json({ episode, freedVoiceId });
}

/** Only when Stuie hits X — remove this take. */
export async function DELETE(_req: Request, ctx: Ctx) {
  const { id, castId, attemptId } = await ctx.params;
  if (!getCastMember(id, castId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const episode = deleteCastVoiceAttempt(id, castId, attemptId);
  if (!episode) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ episode });
}
