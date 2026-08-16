import { NextResponse } from "next/server";
import { ensureCharacterPlate } from "@/lib/mobileCharacterPlate";
import { patchMobileGenJob, readMobileGenJob } from "@/lib/mobileGenJob";
import { listCharacters } from "@/lib/characters";
import { createCharactersFromScriptRoster } from "@/lib/mobileRoster";

export const runtime = "nodejs";
export const maxDuration = 180;

/**
 * POST { jobId, name } — lock a picked face into a series character plate
 * (front / 3/4 / profile / back). Reuses the show shelf sheet if this
 * character already has one. Does not un-pick the face if generate fails.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { jobId?: string; name?: string };
    const jobId = (body.jobId || "").trim();
    const name = (body.name || "").trim();
    if (!jobId || !name) {
      return NextResponse.json({ error: "Need jobId and name" }, { status: 400 });
    }

    const job = await readMobileGenJob(jobId);
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    const picked = (job.castCandidates[name] || []).some((c) => c.approved);
    if (!picked) {
      return NextResponse.json({ error: `Pick a face for ${name} first` }, { status: 400 });
    }

    const current = job.characterPlates?.[name];
    if (current?.status === "done" && current.fileName) {
      return NextResponse.json({ ok: true, job, reused: true });
    }

    await patchMobileGenJob(jobId, {
      characterPlates: {
        ...(job.characterPlates || {}),
        [name]: { fileName: current?.fileName || "", status: "pending" },
      },
    });

    let character = listCharacters().find(
      (c) => c.name.trim().toLowerCase() === name.toLowerCase(),
    );
    if (!character && job.roster.length) {
      createCharactersFromScriptRoster(job.roster);
      character = listCharacters().find(
        (c) => c.name.trim().toLowerCase() === name.toLowerCase(),
      );
    }

    try {
      const plate = await ensureCharacterPlate(job, name, character?.id);
      const updated = await patchMobileGenJob(jobId, {
        characterPlates: {
          ...(job.characterPlates || {}),
          [name]: { fileName: plate.filename, status: "done" },
        },
      });
      return NextResponse.json({ ok: true, job: updated, plate });
    } catch (e) {
      const why = e instanceof Error ? e.message : String(e);
      const updated = await patchMobileGenJob(jobId, {
        characterPlates: {
          ...(job.characterPlates || {}),
          [name]: { fileName: "", status: "error", error: why },
        },
      });
      return NextResponse.json({ ok: false, job: updated, error: why }, { status: 500 });
    }
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
