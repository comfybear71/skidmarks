import { NextResponse } from "next/server";
import { studioUsersConfigured } from "@/lib/studioUsers";
import { readSessionCookie, verifyStudioSession } from "@/lib/studioSession";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const gated = studioUsersConfigured();
  if (!gated) {
    return NextResponse.json({ gated: false, user: null });
  }
  const token = readSessionCookie(req.headers.get("cookie"));
  const sess = await verifyStudioSession(token);
  if (!sess) return NextResponse.json({ gated: true, user: null });
  return NextResponse.json({
    gated: true,
    user: { id: sess.id, email: sess.email },
  });
}
