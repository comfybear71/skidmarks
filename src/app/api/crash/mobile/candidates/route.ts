import { NextResponse } from "next/server";
import { imageKeyPresent } from "@/lib/imageGen";
import {
  approveCastCandidate,
  approveLocationCandidate,
  generateCastCandidates,
  generateLocationCandidates,
} from "@/lib/mobileCandidates";
import { listCharacters } from "@/lib/characters";
import { readCrashStory, writeCrashStory } from "@/lib/crashStory";
import { patchMobileGenJob, readMobileGenJob } from "@/lib/mobileGenJob";

export const runtime = "nodejs";
export const maxDuration = 300;

type Body = {
  jobId?: string;
  kind?: "cast" | "location";
  target?: string; // speaker name (cast) or scene id (location)
  action?: "generate" | "approve";
  customPrompt?: string;
  candidateId?: string;
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
    if (!jobId || !kind || !target || !action) {
      return NextResponse.json({ error: "Need jobId, kind, target, action" }, { status: 400 });
    }

    const job = await readMobileGenJob(jobId);
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    if (kind === "cast") {
      const character = listCharacters().find(
        (c) => c.name.trim().toLowerCase() === target.toLowerCase(),
      );
      if (!character) return NextResponse.json({ error: `No character named ${target}` }, { status: 404 });

      if (action === "generate") {
        const candidates = await generateCastCandidates(character.id);
        const updated = await patchMobileGenJob(jobId, {
          castCandidates: { ...job.castCandidates, [target]: candidates },
        });
        return NextResponse.json({ ok: true, job: updated });
      }

      const candidateId = (body.candidateId || "").trim();
      if (!candidateId) return NextResponse.json({ error: "Need candidateId" }, { status: 400 });
      approveCastCandidate(job.styleId, character.id, candidateId);
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
        scene.placeName,
        body.customPrompt,
      );
      const updated = await patchMobileGenJob(jobId, {
        locationCandidates: { ...job.locationCandidates, [target]: candidates },
      });
      return NextResponse.json({ ok: true, job: updated });
    }

    const candidateId = (body.candidateId || "").trim();
    if (!candidateId) return NextResponse.json({ error: "Need candidateId" }, { status: 400 });
    const thumbKey = approveLocationCandidate(job.styleId, scene.placeName, candidateId);

    // Patch the real story doc so the plates phase can find it — not just the job doc.
    const story = readCrashStory(job.styleId);
    const nextScenes = story.scenes.map((sc) =>
      sc.id === target ? { ...sc, worldThumbKey: thumbKey } : sc,
    );
    writeCrashStory({ ...story, scenes: nextScenes });

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
