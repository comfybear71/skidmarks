import fs from "fs";
import os from "os";
import path from "path";
import { NextResponse } from "next/server";
import { findBeatInStory } from "@/lib/crashStorySpeak";
import { writeCrashStory } from "@/lib/crashStory";
import { dialogueFileName, slugToken } from "@/lib/crashStoryNames";
import { storyDialogueDir } from "@/lib/crashStoryLocations";
import { parseStyleCardId } from "@/lib/styleCardThumbs";
import {
  cutawayActionById,
  cutawaySfxInRange,
  cutawaySfxRangeError,
  findShowSfxItem,
  listShowSfxItems,
  readShowSfxBytes,
  resolveCutawaySfxDuration,
  CUTAWAY_ACTIONS,
} from "@/lib/cutawaySfx";
import { buildCutawayMotion } from "@/lib/mobileImageMotion";
import { candidateLookPrompt } from "@/lib/mobileJobReady";
import { shotSpeakersOnCard } from "@/lib/mobilePlateLines";
import { upsertPendingClip } from "@/lib/mobileClipQueue";
import { mobileMediaFolder } from "@/lib/mobileJobFolder";
import { patchMobileGenJob, readMobileGenJob } from "@/lib/mobileGenJob";
import { uploadMobileMedia } from "@/lib/mobileMediaStore";
import { isMobileSavedVoiceFile } from "@/lib/mobileSavedVoice";
import { readMobileStory, writeMobileStory } from "@/lib/mobileStoryStore";
import { voiceNamesMatch } from "@/lib/voiceNameMatch";

export const runtime = "nodejs";
export const maxDuration = 60;

