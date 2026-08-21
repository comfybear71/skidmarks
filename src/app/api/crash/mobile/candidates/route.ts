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
import { jobHasEpisodePack, mobileMediaFolder, patchMobileGenJob, readMobileGenJob } from "@/lib/mobileGenJob";
import { dropCandidateTake, keepCandidateTakes, latestCandidate } from "@/lib/mobileJobReady";
import {
  castNamesMatch,
  clipsAfterDroppedSpeaker,
  dropSpeakerFromList,
  dropSpeakerFromRecord,
  scrubSpeakerFromStory,
  shotsAfterDroppedSpeaker,
} from "@/lib/mobileDropCast";
import { newId } from "@/lib/types";
import { useCloudStore } from "@/lib/cloudEnv";
import { listWorldCardThumbsWithLabels } from "@/lib/worldCardThumbs";
import { cloudWorldCardStatus } from "@/lib/cloudShelf";
import type { ShowStyleId } from "@/lib/showStylePresets";

async function resolveWorldPlaceLabel(
  styleId: ShowStyleId,
  thumbKey: string,
): Promise<{ key: string; name: string } | null> {
  const key = thumbKey.trim().startsWith("g:")
    ? thumbKey.trim()
    : `g:${thumbKey.trim()}`;
  if (!key || key === "g:") return null;
  const thumbs = useCloudStore()
    ? ((await cloudWorldCardStatus()).find((c) => c.id === styleId)?.thumbs ?? [])
    : listWorldCardThumbsWithLabels(styleId);
  const hit = thumbs.find((t) => t.key === key);
  if (!hit) return null;
  const name =
    (hit.name || "").trim() ||
    key.replace(/^g:/, "").replace(/\.[^.]+$/, "").replace(/_/g, " ");
  return { key, name };
}

// One new still per tap — but the earlier takes stay on the job so More
// cannot throw away the one you wanted.
const CANDIDATES_PER_BATCH = 1;

export const runtime = "nodejs";
export const maxDuration = 300;

type Body = {
  jobId?: string;
  kind?: "cast" | "location";
  target?: string; // speaker name (cast) or scene id (location)
  action?: "generate" | "approve" | "add" | "remove" | "drop";
  customPrompt?: string;
  candidateId?: string;
  /** action "add" only — new speaker name, or new place name. */
  name?: string;
  /** action "add", kind "cast" only — the character's look/appearance. */
  description?: string;
  /** action "add", kind "location" — World gallery thumb (`g:place_….png`). */
  worldThumbKey?: string;
};

/**
 * POST — the human-gated swipe step: generate a fresh batch of candidates
 * for one speaker/scene, or approve a pick. Never auto-advances the phase
 * on its own; the client checks whether every speaker/scene now has an
 * approved candidate and, once so, calls /step to move the phase forward.
 *
 * action "drop" (cast) — remove the whole speaker from this job's CAST.
 * Face files stay in Blob (park). Takes list and speakerVoices entry go.
 * Also strips that name from the story + clip queue so a test CAST
 * (STUBALLS) cannot print on shirts after you never put them on a plate.
 * Already-gone names return 200 — do not 404 "is not in this cast".
 * action "drop" (location) — remove the place from this job's scenes.
 * Still files stay in Blob (park). locationCandidates entry goes.
 */
