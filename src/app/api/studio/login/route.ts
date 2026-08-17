import { NextResponse } from "next/server";
import {
  findStudioUserByEmail,
  passwordsMatch,
  studioUsersConfigured,
} from "@/lib/studioUsers";
import { sessionCookieHeader, signStudioSession } from "@/lib/studioSession";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!studioUsersConfigured()) {
    return NextResponse.json({ error: "Login is not turned on" }, { status: 400 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
  };
  const user = findStudioUserByEmail(body.email || "");
  const password = String(body.password || "");
  if (!user || !passwordsMatch(user.password, password)) {
    return NextResponse.json({ error: "Wrong email or password" }, { status: 401 });
  }
  const token = await signStudioSession(user);
  const res = NextResponse.json({
    ok: true,
    user: { id: user.id, email: user.email },
  });
  res.headers.set("Set-Cookie", sessionCookieHeader(token));
  return res;
}
