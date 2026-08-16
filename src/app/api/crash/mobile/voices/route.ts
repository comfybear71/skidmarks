import { NextResponse } from "next/server";
import { findCrashVoiceByName } from "@/lib/crashVoice";
import { readMobileGenJob, saveMobileJobSpeakerVoice } from "@/lib/mobileGenJob";
import { jobVoiceForSpeaker } from "@/lib/mobileJobVoices";

export const runtime = "nodejs";

/**
 * GET ?jobId=&speaker= — voice status for one speaker, or every speaker on
 * this job when speaker is omitted. Prefers the CAST pick stored on the
 * Neon job (survives Vercel /tmp), then the local crash-voice manifest.
 * Read-only, never touches ElevenLabs.
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
    const fromJob = jobVoiceForSpeaker(job.speakerVoices, name);
    const slot = findCrashVoiceByName(job.styleId, name);
    const voiceId = fromJob?.voiceId || slot?.approvedVoiceId?.trim() || "";
    return {
      name,
      cast: Boolean(voiceId),
      voiceId,
      voiceName: fromJob?.voiceName || "",
      voiceDescription: slot?.voiceDescription || "",
    };
  });

  return NextResponse.json({ ok: true, voices });
}

/**
 * POST { jobId, speaker, voiceId, voiceName? } — remember the CAST dropdown
 * pick on the job so the plate line Save uses that library voice, not a
 * leftover Comfy clip.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      jobId?: string;
      speaker?: string;
      voiceId?: string;
      voiceName?: string;
    };
    const jobId = (body.jobId || "").trim();
    const speakerIn = (body.speaker || "").trim();
    const voiceId = (body.voiceId || "").trim();
    const voiceName = (body.voiceName || "").trim();
    if (!jobId || !speakerIn || !voiceId) {
      return NextResponse.json({ error: "Need jobId, speaker and voiceId" }, { status: 400 });
    }

    const job = await readMobileGenJob(jobId);
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    const next = await saveMobileJobSpeakerVoice(jobId, speakerIn, { voiceId, voiceName });
    if (!next) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    return NextResponse.json({
      ok: true,
      voiceId,
      voiceName,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
