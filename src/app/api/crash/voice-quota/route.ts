import { NextResponse } from "next/server";
import { readVoiceQuota } from "@/lib/elevenQuota";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ quota: readVoiceQuota() });
}
