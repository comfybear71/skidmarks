import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Chrome localStorage is per-origin. 127.0.0.1:3737 and localhost:3737 are
 * two different desks. Stuie works at http://localhost:3737/crash — send
 * any 127.0.0.1 page there so agents stop inspecting the empty desk.
 */
export function proxy(request: NextRequest) {
  const host = request.headers.get("host") || "";
  const hostname = host.split(":")[0];
  if (hostname !== "127.0.0.1") return NextResponse.next();

  const port = host.includes(":") ? host.split(":")[1] : "3737";
  const path =
    request.nextUrl.pathname === "/" ? "/crash" : request.nextUrl.pathname;
  return NextResponse.redirect(
    `http://localhost:${port}${path}${request.nextUrl.search}`,
    307,
  );
}

export const config = {
  matcher: [
    "/",
    "/crash",
    "/crash/:path*",
    "/((?!api|_next/static|_next/image|favicon.ico|brand/).*)",
  ],
};
