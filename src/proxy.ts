import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { STUDIO_SESSION_COOKIE, isStudioPublicPath, studioUsersConfigured } from "./lib/studioUsers";
import { verifyStudioSession } from "./lib/studioSession";

/**
 * Chrome localStorage is per-origin. 127.0.0.1:3737 and localhost:3737 are
 * two different desks. Stuie works at http://localhost:3737/crash — send
 * any 127.0.0.1 page there so agents stop inspecting the empty desk.
 *
 * When STUDIO_USERS is set: homepage stays public. /m, /scratch, Crash Lab,
 * and APIs need a signed-in cookie. APIs get 401. Pages bounce to /login.
 */
export async function proxy(request: NextRequest) {
  const host = request.headers.get("host") || "";
  const hostname = host.split(":")[0];
  if (hostname === "127.0.0.1") {
    const port = host.includes(":") ? host.split(":")[1] : "3737";
    const path =
      request.nextUrl.pathname === "/" ? "/crash" : request.nextUrl.pathname;
    return NextResponse.redirect(
      `http://localhost:${port}${path}${request.nextUrl.search}`,
      307,
    );
  }

  if (!studioUsersConfigured() || isStudioPublicPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(STUDIO_SESSION_COOKIE)?.value || "";
  const sess = await verifyStudioSession(token);
  if (!sess) {
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Sign in" }, { status: 401 });
    }
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = `?next=${encodeURIComponent(
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    )}`;
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|brand/|manifest\\.webmanifest).*)",
  ],
};