export async function POST(req: Request) {
  try {
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
    // Add a name does not generate an image. Only generate needs the key.
    if (action === "generate" && !imageKeyPresent()) {
      return NextResponse.json(
        { error: "Missing XAI_API_KEY in MY MOVIES\\.env, then restart Studio." },
        { status: 503 },
      );
    }

    const job = await readMobileGenJob(jobId);
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    if (action === "add") {
      const name = (body.name || "").trim();
      const worldIn = (body.worldThumbKey || "").trim();
      if (!name && !(kind === "location" && worldIn)) {
        return NextResponse.json({ error: "Need a name" }, { status: 400 });
      }

      if (kind === "cast") {
        if (job.speakers.some((s) => s.toLowerCase() === name.toLowerCase())) {
          return NextResponse.json({ error: `${name} is already in the cast` }, { status: 400 });
        }
        const description = (body.description || "").trim();
        if (!listCharacters().some((c) => c.name.trim().toLowerCase() === name.toLowerCase())) {
          createCharacter({ name, lookNote: description, pastNote: description });
        }
        const updated = await patchMobileGenJob(jobId, { speakers: [...job.speakers, name] });
        return NextResponse.json({ ok: true, job: updated });
      }

      // kind === "location"
      let worldThumbKey = "";
      let placeName = name;
      if (worldIn) {
        const world = await resolveWorldPlaceLabel(job.styleId, worldIn);
        if (!world) {
          return NextResponse.json(
            { error: "That World gallery place is not on this show" },
            { status: 404 },
          );
        }
        worldThumbKey = world.key;
        if (!placeName.trim()) placeName = world.name;
        if (job.scenes.some((s) => s.worldThumbKey === worldThumbKey)) {
          return NextResponse.json(
            { error: `${placeName} is already in the locations` },
            { status: 400 },
          );
        }
      }
      if (job.scenes.some((s) => s.placeName.toLowerCase() === placeName.toLowerCase())) {
        return NextResponse.json({ error: `${placeName} is already in the locations` }, { status: 400 });
      }
      const sceneId = newId("scene");
      // No episode pack exists yet during location_build (folderName is
      // still empty — the screenplay hasn't run) — nothing to sync a story
      // doc against. job.scenes' own worldThumbKey is the source of truth
      // until the screenplay reconciliation step carries it into the real
      // story once a pack exists. job id is only a media shelf, not a pack.
      if (jobHasEpisodePack(job)) {
        const story = await readMobileStory(job.styleId, job.folderName);
        await writeMobileStory(
          {
            ...story,
            scenes: [
              ...story.scenes,
              {
                id: sceneId,
                title: placeName,
                placeName,
                worldThumbKey,
                shots: [],
              },
            ],
          },
          job.folderName,
        );
      }
      const updated = await patchMobileGenJob(jobId, {
        scenes: [...job.scenes, { id: sceneId, placeName, worldThumbKey }],
      });
      return NextResponse.json({ ok: true, job: updated });
    }

    if (kind === "cast") {
      if (action === "drop") {
        const who = target.trim();
        if (!who) return NextResponse.json({ error: "Need a cast name" }, { status: 400 });
        let removedShotIds: string[] = [];
        let removedBeatIds: string[] = [];
        if (jobHasEpisodePack(job)) {
          const story = await readMobileStory(job.styleId, job.folderName);
          const scrubbed = scrubSpeakerFromStory(story, who);
          removedShotIds = scrubbed.removedShotIds;
          removedBeatIds = scrubbed.removedBeatIds;
          await writeMobileStory(scrubbed.story, job.folderName);
        }
        const roster = (job.roster || []).filter(
          (row) => !castNamesMatch(row.name || "", who),
        );
        const updated = await patchMobileGenJob(jobId, {
          speakers: dropSpeakerFromList(job.speakers, who),
          castCandidates: dropSpeakerFromRecord(job.castCandidates, who),
          speakerVoices: dropSpeakerFromRecord(job.speakerVoices, who),
          characterPlates: dropSpeakerFromRecord(job.characterPlates, who),
          roster,
          shots: shotsAfterDroppedSpeaker(job.shots || [], removedShotIds),
          clips: clipsAfterDroppedSpeaker({
            clips: job.clips || [],
            name: who,
            removedShotIds,
            removedBeatIds,
          }),
          error: "",
        });
        return NextResponse.json({ ok: true, job: updated });
      }

      if (action === "remove") {
        const candidateId = (body.candidateId || "").trim();
        if (!candidateId) return NextResponse.json({ error: "Need candidateId" }, { status: 400 });
        const updated = await patchMobileGenJob(jobId, {
          castCandidates: {
            ...job.castCandidates,
            [target]: dropCandidateTake(job.castCandidates[target], candidateId),
          },
        });
        return NextResponse.json({ ok: true, job: updated });
      }

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
        const prior = latestCandidate(job.castCandidates[target]);
        const candidates = await generateCastCandidates(
          job.styleId,
          mobileMediaFolder(job),
          character.id,
          CANDIDATES_PER_BATCH,
          job.prompt,
          body.customPrompt,
          job.styleRealism,
          prior?.fileName,
          prior?.prompt,
        );
        const updated = await patchMobileGenJob(jobId, {
          castCandidates: {
            ...job.castCandidates,
            [target]: keepCandidateTakes(job.castCandidates[target], candidates),
          },
        });
        return NextResponse.json({ ok: true, job: updated });
      }

      const candidateId = (body.candidateId || "").trim();
      if (!candidateId) return NextResponse.json({ error: "Need candidateId" }, { status: 400 });
      const candidate = (job.castCandidates[target] || []).find((c) => c.id === candidateId);
      if (!candidate) return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
      await approveCastCandidate(job.styleId, mobileMediaFolder(job), character.id, candidateId, candidate.fileName);
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
    if (action === "drop") {
      const sceneId = target.trim();
      if (!sceneId) return NextResponse.json({ error: "Need a location id" }, { status: 400 });
      const scene = job.scenes.find((s) => s.id === sceneId);
      if (!scene) return NextResponse.json({ error: `No scene ${sceneId}` }, { status: 404 });
      const scenes = job.scenes.filter((s) => s.id !== sceneId);
      const locationCandidates = { ...job.locationCandidates };
      delete locationCandidates[sceneId];
      if (jobHasEpisodePack(job)) {
        const story = await readMobileStory(job.styleId, job.folderName);
        await writeMobileStory(
          {
            ...story,
            scenes: story.scenes.filter((s) => s.id !== sceneId),
          },
          job.folderName,
        );
      }
      const updated = await patchMobileGenJob(jobId, {
        scenes,
        locationCandidates,
        error: "",
      });
      return NextResponse.json({ ok: true, job: updated });
    }

    if (action === "remove") {
      const candidateId = (body.candidateId || "").trim();
      if (!candidateId) return NextResponse.json({ error: "Need candidateId" }, { status: 400 });
      const updated = await patchMobileGenJob(jobId, {
        locationCandidates: {
          ...job.locationCandidates,
          [target]: dropCandidateTake(job.locationCandidates[target], candidateId),
        },
      });
      return NextResponse.json({ ok: true, job: updated });
    }

    const scene = job.scenes.find((s) => s.id === target);
    if (!scene) return NextResponse.json({ error: `No scene ${target}` }, { status: 404 });

    if (action === "generate") {
      const prior = latestCandidate(job.locationCandidates[target]);
      const candidates = await generateLocationCandidates(
        job.styleId,
        mobileMediaFolder(job),
        scene.placeName,
        body.customPrompt,
        CANDIDATES_PER_BATCH,
        job.styleRealism,
        prior?.fileName,
        prior?.prompt,
      );
      const updated = await patchMobileGenJob(jobId, {
        locationCandidates: {
          ...job.locationCandidates,
          [target]: keepCandidateTakes(job.locationCandidates[target], candidates),
        },
      });
      return NextResponse.json({ ok: true, job: updated });
    }

    const candidateId = (body.candidateId || "").trim();
    if (!candidateId) return NextResponse.json({ error: "Need candidateId" }, { status: 400 });
    const thumbKey = await approveLocationCandidate(job.styleId, mobileMediaFolder(job), scene.placeName, candidateId);

    // Patch the real story doc so the plates phase can find it — not just the
    // job doc. Nothing to patch yet during location_build (no pack, no
    // story); the screenplay reconciliation step carries job.scenes'
    // worldThumbKey into the real story once one exists.
    if (jobHasEpisodePack(job)) {
      const story = await readMobileStory(job.styleId, job.folderName);
      const nextScenes = story.scenes.map((sc) =>
        sc.id === target ? { ...sc, worldThumbKey: thumbKey } : sc,
      );
      await writeMobileStory({ ...story, scenes: nextScenes }, job.folderName);
    }

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
