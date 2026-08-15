import { NextResponse } from "next/server";
import { textKeyPresent } from "@/lib/textGen";
import { generateScreenplayText } from "@/lib/mobileScreenplay";
import { importScriptEpisodes } from "@/lib/scriptImport";
import { createCharactersFromScriptRoster } from "@/lib/mobileRoster";
import { openCrashLabEpisode } from "@/lib/crashLabEpisodes";
import { findReusableCastCards } from "@/lib/mobileCastReuse";
import {
  patchMobileGenJob,
  readMobileGenJob,
  type MobileGenJob,
  type MobileClipUnit,
  type MobileSceneRef,
  type MobileShotUnit,
} from "@/lib/mobileGenJob";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * POST { jobId } — the screenplay phase: prompt -> script text -> imported
 * pack -> auto roster -> job.shots/scenes/speakers populated. One bounded
 * call (chunked internally for long targets by generateScreenplayText),
 * advances the job to "cast_images" on success.
 */
export async function POST(req: Request) {
  try {
    if (!textKeyPresent()) {
      return NextResponse.json(
        { error: "Missing XAI_API_KEY in MY MOVIES\\.env, then restart Studio." },
        { status: 503 },
      );
    }

    const body = (await req.json().catch(() => ({}))) as { jobId?: string };
    const jobId = (body.jobId || "").trim();
    if (!jobId) return NextResponse.json({ error: "Need jobId" }, { status: 400 });

    const job = await readMobileGenJob(jobId);
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    if (job.phase !== "screenplay") {
      return NextResponse.json({ ok: true, job }); // already past this phase — idempotent
    }

    const shotCount = Math.max(1, Math.round(job.targetDurationSec / job.secondsPerShot));
    const screenplay = await generateScreenplayText({
      prompt: job.prompt,
      styleId: job.styleId,
      shotCount,
    });

    const imported = await importScriptEpisodes(job.styleId, screenplay.parsedEpisodes);
    const folderName = imported[0]?.folderName;
    if (!folderName) throw new Error("Import produced no episode pack");

    createCharactersFromScriptRoster(screenplay.parsedCharacters);

    const opened = openCrashLabEpisode({ folderName, styleId: job.styleId });
    const story = opened.story;

    const scenes: MobileSceneRef[] = story.scenes.map((sc) => ({
      id: sc.id,
      placeName: sc.placeName,
      worldThumbKey: sc.worldThumbKey,
    }));
    const shots: MobileShotUnit[] = story.scenes.flatMap((sc) =>
      sc.shots.map((sh) => ({
        shotId: sh.id,
        sceneId: sc.id,
        plateFile: "",
      })),
    );
    const clips: MobileClipUnit[] = story.scenes.flatMap((sc) =>
      sc.shots.flatMap((sh) =>
        sh.beats.map((b) => ({
          beatId: b.id,
          shotId: sh.id,
          sceneId: sc.id,
          clipFile: "",
          clipStatus: "pending" as const,
          error: "",
        })),
      ),
    );
    // Cast cards used to come from dialogue beats alone, so anyone in the
    // story who never speaks — "a monkey holding hands with Elon Musk" — was
    // silently dropped and never got a face. Take the parsed roster too.
    // Character cues are ALL CAPS by screenplay convention while the roster
    // keeps normal casing, so a plain Set treated WALLY and Wally as two
    // people — two cast cards, two sets of generations, two plates. Fold on
    // lowercase and keep the roster's casing, which is the readable one.
    const beatSpeakers = story.scenes.flatMap((sc) =>
      sc.shots.flatMap((sh) => sh.beats.map((b) => b.speaker.trim())),
    );
    const byLower = new Map<string, string>();
    for (const raw of [
      ...screenplay.parsedCharacters.map((c) => c.name.trim()),
      ...beatSpeakers,
    ]) {
      if (!raw) continue;
      const key = raw.toLowerCase();
      if (!byLower.has(key)) byLower.set(key, raw);
    }
    const speakers = [...byLower.values()];

    // A series keeps the same faces every episode, so any speaker who already
    // has a locked card for this show starts pre-picked instead of costing
    // four fresh generations and drifting away from how they looked last time.
    // Shown as a normal pick rather than skipped, so a wrong name match is
    // visible and can be overridden.
    const reusable = await findReusableCastCards(job.styleId, speakers);
    const castCandidates: MobileGenJob["castCandidates"] = {};
    for (const [speaker, card] of Object.entries(reusable)) {
      castCandidates[speaker] = [
        { id: card.fileName, fileName: card.fileName, approved: true },
      ];
    }

    const updated = await patchMobileGenJob(jobId, {
      folderName,
      phase: "cast_images",
      castCandidates,
      scenes,
      shots,
      clips,
      speakers,
      roster: screenplay.parsedCharacters,
    });

    return NextResponse.json({ ok: true, job: updated });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
