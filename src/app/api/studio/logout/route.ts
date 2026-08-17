import { NextResponse } from "next/server";
import { clearSessionCookieHeader } from "@/lib/studioSession";

export const runtime = "nodejs";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.headers.set("Set-Cookie", clearSessionCookieHeader());
  return res;
}