/** GET ?styleId= — SFX mp3s on this show's SPX shelf. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const styleId = parseStyleCardId(url.searchParams.get("styleId"));
  if (!styleId) {
    return NextResponse.json({ error: "Need styleId" }, { status: 400 });
  }
  try {
    const items = await listShowSfxItems(styleId);
    return NextResponse.json({
      styleId,
      items: items.map((i) => ({
        id: i.id,
        fileName: i.fileName,
        label: i.label,
        note: i.note,
      })),
      actions: CUTAWAY_ACTIONS,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

/**
 * POST { jobId, beatId, spxId, actionId? } — copy a 6–10s catalogue SFX
 * onto this cutaway beat as the Saved mp3. Skips ElevenLabs. Same stamp
 * as Save so Play / Generate treat it as a real take.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      jobId?: string;
      beatId?: string;
      spxId?: string;
      actionId?: string;
    };
    const jobId = (body.jobId || "").trim();
    const beatId = (body.beatId || "").trim();
    const spxId = (body.spxId || "").trim();
    const actionId = (body.actionId || "").trim();
    if (!jobId || !beatId) {
      return NextResponse.json({ error: "Need jobId and beatId" }, { status: 400 });
    }
    if (!spxId && !actionId) {
      return NextResponse.json({ error: "Need an SFX or a cutaway move" }, { status: 400 });
    }

    const job = await readMobileGenJob(jobId);
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    const story = await readMobileStory(job.styleId, job.folderName);
    let speaker = "";
    let existingAction = "";
    let shotId = "";
    let staging = "";
    for (const scene of story.scenes) {
      for (const shot of scene.shots) {
        const beat = shot.beats.find((b) => b.id === beatId);
        if (!beat) continue;
        speaker = beat.speaker;
        existingAction = (beat.action || beat.text || "").trim();
        shotId = shot.id;
        staging = shot.staging || "";
      }
    }
    if (!speaker) {
      return NextResponse.json({ error: "That cutaway is not on this pack" }, { status: 404 });
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
        { error: "That line isn't this job's cast — leftover audio stays parked" },
        { status: 400 },
      );
    }

    const picked = cutawayActionById(actionId);
    const action = (picked?.action || existingAction || CUTAWAY_ACTIONS[0]!.action).trim();

    const lookLock =
      candidateLookPrompt(job.castCandidates, speaker) ||
      job.roster.find((c) => c.name.trim().toLowerCase() === speaker.trim().toLowerCase())
        ?.appearance ||
      "";
    const liveShot = story.scenes.flatMap((sc) => sc.shots).find((sh) => sh.id === shotId);
    const onCard = liveShot
      ? shotSpeakersOnCard({
          shotId: liveShot.id,
          title: liveShot.title,
          staging: liveShot.staging,
          summary: liveShot.summary,
          plateFile: liveShot.plateFile,
          jobSpeakers: job.speakers,
          beats: liveShot.beats,
        })
      : [speaker];
    const imageMotion = buildCutawayMotion({
      styleId: job.styleId,
      speaker,
      action,
      lookLock,
      shotSpeakers: onCard,
      staging,
    });

    if (!spxId) {
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
                    kind: "cutaway" as const,
                    text: action,
                    action,
                    imageMotion,
                  }
                : b,
            ),
          })),
        })),
      };
      writeCrashStory(next);
      await writeMobileStory(next, job.folderName);
      return NextResponse.json({ ok: true, action, imageMotion, job });
    }

    const item = await findShowSfxItem(job.styleId, spxId);
    if (!item) {
      return NextResponse.json({ error: "That SFX is not on this show's shelf" }, { status: 404 });
    }
    if (!/\.mp3$/i.test(item.fileName)) {
      return NextResponse.json(
        { error: "Need an mp3 from the SFX shelf — LTX only takes mpeg audio." },
        { status: 400 },
      );
    }

    const bytes = await readShowSfxBytes(job.styleId, item.fileName);
    if (!bytes?.length) {
      return NextResponse.json(
        { error: "Couldn't read that SFX — is it on the SPX shelf?" },
        { status: 404 },
      );
    }

    const tmp = path.join(os.tmpdir(), `cutaway-${Date.now()}-${item.fileName}`);
    fs.writeFileSync(tmp, bytes);
    const sec = resolveCutawaySfxDuration(tmp);
    if (sec == null || !cutawaySfxInRange(sec)) {
      try {
        fs.unlinkSync(tmp);
      } catch {
        /* ignore */
      }
      return NextResponse.json(
        { error: cutawaySfxRangeError(sec ?? Number.NaN) },
        { status: 400 },
      );
    }

    const ctx = findBeatInStory(story, beatId);
    const baseName = ctx
      ? dialogueFileName({
          shotNum: ctx.shotNum,
          beatNum: ctx.beatNum,
          speaker,
          text: action,
        })
      : `${beatId}_${slugToken(action, 24)}.mp3`;
    const stamp = Date.now().toString(36);
    const fileName = baseName.replace(/\.mp3$/i, "") + `_${stamp}.mp3`;
    if (!isMobileSavedVoiceFile(fileName)) {
      try {
        fs.unlinkSync(tmp);
      } catch {
        /* ignore */
      }
      return NextResponse.json(
        { error: `Couldn't stamp a Saved take name (${fileName})` },
        { status: 500 },
      );
    }

    const dir = storyDialogueDir(job.styleId);
    fs.mkdirSync(dir, { recursive: true });
    const localPath = path.join(dir, fileName);
    fs.copyFileSync(tmp, localPath);
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* ignore */
    }

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
                  kind: "cutaway" as const,
                  voiceFile: fileName,
                  text: action,
                  action,
                  spxId: item.id,
                  imageMotion,
                }
              : b,
          ),
        })),
      })),
    };

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
            error: `SFX landed on disk but failed to reach cloud storage — ${detail}. Tap it again.`,
          },
          { status: 502 },
        );
      }
    }

    return NextResponse.json({
      ok: true,
      voiceFile: fileName,
      action,
      durationSec: sec,
      imageMotion,
      job: patched,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
