import { NextResponse } from "next/server";
import { findCrashVoiceByName } from "@/lib/crashVoice";
import { readMobileGenJob } from "@/lib/mobileGenJob";

export const runtime = "nodejs";

/**
 * GET ?jobId=&speaker= — voice status for one speaker, or every speaker on
 * this job when speaker is omitted. Read-only, local manifest only — never
 * touches ElevenLabs, so it works even when the account key or network is
 * unavailable.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const jobId = (url.searchParams.get("jobId") || "").trim();
  const speaker = (url.searchParams.get("speaker") || "").trim();
  if (!jobId) return NextResponse.json({ error: "Need jobId" }, { status: 400 });

  const job = await readMobileGenJob(jobId);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const names = speaker ? [speaker] : job.speakers;
  const voices = names.map((name) => {
    const slot = findCrashVoiceByName(job.styleId, name);
    return {
      name,
      cast: Boolean(slot?.approvedVoiceId?.trim()),
      voiceId: slot?.approvedVoiceId?.trim() || "",
      voiceDescription: slot?.voiceDescription || "",
    };
  });

  return NextResponse.json({ ok: true, voices });
}
