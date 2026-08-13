import { NextResponse } from "next/server";
import { createCrashJob, listCrashJobs } from "@/lib/crash";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json({ jobs: listCrashJobs() });
  } catch (e) {
    console.error("[crash GET]", e);
    return NextResponse.json({ jobs: [] });
  }
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    title?: string;
    characterId?: string;
    preset?: "in_front_of_nose" | "side_only" | "hell_smash" | "blank";
    kind?: "morph" | "smash";
  };
  const job = createCrashJob({
    title: body.title,
    characterId: body.characterId,
    preset: body.preset,
    kind: body.kind || "morph",
  });
  return NextResponse.json({ job });
}
