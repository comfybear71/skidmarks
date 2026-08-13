import { NextResponse } from "next/server";
import fs from "fs";
import {
  deleteVoiceAttempt,
  getCharacter,
  setPrimaryVoice,
  setVoiceAttemptStatus,
  voiceFilePath,
} from "@/lib/characters";
import { createLibraryVoice } from "@/lib/elevenLabs";

export const runtime = "nodejs";
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string; attemptId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id, attemptId } = await ctx.params;
  const c = getCharacter(id);
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const attempt = c.voiceAttempts.find((a) => a.id === attemptId);
  if (!attempt?.fileName)
    return NextResponse.json({ error: "No audio" }, { status: 404 });
  const filePath = voiceFilePath(id, attempt.fileName);
  if (!filePath)
    return NextResponse.json({ error: "Missing file" }, { status: 404 });
  return new NextResponse(fs.readFileSync(filePath), {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "private, max-age=60",
    },
  });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { id, attemptId } = await ctx.params;
  const c = getCharacter(id);
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const attempt = c.voiceAttempts.find((a) => a.id === attemptId);
  if (!attempt)
    return NextResponse.json({ error: "Attempt not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    status?: "pending" | "approved" | "rejected" | "primary";
    reason?: string;
  };
  if (!body.status)
    return NextResponse.json({ error: "status required" }, { status: 400 });

  if (body.status === "primary") {
    const character = setPrimaryVoice(id, attemptId);
    if (!character)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ character });
  }

  let libraryVoiceId = attempt.voiceId || "";

  if (body.status === "approved") {
    // Already locked into ElevenLabs once — don't create a duplicate
    if (!libraryVoiceId) {
      try {
        const approvedCount = c.voiceAttempts.filter(
          (a) => a.status === "approved",
        ).length;
        const suffix = approvedCount > 0 ? ` ${approvedCount + 1}` : "";
        libraryVoiceId = await createLibraryVoice({
          voiceName: `${c.name.slice(0, 70)}${suffix}` || "Skidmarks character",
          voiceDescription:
            attempt.description || c.voiceDescription || c.name,
          generatedVoiceId: attempt.generatedVoiceId,
        });
      } catch (e) {
        return NextResponse.json(
          { error: e instanceof Error ? e.message : String(e) },
          { status: 502 },
        );
      }
    }
  }

  const character = setVoiceAttemptStatus(
    id,
    attemptId,
    body.status,
    body.reason || "",
    libraryVoiceId,
  );
  if (!character)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ character });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id, attemptId } = await ctx.params;
  const character = deleteVoiceAttempt(id, attemptId);
  if (!character)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ character });
}
