import { NextResponse } from "next/server";
import { textKeyPresent } from "@/lib/textGen";
import { generateScreenplayText } from "@/lib/mobileScreenplay";
import { importScriptEpisodes } from "@/lib/scriptImport";
import { createCharactersFromScriptRoster } from "@/lib/mobileRoster";
import { openCrashLabEpisode } from "@/lib/crashLabEpisodes";
import { writeMobileStory } from "@/lib/mobileStoryStore";
import { findReusableCastCards } from "@/lib/mobileCastReuse";
import { listCharacters } from "@/lib/characters";
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
 * POST { jobId } — the screenplay phase: cast + locations were already
 * built freeform (cast_build/location_build), faces already approved, so
 * this writes a script constrained to exactly that cast and those places
 * rather than inventing its own — then reconciles the parsed scenes/roster
 * back onto the pre-built ones (matched by name) so the approved picks
 * carry straight through instead of asking for them a second time.
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
    if (job.phase !== "location_build") {
      return NextResponse.json({ ok: true, job }); // already past this phase — idempotent
    }
    if (!job.speakers.length) {
      return NextResponse.json({ error: "Add at least one character first" }, { status: 400 });
    }
    if (!job.scenes.length) {
      return NextResponse.json({ error: "Add at least one location first" }, { status: 400 });
    }

    const byLowerName = new Map(listCharacters().map((c) => [c.name.trim().toLowerCase(), c]));
    const cast = job.speakers.map((name) => {
      const character = byLowerName.get(name.trim().toLowerCase());
      const appearance = character
        ? [character.lookNote, character.pastNote].filter(Boolean).join(". ").trim()
        : "";
      return { name, appearance: appearance || name };
    });
    const locations = job.scenes.map((s) => s.placeName);

    const shotCount = Math.max(1, Math.round(job.targetDurationSec / job.secondsPerShot));
    const screenplay = await generateScreenplayText({
      prompt: job.prompt,
      styleId: job.styleId,
      shotCount,
      cast,
      locations,
    });

    // The pack folder is derived from the episode title, and on Vercel the
    // disk is empty on every invocation, so re-running the same prompt handed
    // back the same folder name. Neon still held the previous run's story, and
    // saveCloudEpisodeMeta rightly keeps the older one when it has plated shots
    // and the incoming import has none — leaving this run's job pointing at
    // scene and shot ids from a different run. Each run is its own episode, so
    // give it its own folder.
    const runTag = jobId.slice(-6);
    const episodesForImport = screenplay.parsedEpisodes.map((ep, i) =>
      i === 0 ? { ...ep, title: `${ep.title} ${runTag}` } : ep,
    );
    const imported = await importScriptEpisodes(job.styleId, episodesForImport);
    const folderName = imported[0]?.folderName;
    if (!folderName) throw new Error("Import produced no episode pack");

    createCharactersFromScriptRoster(screenplay.parsedCharacters);

    const opened = openCrashLabEpisode({ folderName, styleId: job.styleId });

    // scriptToStory.ts always mints a fresh scene id — reuse location_build's
    // id (and its already-approved worldThumbKey) for any scene whose place
    // name matches one already built, so the approved picture carries
    // straight through instead of asking for it a second time.
    const preBuiltByPlace = new Map(
      job.scenes.map((s) => [s.placeName.trim().toLowerCase(), s]),
    );
    const story = {
      ...opened.story,
      scenes: opened.story.scenes.map((sc) => {
        const match = preBuiltByPlace.get(sc.placeName.trim().toLowerCase());
        if (!match) return sc;
        return { ...sc, id: match.id, worldThumbKey: match.worldThumbKey || sc.worldThumbKey };
      }),
    };

    // The imported pack only exists on this instance's disk. Every later phase
    // reads the story back through readMobileStory, which falls back to the
    // empty local desk story when the cloud has none — so without this write
    // plates found no scenes at all and failed every shot.
    await writeMobileStory(story, folderName);

    // A pre-built location the screenplay never actually used (Grok drops
    // one, or the user built more than the script needed) still cost a
    // generation and an approval — keep it rather than silently losing it.
    const usedSceneIds = new Set(story.scenes.map((sc) => sc.id));
    const leftoverScenes = job.scenes.filter((s) => !usedSceneIds.has(s.id));

    const scenes: MobileSceneRef[] = [
      ...story.scenes.map((sc) => ({
        id: sc.id,
        placeName: sc.placeName,
        worldThumbKey: sc.worldThumbKey,
      })),
      ...leftoverScenes,
    ];
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
    // job.speakers goes in first and wins the casing fight — the forced
    // CHARACTERS: block above is in the ALL CAPS the parser requires to
    // recognize a block boundary at all ("TOMATO", not "Tomato"), which
    // would otherwise come back out of parsedCharacters as a name that no
    // longer matches job.castCandidates' key and looks unapproved again.
    const byLower = new Map<string, string>();
    for (const raw of job.speakers) {
      const key = raw.trim().toLowerCase();
      if (key) byLower.set(key, raw.trim());
    }
    for (const raw of [
      ...screenplay.parsedCharacters.map((c) => c.name.trim()),
      ...beatSpeakers,
    ]) {
      if (!raw) continue;
      const key = raw.toLowerCase();
      if (!byLower.has(key)) byLower.set(key, raw);
    }
    const speakers = [...byLower.values()];

    // Anyone already in job.castCandidates picked their own face in
    // cast_build — that pick wins outright. A series keeps the same faces
    // every episode too, so any OTHER speaker (one the screenplay added on
    // its own despite the constraint) who already has a locked card for
    // this show starts pre-picked instead of costing four fresh
    // generations. Shown as a normal pick rather than skipped, so a wrong
    // name match is visible and can be overridden.
    const newSpeakers = speakers.filter((s) => !job.castCandidates[s]?.some((c) => c.approved));
    const reusable = newSpeakers.length
      ? await findReusableCastCards(job.styleId, newSpeakers)
      : {};
    const castCandidates: MobileGenJob["castCandidates"] = { ...job.castCandidates };
    for (const [speaker, card] of Object.entries(reusable)) {
      castCandidates[speaker] = [
        { id: card.fileName, fileName: card.fileName, approved: true },
      ];
    }

    const updated = await patchMobileGenJob(jobId, {
      folderName,
      phase: "cast_images",
      castCandidates,
      locationCandidates: job.locationCandidates,
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
