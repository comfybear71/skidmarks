import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { findBeatInStory } from "@/lib/crashStorySpeak";
import { dialogueFileName, slugToken } from "@/lib/crashStoryNames";
import { storyDialogueDir } from "@/lib/crashStoryLocations";
import { writeCrashStory } from "@/lib/crashStory";
import { uploadMobileMedia } from "@/lib/mobileMediaStore";
import { readMobileStory, writeMobileStory } from "@/lib/mobileStoryStore";
import { patchMobileGenJob, readMobileGenJob } from "@/lib/mobileGenJob";
import { mobileMediaFolder } from "@/lib/mobileJobFolder";
import { upsertPendingClip } from "@/lib/mobileClipQueue";
import { isMobileSavedVoiceFile } from "@/lib/mobileSavedVoice";
import { voiceNamesMatch } from "@/lib/voiceNameMatch";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 40 * 1024 * 1024;

function looksLikeMp3(file: File, buf: Buffer): boolean {
  const name = (file.name || "").toLowerCase();
  if (name.endsWith(".mp3")) return true;
  const mime = (file.type || "").toLowerCase();
  if (mime === "audio/mpeg" || mime === "audio/mp3") return true;
  // ID3 or MPEG frame sync
  if (buf.length >= 3 && buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) {
    return true;
  }
  if (buf.length >= 2 && buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) {
    return true;
  }
  return false;
}

/**
 * POST multipart: jobId, beatId, file [, text] — drop an mp3 onto the
 * Scratch beat as the Saved take. Skips ElevenLabs. Same stamp naming as
 * Save so Generate / Play treat it as a real take.
 */
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const jobId = String(form.get("jobId") || "").trim();
    const beatId = String(form.get("beatId") || "").trim();
    const textOverride = String(form.get("text") || "").trim();
    const file = form.get("file");
    if (!jobId || !beatId) {
      return NextResponse.json({ error: "Need jobId and beatId" }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Need an mp3 file" }, { status: 400 });
    }
    if (file.size <= 0) {
      return NextResponse.json({ error: "That mp3 is empty" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "That mp3 is too large" }, { status: 400 });
    }

    const job = await readMobileGenJob(jobId);
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    const story = await readMobileStory(job.styleId, job.folderName);
    let speaker = "";
    let existingText = "";
    for (const scene of story.scenes) {
      for (const shot of scene.shots) {
        const beat = shot.beats.find((b) => b.id === beatId);
        if (beat) {
          speaker = beat.speaker;
          existingText = beat.text || "";
        }
      }
    }
    if (!speaker) {
      return NextResponse.json(
        { error: "No Scratch beat yet — Draw with a face on the pad first, then drop the mp3." },
        { status: 400 },
      );
    }
    if (
      job.speakers.length &&
      !job.speakers.some(
        (s) =>
          voiceNamesMatch(s, speaker) ||
          s.trim().toLowerCase() === speaker.trim().toLowerCase(),
      )
    ) {
      return NextResponse.json(
        { error: "That line isn't this job's cast — leftover Comfy/Land audio stays parked" },
        { status: 400 },
      );
    }

    const buf = Buffer.from(await file.arrayBuffer());
    if (!looksLikeMp3(file, buf)) {
      return NextResponse.json(
        { error: "Need an mp3 — LTX lip-sync only takes mpeg audio." },
        { status: 400 },
      );
    }

    const line = textOverride || existingText || "dropped line";
    const ctx = findBeatInStory(story, beatId);
    const baseName = ctx
      ? dialogueFileName({
          shotNum: ctx.shotNum,
          beatNum: ctx.beatNum,
          speaker,
          text: line,
        })
      : `${beatId}_${slugToken(line, 24)}.mp3`;
    const stamp = Date.now().toString(36);
    const fileName = baseName.replace(/\.mp3$/i, "") + `_${stamp}.mp3`;
    if (!isMobileSavedVoiceFile(fileName)) {
      return NextResponse.json(
        { error: `Couldn't stamp a Saved take name (${fileName})` },
        { status: 500 },
      );
    }

    const dir = storyDialogueDir(job.styleId);
    fs.mkdirSync(dir, { recursive: true });
    const localPath = path.join(dir, fileName);
    fs.writeFileSync(localPath, buf);

    const next = {
      ...story,
      scenes: story.scenes.map((sc) => ({
        ...sc,
        shots: sc.shots.map((sh) => ({
          ...sh,
          beats: sh.beats.map((b) =>
            b.id === beatId
              ? {
                  ...b,
                  voiceFile: fileName,
                  ...(textOverride ? { text: textOverride } : {}),
                }
              : b,
          ),
        })),
      })),
    };

    // Mirror local desk story so same-request Play / LTX resolve the file.
    writeCrashStory(next);
    await writeMobileStory(next, job.folderName);

    const clips = upsertPendingClip({ ...job, clips: job.clips || [] }, next, beatId);
    const patched = await patchMobileGenJob(jobId, {
      clips,
      error: "",
      ...(job.phase === "error" || job.phase === "animate" ? { phase: "review" as const } : {}),
    });

    const mediaFolder = mobileMediaFolder(job);
    try {
      await uploadMobileMedia({
        styleId: job.styleId,
        folderName: mediaFolder,
        kind: "audio",
        localPath,
      });
    } catch {
      try {
        await uploadMobileMedia({
          styleId: job.styleId,
          folderName: mediaFolder,
          kind: "audio",
          localPath,
        });
      } catch (e2) {
        const detail = e2 instanceof Error ? e2.message : String(e2);
        return NextResponse.json(
          {
            error: `Mp3 landed on disk but failed to reach cloud storage — ${detail}. Drop it again.`,
          },
          { status: 502 },
        );
      }
    }

    return NextResponse.json({
      ok: true,
      voiceFile: fileName,
      job: patched,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
