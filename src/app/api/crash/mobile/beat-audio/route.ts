import { NextResponse } from "next/server";
import { synthesizeStoryBeat } from "@/lib/crashStorySpeak";
import { resolveMobileBeatAudio } from "@/lib/resolveMobileBeatAudio";
import { uploadMobileMedia } from "@/lib/mobileMediaStore";
import { isSafeMediaName } from "@/lib/cloudMedia";
import { readMobileStory, writeMobileStory } from "@/lib/mobileStoryStore";
import { patchMobileGenJob, readMobileGenJob } from "@/lib/mobileGenJob";
import { upsertPendingClip } from "@/lib/mobileClipQueue";
import { serveMediaFile } from "@/lib/serveMediaFile";
import { ensureSpeakerVoiceCast } from "@/lib/scriptVoiceGen";
import { pinSpeakerLibraryVoice } from "@/lib/mobileVoiceReuse";
import { candidateLookPrompt } from "@/lib/mobileJobReady";
import { buildDefaultBeatMotion } from "@/lib/mobileImageMotion";
import { jobVoiceForSpeaker } from "@/lib/mobileJobVoices";
import { voiceNamesMatch } from "@/lib/voiceNameMatch";
import {
  dropLeftoverHydrateBeats,
  keepStoredImageMotion,
  leftoverHydrateSpeakers,
  shotSpeakersOnCard,
} from "@/lib/mobilePlateLines";
import type { ShowStyleId } from "@/lib/showStylePresets";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET — stream one beat's synthesized line, so the "building the story" feed
 * can play a line as soon as it's voiced instead of only after the whole
 * episode is stitched.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const styleId = (url.searchParams.get("styleId") || "") as ShowStyleId;
  const folderName = url.searchParams.get("folderName") || "";
  const beatId = url.searchParams.get("beatId") || "";
  const fileName = url.searchParams.get("fileName") || "";
  if (!styleId || !folderName || !beatId || !isSafeMediaName(fileName)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const filePath = await resolveMobileBeatAudio({
    styleId,
    folderName,
    beatId,
    voiceFile: fileName,
  });
  if (!filePath) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return serveMediaFile(req, filePath, "audio/mpeg", { "Cache-Control": "private, max-age=300" });
}

/**
 * POST { jobId, beatId, text } — edit a line and re-voice it. Lets the "tap a
 * plate, check the line, hear it" review step fix a bad line before Animate
 * ever queues a clip against it, rather than only after a wasted render.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      jobId?: string;
      beatId?: string;
      text?: string;
    };
    const jobId = (body.jobId || "").trim();
    const beatId = (body.beatId || "").trim();
    const text = (body.text || "").trim();
    if (!jobId || !beatId || !text) {
      return NextResponse.json({ error: "Need jobId, beatId and text" }, { status: 400 });
    }

    const job = await readMobileGenJob(jobId);
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    // readMobileStory's cloud branch mirrors onto the local desk story, which
    // synthesizeStoryBeat reads/writes directly — without this, a request
    // landing on a fresh Vercel instance edits whatever pack that instance's
    // scratch disk last happened to hold, not this job's.
    const story = await readMobileStory(job.styleId, job.folderName);
    let speaker = "";
    for (const scene of story.scenes) {
      for (const shot of scene.shots) {
        const beat = shot.beats.find((b) => b.id === beatId);
        if (beat) speaker = beat.speaker;
      }
    }
    if (!speaker) {
      return NextResponse.json(
        { error: "This line has no speaker to voice — it plays as a held shot instead" },
        { status: 400 },
      );
    }
    if (
      job.speakers.length &&
      !job.speakers.some((s) => voiceNamesMatch(s, speaker) || s.trim().toLowerCase() === speaker.trim().toLowerCase())
    ) {
      return NextResponse.json(
        { error: "That line isn't this job's cast — leftover Comfy/Land audio stays parked" },
        { status: 400 },
      );
    }

    // CAST dropdown stores the library pick on the job. Pin that id onto
    // this speaker before TTS — otherwise /tmp has no lock and reuse can
    // grab leftover Comfy instead of Sunny Banks Nan.
    const picked = jobVoiceForSpeaker(job.speakerVoices, speaker);
    if (picked?.voiceId) {
      if (!pinSpeakerLibraryVoice(job.styleId, speaker, picked.voiceId)) {
        await ensureSpeakerVoiceCast(job.styleId, speaker);
      }
    } else {
      await ensureSpeakerVoiceCast(job.styleId, speaker);
    }

    const result = await synthesizeStoryBeat({ styleId: job.styleId, beatId, speaker, text });
    const lookLock =
      candidateLookPrompt(job.castCandidates, speaker) ||
      job.roster.find((c) => c.name.trim().toLowerCase() === speaker.trim().toLowerCase())
        ?.appearance ||
      "";
    const next = {
      ...result.story,
      scenes: result.story.scenes.map((sc) => ({
        ...sc,
        shots: sc.shots.map((sh) => {
          const leftovers = leftoverHydrateSpeakers(sh.id, sh.beats);
          const beats = dropLeftoverHydrateBeats(sh.id, sh.beats, beatId);
          const onCard = shotSpeakersOnCard({
            shotId: sh.id,
            title: sh.title,
            staging: sh.staging,
            summary: sh.summary,
            plateFile: sh.plateFile,
            jobSpeakers: job.speakers,
            beats,
          });
          return {
            ...sh,
            beats: beats.map((b) => {
              if (b.id !== beatId) return b;
              if (keepStoredImageMotion(b.imageMotion, leftovers)) return b;
              return {
                ...b,
                imageMotion: buildDefaultBeatMotion({
                  styleId: job.styleId,
                  speaker,
                  line: text,
                  lookLock,
                  shotSpeakers: onCard,
                }),
              };
            }),
          };
        }),
      })),
    };
    await writeMobileStory(next, job.folderName);
    const clips = upsertPendingClip(
      { ...job, clips: job.clips || [] },
      next,
      beatId,
    );
    const patched = await patchMobileGenJob(jobId, {
      clips,
      error: "",
      ...(job.phase === "error" || job.phase === "animate" ? { phase: "review" as const } : {}),
    });
    try {
      const localPath = await resolveMobileBeatAudio({
        styleId: job.styleId,
        folderName: job.folderName,
        beatId,
        voiceFile: result.voiceFile,
      });
      if (localPath) {
        await uploadMobileMedia({
          styleId: job.styleId,
          folderName: job.folderName,
          kind: "audio",
          localPath,
        });
      }
    } catch {
      /* best effort — clip generation still resolves the file locally on this instance */
    }

    return NextResponse.json({
      ok: true,
      voiceFile: result.voiceFile,
      job: patched,
      imageMotion:
        next.scenes
          .flatMap((sc) => sc.shots.flatMap((sh) => sh.beats))
          .find((b) => b.id === beatId)?.imageMotion || "",
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
