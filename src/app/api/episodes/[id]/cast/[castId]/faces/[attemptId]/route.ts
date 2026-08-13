import fs from "fs";
import { NextResponse } from "next/server";
import {
  castFacePath,
  deleteCastFace,
  getCastMember,
  setCastFaceStatus,
} from "@/lib/episodeCast";
import type { AttemptStatus } from "@/lib/types";

export const runtime = "nodejs";

type Ctx = {
  params: Promise<{ id: string; castId: string; attemptId: string }>;
};

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

export async function GET(_req: Request, ctx: Ctx) {
  const { id, castId, attemptId } = await ctx.params;
  const m = getCastMember(id, castId);
  if (!m) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const attempt = m.faceAttempts.find((a) => a.id === attemptId);
  if (!attempt?.fileName)
    return NextResponse.json({ error: "No image" }, { status: 404 });
  const filePath = castFacePath(id, castId, attempt.fileName);
  if (!filePath)
    return NextResponse.json({ error: "Missing file" }, { status: 404 });
  const ext = attempt.fileName.slice(attempt.fileName.lastIndexOf(".")).toLowerCase();
  const buf = fs.readFileSync(filePath);
  return new NextResponse(buf, {
    headers: {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": "private, max-age=60",
    },
  });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id, castId, attemptId } = await ctx.params;
  const m = getCastMember(id, castId);
  if (!m) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Guard the keeper — unlock it before it can be removed
  if (m.approvedFaceId === attemptId) {
    return NextResponse.json(
      { error: "That's the locked keeper — Park it first, then remove" },
      { status: 409 },
    );
  }
  const episode = deleteCastFace(id, castId, attemptId);
  if (!episode)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ episode });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { id, castId, attemptId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    status?: AttemptStatus;
    reason?: string;
  };
  if (!body.status) {
    return NextResponse.json({ error: "Need status" }, { status: 400 });
  }
  const episode = setCastFaceStatus(
    id,
    castId,
    attemptId,
    body.status,
    body.reason || "",
  );
  if (!episode)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ episode });
}
