import { NextResponse } from "next/server";
import { createCrashJob, listCrashJobs } from "@/lib/crash";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ jobs: listCrashJobs() });
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
