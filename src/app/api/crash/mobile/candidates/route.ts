import { NextResponse } from "next/server";
import { imageKeyPresent } from "@/lib/imageGen";
import {
  approveCastCandidate,
  approveLocationCandidate,
  generateCastCandidates,
  generateLocationCandidates,
} from "@/lib/mobileCandidates";
import { createCharacter, listCharacters } from "@/lib/characters";
import { createCharactersFromScriptRoster } from "@/lib/mobileRoster";
import { readMobileStory, writeMobileStory } from "@/lib/mobileStoryStore";
import { patchMobileGenJob, readMobileGenJob } from "@/lib/mobileGenJob";
import { newId } from "@/lib/types";

// One candidate at a time, not a batch to swipe through — a dud gets
// replaced outright by the next generate call, not compared against three
// others that are probably just as wrong.
const CANDIDATES_PER_BATCH = 1;

export const runtime = "nodejs";
export const maxDuration = 300;

type Body = {
  jobId?: string;
  kind?: "cast" | "location";
  target?: string; // speaker name (cast) or scene id (location)
  action?: "generate" | "approve" | "add";
  customPrompt?: string;
  candidateId?: string;
  /** action "add" only — new speaker name, or new place name. */
  name?: string;
};

/**
 * POST — the human-gated swipe step: generate a fresh batch of candidates
 * for one speaker/scene, or approve a pick. Never auto-advances the phase
 * on its own; the client checks whether every speaker/scene now has an
 * approved candidate and, once so, calls /step to move the phase forward.
 */
export async function POST(req: Request) {
  try {
    if (!imageKeyPresent()) {
      return NextResponse.json(
        { error: "Missing XAI_API_KEY in MY MOVIES\\.env, then restart Studio." },
        { status: 503 },
      );
    }

    const body = (await req.json().catch(() => ({}))) as Body;
    const jobId = (body.jobId || "").trim();
    const kind = body.kind;
    const target = (body.target || "").trim();
    const action = body.action;
    if (!jobId || !kind || !action) {
      return NextResponse.json({ error: "Need jobId, kind, action" }, { status: 400 });
    }
    if (action !== "add" && !target) {
      return NextResponse.json({ error: "Need target" }, { status: 400 });
    }

    const job = await readMobileGenJob(jobId);
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    if (action === "add") {
      const name = (body.name || "").trim();
      if (!name) return NextResponse.json({ error: "Need a name" }, { status: 400 });

      if (kind === "cast") {
        if (job.speakers.some((s) => s.toLowerCase() === name.toLowerCase())) {
          return NextResponse.json({ error: `${name} is already in the cast` }, { status: 400 });
        }
        if (!listCharacters().some((c) => c.name.trim().toLowerCase() === name.toLowerCase())) {
          createCharacter({ name });
        }
        const updated = await patchMobileGenJob(jobId, { speakers: [...job.speakers, name] });
        return NextResponse.json({ ok: true, job: updated });
      }

      // kind === "location"
      if (job.scenes.some((s) => s.placeName.toLowerCase() === name.toLowerCase())) {
        return NextResponse.json({ error: `${name} is already in the locations` }, { status: 400 });
      }
      const sceneId = newId("scene");
      const story = await readMobileStory(job.styleId, job.folderName);
      await writeMobileStory(
        {
          ...story,
          scenes: [
            ...story.scenes,
            { id: sceneId, title: name, placeName: name, worldThumbKey: "", shots: [] },
          ],
        },
        job.folderName,
      );
      const updated = await patchMobileGenJob(jobId, {
        scenes: [...job.scenes, { id: sceneId, placeName: name, worldThumbKey: "" }],
      });
      return NextResponse.json({ ok: true, job: updated });
    }

    if (kind === "cast") {
      let character = listCharacters().find(
        (c) => c.name.trim().toLowerCase() === target.toLowerCase(),
      );
      if (!character && job.roster.length) {
        // A different Vercel instance than the one that created this job's
        // roster is handling this request — its local Character store is
        // empty. Re-create the roster here (idempotent by name) before
        // giving up.
        createCharactersFromScriptRoster(job.roster);
        character = listCharacters().find(
          (c) => c.name.trim().toLowerCase() === target.toLowerCase(),
        );
      }
      if (!character) {
        // job.speakers (what drives "Pick your cast") comes straight from
        // beat.speaker text, not from the parsed roster — the screenplay
        // step can produce a speaker the roster parse missed entirely, not
        // just one lost to a different instance. Last resort: create a
        // bare character from the name so the flow never dead-ends here.
        character = createCharacter({ name: target });
      }

      if (action === "generate") {
        const candidates = await generateCastCandidates(
          job.styleId,
          job.folderName,
          character.id,
          CANDIDATES_PER_BATCH,
          job.prompt,
          body.customPrompt,
          job.styleRealism,
        );
        const updated = await patchMobileGenJob(jobId, {
          castCandidates: { ...job.castCandidates, [target]: candidates },
        });
        return NextResponse.json({ ok: true, job: updated });
      }

      const candidateId = (body.candidateId || "").trim();
      if (!candidateId) return NextResponse.json({ error: "Need candidateId" }, { status: 400 });
      const candidate = (job.castCandidates[target] || []).find((c) => c.id === candidateId);
      if (!candidate) return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
      await approveCastCandidate(job.styleId, job.folderName, character.id, candidateId, candidate.fileName);
      const nextCandidates = (job.castCandidates[target] || []).map((c) => ({
        ...c,
        approved: c.id === candidateId,
      }));
      const updated = await patchMobileGenJob(jobId, {
        castCandidates: { ...job.castCandidates, [target]: nextCandidates },
      });
      return NextResponse.json({ ok: true, job: updated });
    }

    // kind === "location"
    const scene = job.scenes.find((s) => s.id === target);
    if (!scene) return NextResponse.json({ error: `No scene ${target}` }, { status: 404 });

    if (action === "generate") {
      const candidates = await generateLocationCandidates(
        job.styleId,
        job.folderName,
        scene.placeName,
        body.customPrompt,
        CANDIDATES_PER_BATCH,
        job.styleRealism,
      );
      const updated = await patchMobileGenJob(jobId, {
        locationCandidates: { ...job.locationCandidates, [target]: candidates },
      });
      return NextResponse.json({ ok: true, job: updated });
    }

    const candidateId = (body.candidateId || "").trim();
    if (!candidateId) return NextResponse.json({ error: "Need candidateId" }, { status: 400 });
    const thumbKey = await approveLocationCandidate(job.styleId, job.folderName, scene.placeName, candidateId);

    // Patch the real story doc so the plates phase can find it — not just the job doc.
    const story = await readMobileStory(job.styleId, job.folderName);
    const nextScenes = story.scenes.map((sc) =>
      sc.id === target ? { ...sc, worldThumbKey: thumbKey } : sc,
    );
    await writeMobileStory({ ...story, scenes: nextScenes }, job.folderName);

    const nextCandidates = (job.locationCandidates[target] || []).map((c) => ({
      ...c,
      approved: c.id === candidateId,
    }));
    const nextJobScenes = job.scenes.map((s) =>
      s.id === target ? { ...s, worldThumbKey: thumbKey } : s,
    );
    const updated = await patchMobileGenJob(jobId, {
      locationCandidates: { ...job.locationCandidates, [target]: nextCandidates },
      scenes: nextJobScenes,
    });
    return NextResponse.json({ ok: true, job: updated });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
