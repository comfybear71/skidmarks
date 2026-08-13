import { NextResponse } from "next/server";
import fs from "fs";
import {
  deleteAttempt,
  faceFilePath,
  getCharacter,
  setAttemptStatus,
} from "@/lib/characters";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string; attemptId: string }> };

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export async function GET(_req: Request, ctx: Ctx) {
  const { id, attemptId } = await ctx.params;
  const c = getCharacter(id);
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const attempt = c.faceAttempts.find((a) => a.id === attemptId);
  if (!attempt?.fileName)
    return NextResponse.json({ error: "No image" }, { status: 404 });
  const filePath = faceFilePath(id, attempt.fileName);
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

export async function PATCH(req: Request, ctx: Ctx) {
  const { id, attemptId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    status?: "pending" | "approved" | "rejected";
    reason?: string;
  };
  if (!body.status)
    return NextResponse.json({ error: "status required" }, { status: 400 });
  const character = setAttemptStatus(
    id,
    attemptId,
    body.status,
    body.reason || "",
  );
  if (!character)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ character });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id, attemptId } = await ctx.params;
  const character = deleteAttempt(id, attemptId);
  if (!character)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ character });
}
