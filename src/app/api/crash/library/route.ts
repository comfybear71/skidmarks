import { NextResponse } from "next/server";
import { listCrashLabImages } from "@/lib/crashLibrary";

export const runtime = "nodejs";

/** GET — Crash Lab gen stills + morph draft tray for pickers elsewhere. */
export async function GET() {
  return NextResponse.json({ items: listCrashLabImages() });
}
