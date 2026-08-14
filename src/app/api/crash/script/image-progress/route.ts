import { NextResponse } from "next/server";
import { readScriptImageProgress } from "@/lib/scriptImageProgress";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ progress: readScriptImageProgress() });
}
