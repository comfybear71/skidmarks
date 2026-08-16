import path from "path";
import { NextResponse } from "next/server";
import { assignReusedVoice } from "@/lib/mobileVoiceReuse";
import { hydrateMobilePackOnDisk, readMobileStory, writeMobileStory } from "@/lib/mobileStoryStore";
import { uploadMobileMedia, resolveMobileMedia } from "@/lib/mobileMediaStore";
import { resolveGenOrPackPlate } from "@/lib/crashActivePack";
import { synthesizeStoryBeat } from "@/lib/crashStorySpeak";
import { resolveMobileBeatAudio } from "@/lib/resolveMobileBeatAudio";
import { burnLeftoverPackAudio, savedVoiceFilesOnStory } from "@/lib/burnLeftoverPackAudio";
import { runLtxSmoke } from "@/lib/ltxSmoke";
import { resolveComfyUrl, probeComfyUrl } from "@/lib/comfyClient";
import { stitchClips, mobileFinalVideoPath } from "@/lib/mobileStitch";
import {
  bounceStuckStitch,
  MOBILE_STITCH_MOVIES,
  phaseAfterAnimateQueue,
  phaseAfterErrorResume,
} from "@/lib/mobilePipeline";
import { patchMobileGenJob, readMobileGenJob } from "@/lib/mobileGenJob";
import { mergeClipsFromStory, clipQueueError, queueableStoryBeats } from "@/lib/mobileClipQueue";
import { allCastApproved, allLocationsApproved, candidateLookPrompt } from "@/lib/mobileJobReady";
import {
  imageMotionNamesLeftovers,
  leftoverHydrateSpeakers,
  shotSpeakersOnCard,
} from "@/lib/mobilePlateLines";
import { CRASH_DIR } from "@/lib/paths";
import {
  buildDefaultBeatMotion,
  buildSegmentText,
  buildGlobalPrompt,
  ltxSendPrompt,
  stripLtxLipSyncLead,
  imageMotionUsableForLine,
  looksLikePlatePositionPrompt,
} from "@/lib/mobileImageMotion";

export const runtime = "nodejs";
export const maxDuration = 900;

async function ensureComfyReady(): Promise<string> {
  // runLtxSmoke checks preferComfyCloudLtx() first and, when true, goes
  // straight to Comfy Cloud — the comfyUrl this returns is discarded either
  // way, so resolving one is only needed when the cloud path isn't what's
  // about to run. RunPod auto-discovery (list pods, resume, guess a port)
  // was the testing-phase fallback here and is gone; a self-hosted Comfy is
  // reached by setting COMFY_URL directly.
  const { preferComfyCloudLtx } = await import("@/lib/ltxCloudIa2v");
  if (preferComfyCloudLtx()) return "";

  const resolved = await resolveComfyUrl();
  if (resolved.ok) {
    const status = await probeComfyUrl(resolved.url);
    if (status === "up") return resolved.url;
  }
  throw new Error("No Comfy Cloud key and no reachable COMFY_URL — set one to animate");
}

