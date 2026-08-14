import { NextResponse } from "next/server";
import { readScriptVoiceProgress } from "@/lib/scriptVoiceProgress";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ progress: readScriptVoiceProgress() });
}
