import { NextResponse } from "next/server";
import {
  importUploadedCastCandidate,
  importUploadedLocationCandidate,
} from "@/lib/mobileCandidates";
import { createCharacter, listCharacters } from "@/lib/characters";
import { createCharactersFromScriptRoster } from "@/lib/mobileRoster";
import { keepCandidateTakes } from "@/lib/mobileJobReady";
import { mobileMediaFolder, patchMobileGenJob, readMobileGenJob } from "@/lib/mobileGenJob";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 12 * 1024 * 1024;

/**
 * POST multipart: jobId, kind, target, file — drop a photo back onto a
 * cast or location take list. Does not generate. Does not delete earlier
 * stills. Same append as More, so Undo / the take strip can find it.
 */
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const jobId = String(form.get("jobId") || "").trim();
    const kind = String(form.get("kind") || "").trim();
    const target = String(form.get("target") || "").trim();
    const file = form.get("file");
    if (!jobId || (kind !== "cast" && kind !== "location") || !target) {
      return NextResponse.json({ error: "Need jobId, kind, target" }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Need a photo" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "That photo is too large" }, { status: 400 });
    }

    const job = await readMobileGenJob(jobId);
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const mime = file.type || "";
    const name = file.name || "drop.png";
    if (
      /heic|heif/i.test(mime) ||
      /\.(heic|heif)$/i.test(name)
    ) {
      return NextResponse.json(
        {
          error:
            "That iPhone photo is HEIC — it won't show. In Photos, share it as JPEG, then add that.",
        },
        { status: 400 },
      );
    }

    if (kind === "cast") {
      let character = listCharacters().find(
        (c) => c.name.trim().toLowerCase() === target.toLowerCase(),
      );
      if (!character && job.roster.length) {
        createCharactersFromScriptRoster(job.roster);
        character = listCharacters().find(
          (c) => c.name.trim().toLowerCase() === target.toLowerCase(),
        );
      }
      if (!character) character = createCharacter({ name: target });
      const incoming = await importUploadedCastCandidate(
        job.styleId,
        mobileMediaFolder(job),
        character.id,
        buffer,
        name,
        mime,
      );
      const updated = await patchMobileGenJob(jobId, {
        castCandidates: {
          ...job.castCandidates,
          [target]: keepCandidateTakes(job.castCandidates[target], [incoming]),
        },
      });
      return NextResponse.json({ ok: true, job: updated });
    }

    const scene = job.scenes.find((s) => s.id === target);
    if (!scene) return NextResponse.json({ error: `No scene ${target}` }, { status: 404 });
    const incoming = await importUploadedLocationCandidate(
      job.styleId,
      mobileMediaFolder(job),
      buffer,
      name,
      mime,
    );
    const updated = await patchMobileGenJob(jobId, {
      locationCandidates: {
        ...job.locationCandidates,
        [target]: keepCandidateTakes(job.locationCandidates[target], [incoming]),
      },
    });
    return NextResponse.json({ ok: true, job: updated });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