/**
 * POST { jobId, approveReview? } — advances the AUTOMATIC phases one
 * bounded unit at a time (plates -> voices -> [review, human-gated] ->
 * animate -> stitch -> done). Stitch is parked (MOBILE_STITCH_MOVIES) —
 * Generate video still sends clips to LTX; animate then returns to review.
 * cast_images/location_images are human-gated via /candidates and only
 * checked here for whether they're complete enough to move on. Never does
 * more than one shot/clip of real work per call so a long run survives
 * many short requests instead of one huge one.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      jobId?: string;
      approveReview?: boolean;
    };
    const jobId = (body.jobId || "").trim();
    if (!jobId) return NextResponse.json({ error: "Need jobId" }, { status: 400 });

    let job = await readMobileGenJob(jobId);
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    // "error" is terminal and outside autoPhases, so nothing ever polled it
    // again — a clip attached from the error screen (clip/upload/route.ts)
    // updated the clip but had no way to make the run continue. If any clip
    // now has a file, there's something to stitch; send it back to animate
    // to pick up whatever is still pending, or straight to stitch if none
    // is. Otherwise leave the job in error — nothing actually changed.
    if (job.phase === "error") {
      if (job.clips.some((c) => c.clipStatus === "done")) {
        const nextPhase = phaseAfterErrorResume(
          job.clips.some((c) => c.clipStatus === "pending"),
        );
        job = (await patchMobileGenJob(jobId, { phase: nextPhase, error: "" }))!;
        return NextResponse.json({ ok: true, job, advanced: true });
      }
      job = (await patchMobileGenJob(jobId, { phase: "review", error: "" }))!;
      return NextResponse.json({ ok: true, job, advanced: true });
    }

    const unstick = bounceStuckStitch({ phase: job.phase, error: job.error });
    if (unstick) {
      job = (await patchMobileGenJob(jobId, { phase: unstick }))!;
      return NextResponse.json({ ok: true, job, advanced: true });
    }

    if (job.phase === "cast_images") {
      if (allCastApproved(job)) {
        job = (await patchMobileGenJob(jobId, { phase: "location_images" }))!;
      }
      return NextResponse.json({ ok: true, job, advanced: job.phase !== "cast_images" });
    }

    if (job.phase === "location_images") {
      if (allLocationsApproved(job)) {
        job = (await patchMobileGenJob(jobId, { phase: "plates" }))!;
      } else {
        return NextResponse.json({ ok: true, job, advanced: false });
      }
    }

    if (job.phase === "plates") {
      // Empty shot strip on purpose. Auto-compositing every shot from the
      // lock used to mint an early-dev still nobody asked to start from.
      // Rebuild one shot at a time from Tweak. In-flight jobs already in
      // this phase skip the lottery the same way.
      job = (await patchMobileGenJob(jobId, { phase: "review" }))!;
      return NextResponse.json({ ok: true, job, advanced: true });
    }

    if (job.phase === "review") {
      if (!body.approveReview) {
        return NextResponse.json({ ok: true, job, advanced: false });
      }

      const takenVoices = new Set<string>();
      for (const speaker of job.speakers) {
        await assignReusedVoice(job.styleId, speaker, takenVoices);
      }
      if (!job.folderName) throw new Error("Job has no folder — screenplay phase incomplete");
      await hydrateMobilePackOnDisk(job.styleId, job.folderName);
      let voicedStory = await readMobileStory(job.styleId, job.folderName);
      const voiceRun: { quotaExceeded: boolean; lines: { ok: boolean; detail?: string }[] } = {
        quotaExceeded: false,
        lines: [],
      };
      for (const w of queueableStoryBeats(voicedStory, job)) {
        const have = await resolveMobileBeatAudio({
          styleId: job.styleId,
          folderName: job.folderName,
          beatId: w.beatId,
          voiceFile: w.voiceFile,
        });
        if (have) {
          try {
            await uploadMobileMedia({
              styleId: job.styleId,
              folderName: job.folderName,
              kind: "audio",
              localPath: have,
            });
          } catch {
            /* already in Blob or local */
          }
          continue;
        }
        if (!w.line.trim()) continue;
        try {
          const result = await synthesizeStoryBeat({
            styleId: job.styleId,
            beatId: w.beatId,
            speaker: w.speaker,
            text: w.line,
          });
          const localPath = await resolveMobileBeatAudio({
            styleId: job.styleId,
            folderName: job.folderName,
            beatId: w.beatId,
            voiceFile: result.voiceFile,
          });
          if (localPath) {
            // Animate runs on a later, separate invocation and trusts the
            // story's voiceFile alone — if this upload silently failed, the
            // story below would still point Generate at an mp3 that exists
            // nowhere it can reach. Retry once for a blip, then leave the
            // OLD (still-resolvable) story/voiceFile in place and record a
            // real failure instead of a phantom queueable beat.
            try {
              await uploadMobileMedia({
                styleId: job.styleId,
                folderName: job.folderName,
                kind: "audio",
                localPath,
              });
            } catch {
              await uploadMobileMedia({
                styleId: job.styleId,
                folderName: job.folderName,
                kind: "audio",
                localPath,
              });
            }
          }
          voicedStory = result.story;
          await writeMobileStory(voicedStory, job.folderName);
          voiceRun.lines.push({ ok: true });
        } catch (e) {
          const detail = e instanceof Error ? e.message : String(e);
          if (/quota/i.test(detail)) voiceRun.quotaExceeded = true;
          voiceRun.lines.push({ ok: false, detail });
        }
      }

      const wanted = queueableStoryBeats(voicedStory, job);
      const voicedBeats = wanted.filter((w) => w.line.trim() && w.voiceFile.trim()).length;
      if (!voicedBeats && wanted.some((w) => w.line.trim())) {
        const why =
          (voiceRun.quotaExceeded ? "ElevenLabs quota exceeded. " : "") +
          (voiceRun.lines.find((l) => !l.ok)?.detail ||
            "no dialogue lines were synthesised");
        job = (await patchMobileGenJob(jobId, {
          phase: "error",
          error: `Voices produced no audio — ${why}`,
        }))!;
        return NextResponse.json({ ok: true, job, advanced: true });
      }

      job = (await patchMobileGenJob(jobId, {
        clips: mergeClipsFromStory(job, voicedStory).map((c) =>
          c.clipStatus === "error" ? { ...c, clipStatus: "pending" as const, error: "" } : c,
        ),
      }))!;
      const pending = job.clips.filter((c) => c.clipStatus === "pending");
      if (!pending.length) {
        const saved = mergeClipsFromStory(job, voicedStory).length;
        job = (await patchMobileGenJob(jobId, {
          phase: "review",
          error: saved
            ? "Those lines already have clips — nothing new to send. Save the line again to re-queue, or open LTX Image motion and Keep it first."
            : "No lines to send to LTX. Save the spoken line on the plate first — Play appears next to the name when the mp3 is ready.",
        }))!;
        return NextResponse.json({ ok: true, job, advanced: false });
      }

      job = (await patchMobileGenJob(jobId, { phase: "animate", error: "" }))!;
      return NextResponse.json({ ok: true, job, advanced: true });
    }

    if (job.phase === "animate") {
      const next = job.clips.find((c) => c.clipStatus === "pending");
      if (!next) {
        const failed = clipQueueError(job.clips);
        if (failed) {
          job = (await patchMobileGenJob(jobId, { phase: "error", error: failed }))!;
          return NextResponse.json({ ok: true, job, advanced: true });
        }
        if (!job.clips.length) {
          job = (await patchMobileGenJob(jobId, {
            phase: "error",
            error:
              "Animating with 0 lines — the saved mp3 never got queued. Save the line on the plate, then Generate video again.",
          }))!;
          return NextResponse.json({ ok: true, job, advanced: true });
        }
        try {
          const doneStory = await readMobileStory(job.styleId, job.folderName);
          await burnLeftoverPackAudio({
            styleId: job.styleId,
            folderName: job.folderName,
            keepFiles: savedVoiceFilesOnStory(doneStory),
          });
        } catch {
          /* completion still returns — leftover burn is best effort */
        }
        job = (await patchMobileGenJob(jobId, {
          phase: phaseAfterAnimateQueue(false),
          ...(job.plateLtxCampaign?.phase === "animating"
            ? {
                plateLtxCampaign: {
                  ...job.plateLtxCampaign,
                  phase: "done" as const,
                  error: "",
                },
              }
            : {}),
        }))!;
        return NextResponse.json({ ok: true, job, advanced: true });
      }
      const shot = job.shots.find((s) => s.shotId === next.shotId);
      const story = await readMobileStory(job.styleId, job.folderName);
      const scene = story.scenes.find((sc) => sc.id === next.sceneId);
      const storyShot = scene?.shots.find((sh) => sh.id === next.shotId);
      const beat = storyShot?.beats.find((b) => b.id === next.beatId);
      try {
        // One message for three different failures told us nothing about
        // which. They need separate answers: a failed plate is a cast/location
        // problem, a missing beat is a story/job mismatch.
        if (!shot) {
          throw new Error(`Clip references shot ${next.shotId}, which is not in this job`);
        }
        if (shot.plateFile === "__error__") {
          throw new Error(
            shot.error
              ? `Shot ${next.shotId} failed to plate — ${shot.error}`
              : `Shot ${next.shotId} failed to plate — check its cast and location were both picked`,
          );
        }
        if (!shot.plateFile) {
          throw new Error(`Shot ${next.shotId} has no plate yet`);
        }
        if (!storyShot || !beat) {
          throw new Error(`Line ${next.beatId} is missing from the story for shot ${next.shotId}`);
        }
        const platePath =
          resolveGenOrPackPlate(shot.plateFile) ||
          (await resolveMobileMedia({
            styleId: job.styleId,
            folderName: job.folderName,
            kind: "plates",
            fileName: shot.plateFile,
            destPath: path.join(CRASH_DIR, "gen", shot.plateFile),
          }));
        if (!platePath) throw new Error("Plate file missing on disk");
        // /crash Send uses the beat you picked (plate + that mp3 + Image
        // motion). The queued clip is that pick. Hydrate can blank
        // story.voiceFile on a read (leftover strip / older snapshot) while
        // the clip still holds the Save take — looking up beat.voiceFile
        // then asked Blob for beat_<id>.mp3 and died unreachable.
        const voiceFile = (next.voiceFile || beat.voiceFile || "").trim();
        const speaker = (next.speaker || beat.speaker || "").trim();
        const line = (next.line || beat.text || "").trim();
        const audioPath = await resolveMobileBeatAudio({
          styleId: job.styleId,
          folderName: job.folderName,
          beatId: beat.id,
          voiceFile,
        });
        if (!audioPath) {
          // The generic "GEN MP3 first" from runLtxCloudIa2v gives no way to
          // tell "never voiced" apart from "voiced but unreachable from this
          // request" — say exactly which file, whose story beat, and whether
          // the queued clip even agrees with the story on what that file is.
          throw new Error(
            `Beat mp3 not reachable — story.voiceFile="${beat.voiceFile || "(empty)"}" ` +
              `clip.voiceFile="${next.voiceFile || "(empty)"}" folderName="${job.folderName}" beatId=${beat.id}`,
          );
        }

        // Bare `NAME says: "line"` was the whole prompt LTX got — nothing held
        // the plate, so nothing stopped strangers walking in or the actual
        // character disappearing after the first frame. Reworked into the
        // shape docs/SUNNY_BANKS_IMAGE_MOTION_STANDARD.md logged as working
        // 100%: first-frame lock, look lock, "nothing new enters frame",
        // "same person and objects as the start image".
        const speaking = line.length > 0;
        const lookLock =
          candidateLookPrompt(job.castCandidates, speaker) ||
          job.roster.find(
            (c) => c.name.trim().toLowerCase() === speaker.toLowerCase(),
          )?.appearance;
        const leftovers = leftoverHydrateSpeakers(storyShot.id, storyShot.beats);
        const shotCast = shotSpeakersOnCard({
          shotId: storyShot.id,
          title: storyShot.title,
          staging: storyShot.staging,
          summary: storyShot.summary,
          plateFile: storyShot.plateFile,
          jobSpeakers: job.speakers,
          beats: storyShot.beats,
        });
        const stored = stripLtxLipSyncLead(beat.imageMotion || "");
        if (looksLikePlatePositionPrompt(line)) {
          throw new Error(
            "The queued line is the still position, not speech. Wipe the line box, type what she says, Save, then Generate video.",
          );
        }
        const body =
          (stored &&
          !imageMotionNamesLeftovers(stored, leftovers) &&
          imageMotionUsableForLine(stored, line)
            ? stored
            : "") ||
          buildDefaultBeatMotion({
            styleId: job.styleId,
            speaker,
            line,
            lookLock,
            shotSpeakers: shotCast,
          });
        const imageMotion = ltxSendPrompt(body);

        // Recorded on the clip before the render even starts, so the prompt is
        // visible on screen the moment the clip is queued — not only once it
        // succeeds or fails.
        job = (await patchMobileGenJob(jobId, {
          clips: job.clips.map((c) =>
            c.beatId === next.beatId
              ? { ...c, speaker, line, voiceFile, imageMotion }
              : c,
          ),
        }))!;

        const comfyUrl = await ensureComfyReady();
        const result = await runLtxSmoke({
          platePath,
          audioPath,
          imageMotion,
          segmentText: buildSegmentText(speaker, speaking),
          globalPrompt: buildGlobalPrompt(job.styleId),
          comfyUrl,
          styleId: job.styleId,
          beatId: beat.id,
        });
        try {
          await uploadMobileMedia({
            styleId: job.styleId,
            folderName: job.folderName,
            kind: "mp4",
            localPath: result.localMp4,
          });
        } catch {
          /* best effort — clip still usable this request; stitch falls back to local disk */
        }
        const clips = job.clips.map((c) =>
          c.beatId === next.beatId
            ? { ...c, clipFile: result.localMp4, clipStatus: "done" as const }
            : c,
        );
        job = (await patchMobileGenJob(jobId, { clips }))!;
      } catch (e) {
        const clips = job.clips.map((c) =>
          c.beatId === next.beatId
            ? { ...c, clipStatus: "error" as const, error: e instanceof Error ? e.message : String(e) }
            : c,
        );
        job = (await patchMobileGenJob(jobId, { clips }))!;
      }
      return NextResponse.json({ ok: true, job, advanced: true });
    }

    if (job.phase === "stitch") {
      if (!MOBILE_STITCH_MOVIES) {
        job = (await patchMobileGenJob(jobId, { phase: "review", error: "" }))!;
        return NextResponse.json({ ok: true, job, advanced: true });
      }
      const done = job.clips.filter((c) => c.clipStatus === "done" && c.clipFile);
      if (!done.length) {
        // Every clip's real failure is recorded on the clip and was then
        // thrown away here, leaving a dead end with no reason on screen and
        // nothing in the browser console (these failures are server-side).
        const reasons = [
          ...new Set(job.clips.map((c) => (c.error || "").trim()).filter(Boolean)),
        ];
        job = (await patchMobileGenJob(jobId, {
          phase: "error",
          error: reasons.length
            ? `No clips generated — ${reasons[0]}${reasons.length > 1 ? ` (+${reasons.length - 1} other reason${reasons.length > 2 ? "s" : ""})` : ""}`
            : "No clips generated successfully — nothing to stitch",
        }))!;
        return NextResponse.json({ ok: true, job, advanced: true });
      }
      const clipPaths: string[] = [];
      for (const c of done) {
        const resolved = await resolveMobileMedia({
          styleId: job.styleId,
          folderName: job.folderName,
          kind: "mp4",
          fileName: path.basename(c.clipFile),
          destPath: c.clipFile,
        });
        if (resolved) clipPaths.push(resolved);
      }
      if (!clipPaths.length) {
        job = (await patchMobileGenJob(jobId, {
          phase: "error",
          error: "Clips were generated but aren't available anymore — try Animate again",
        }))!;
        return NextResponse.json({ ok: true, job, advanced: true });
      }
      const finalVideoFile = stitchClips(clipPaths);
      try {
        await uploadMobileMedia({
          styleId: job.styleId,
          folderName: job.folderName,
          kind: "mp4",
          localPath: mobileFinalVideoPath(finalVideoFile),
        });
      } catch {
        /* best effort — final/route.ts falls back to local disk first anyway */
      }
      job = (await patchMobileGenJob(jobId, { phase: "done", finalVideoFile }))!;
      return NextResponse.json({ ok: true, job, advanced: true, finalVideoPath: mobileFinalVideoPath(finalVideoFile) });
    }

    return NextResponse.json({ ok: true, job, advanced: false });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
