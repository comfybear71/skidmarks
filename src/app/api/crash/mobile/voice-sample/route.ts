import fs from "fs";
import { NextResponse } from "next/server";
import {
  crashVoiceFilePath,
  ensureCrashVoiceSample,
  ensureVoiceSlotFromCards,
  findCrashVoiceByName,
  lockCrashVoiceByExternalId,
} from "@/lib/crashVoice";
import { getVoiceLibraryEntry, resolveKeeperFile } from "@/lib/voiceLibrary";
import { ensureSpeakerVoiceCast } from "@/lib/scriptVoiceGen";
import { readMobileGenJob } from "@/lib/mobileGenJob";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST { jobId, speaker, voiceId? } — cast this speaker's voice if it
 * doesn't have one yet (reuse first, design only if reuse comes up empty
 * — same priority beat-audio's save uses), then make sure a sample take
 * exists to play. Pass voiceId to pin a specific library voice instead of
 * leaving it to auto-pick.
 *
 * Returns the mp3 inline as a data URL rather than a /api/crash/voice/file
 * link — that route reads local disk only, and on Vercel the request that
 * plays it can land on a different instance than the one that just wrote
 * the file. Reading the bytes here, in the same request that made them,
 * sidesteps the whole cross-invocation problem.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      jobId?: string;
      speaker?: string;
      voiceId?: string;
    };
    const jobId = (body.jobId || "").trim();
    const speaker = (body.speaker || "").trim();
    const voiceIdIn = (body.voiceId || "").trim();
    if (!jobId || !speaker) {
      return NextResponse.json({ error: "Need jobId and speaker" }, { status: 400 });
    }

    const job = await readMobileGenJob(jobId);
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    let slot = findCrashVoiceByName(job.styleId, speaker);
    if (voiceIdIn) {
      const base = slot || ensureVoiceSlotFromCards(job.styleId, speaker);
      if (!base) return NextResponse.json({ error: "Couldn't set up a voice slot for this character" }, { status: 404 });
      slot = await lockCrashVoiceByExternalId({
        styleId: job.styleId,
        castKey: base.castKey,
        castName: speaker,
        voiceId: voiceIdIn,
      });
    } else if (!slot?.approvedVoiceId?.trim()) {
      const cast = await ensureSpeakerVoiceCast(job.styleId, speaker);
      if (!cast) {
        return NextResponse.json(
          { error: "Couldn't cast a voice for this character — design quota may be used up" },
          { status: 502 },
        );
      }
      slot = findCrashVoiceByName(job.styleId, speaker);
    }
    if (!slot) return NextResponse.json({ error: "No voice slot for this character" }, { status: 404 });

    const ready = await ensureCrashVoiceSample({ styleId: job.styleId, castKey: slot.castKey });
    if (!ready.approvedAttemptId) {
      return NextResponse.json({ error: "No sample to play yet" }, { status: 502 });
    }

    const attemptPath = crashVoiceFilePath(job.styleId, slot.castKey, `${ready.approvedAttemptId}.mp3`);
    const libEntry = attemptPath ? null : getVoiceLibraryEntry(job.styleId, slot.castName);
    const keeperPath = libEntry ? resolveKeeperFile(libEntry) : null;
    const filePath = attemptPath || keeperPath;
    if (!filePath) {
      return NextResponse.json({ error: "Sample was made but the audio file is missing" }, { status: 502 });
    }

    const audioBase64 = fs.readFileSync(filePath).toString("base64");

    return NextResponse.json({
      ok: true,
      audioBase64,
      voiceId: slot.approvedVoiceId?.trim() || voiceIdIn,
      voiceDescription: ready.voiceDescription,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
