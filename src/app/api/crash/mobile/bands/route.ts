import { NextResponse } from "next/server";
import { listCastBands, saveCastBand } from "@/lib/castBands";
import { findReusableCastCards } from "@/lib/mobileCastReuse";
import { syncApprovedCastToShelf } from "@/lib/mobileCandidates";
import { createCharacter, listCharacters } from "@/lib/characters";
import { ensureCharacterPlate } from "@/lib/mobileCharacterPlate";
import {
  mobileCandidateFolders,
  mobileMediaFolder,
  patchMobileGenJob,
  readMobileGenJob,
} from "@/lib/mobileGenJob";
import type { ShowStyleId } from "@/lib/showStylePresets";

export const runtime = "nodejs";

/** GET ?styleId=music_video — saved bands for that show. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const styleId = (url.searchParams.get("styleId") || "") as ShowStyleId;
  if (!styleId) return NextResponse.json({ error: "Need styleId" }, { status: 400 });
  const bands = await listCastBands(styleId);
  return NextResponse.json({ bands });
}

type Body = {
  action?: "save" | "apply";
  /** action "save" */
  styleId?: ShowStyleId;
  name?: string;
  members?: string[];
  /** action "save" (to sync approved faces to the shelf) and "apply" */
  jobId?: string;
};

/**
 * POST — "save" writes the current cast selection as a named band.
 * "apply" adds a saved band's members to a job's CAST in one shot, each
 * pre-approved from that name's existing show-level cast card (same reuse
 * mobileApplyScreenplay does for screenplay-detected speakers) — no fresh
 * generation needed for a face that already exists.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Body;

    if (body.action === "save") {
      const styleId = body.styleId;
      const name = (body.name || "").trim();
      const members = (body.members || []).map((m) => m.trim()).filter(Boolean);
      if (!styleId) return NextResponse.json({ error: "Need styleId" }, { status: 400 });
      if (!name || !members.length) {
        return NextResponse.json(
          { error: "Need a band name and at least one cast member" },
          { status: 400 },
        );
      }

      // Saving a band means "these faces are the definitive cast" — the
      // moment to also make sure every one of them actually made it onto
      // the reusable shelf, not just this one job's local candidate list.
      // Covers faces approved before the shelf-upload fix existed, so a
      // saved band stays reusable without a manual re-pick per member.
      const jobId = (body.jobId || "").trim();
      // Report exactly what happened for every member, not just the ones
      // that made it onto the shelf — "no approved take on this job" and
      // "couldn't resolve the file bytes" are different failures and both
      // need to be visible, not silently folded into a generic skip.
      const noApprovedTake: string[] = [];
      let synced: string[] = [];
      let skipped: string[] = [];
      const platesBuilt: string[] = [];
      const platesFailed: string[] = [];
      if (jobId) {
        const job = await readMobileGenJob(jobId);
        if (!job) {
          return NextResponse.json({ error: `Job ${jobId} not found` }, { status: 404 });
        }
        const approved: Record<string, string> = {};
        const looks: Record<string, string> = {};
        for (const member of members) {
          const take = (job.castCandidates[member] || []).find((c) => c.approved);
          if (take?.fileName) {
            approved[member] = take.fileName;
            // Save the words with the face. A band saved without them puts a
            // picture on the shelf that nothing describes.
            if (take.prompt?.trim()) looks[member] = take.prompt.trim();
          } else noApprovedTake.push(member);
        }
        if (Object.keys(approved).length) {
          const result = await syncApprovedCastToShelf({
            styleId,
            folderName: mobileMediaFolder(job),
            altFolders: mobileCandidateFolders(job),
            approved,
            looks,
          });
          synced = result.synced;
          skipped = result.skipped;
        }

        // Saving a band is also the one moment we know for certain a member
        // has an approved face on THIS job — the reliable trigger to backfill
        // a missing series character plate for members whose plate never got
        // built (existing bands saved before the apply-time build existed, or
        // approved outside the normal picker flow). Skips instantly for
        // anyone who already has one.
        const approvedNames = Object.keys(approved);
        if (approvedNames.length) {
          const plateResults = await Promise.allSettled(
            approvedNames.map((member) => ensureCharacterPlate(job, member)),
          );
          plateResults.forEach((result, i) => {
            const member = approvedNames[i];
            if (result.status === "fulfilled") platesBuilt.push(member);
            else {
              const why = result.reason instanceof Error ? result.reason.message : String(result.reason);
              console.error(`Character plate failed for ${member}: ${why}`);
              platesFailed.push(member);
            }
          });
        }
      }

      await saveCastBand(styleId, name, members);
      const bands = await listCastBands(styleId);
      return NextResponse.json({
        ok: true,
        bands,
        synced,
        skipped,
        noApprovedTake,
        platesBuilt,
        platesFailed,
      });
    }

    if (body.action === "apply") {
      const jobId = (body.jobId || "").trim();
      const name = (body.name || "").trim();
      if (!jobId || !name) {
        return NextResponse.json({ error: "Need jobId and band name" }, { status: 400 });
      }
      const job = await readMobileGenJob(jobId);
      if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

      const bands = await listCastBands(job.styleId);
      const band = bands.find((b) => b.name === name);
      if (!band) return NextResponse.json({ error: `Band "${name}" not found` }, { status: 404 });

      const existingLower = new Set(job.speakers.map((s) => s.toLowerCase()));
      const newMembers = band.members.filter((m) => !existingLower.has(m.toLowerCase()));
      if (!newMembers.length) {
        return NextResponse.json({ ok: true, job, added: [] });
      }

      for (const member of newMembers) {
        if (!listCharacters().some((c) => c.name.trim().toLowerCase() === member.toLowerCase())) {
          createCharacter({ name: member });
        }
      }

      const reusable = await findReusableCastCards(job.styleId, newMembers);
      const castCandidates = { ...job.castCandidates };
      for (const [member, card] of Object.entries(reusable)) {
        castCandidates[member] = [
          {
            id: card.fileName,
            fileName: card.fileName,
            approved: true,
            // Without this the reused member arrives as a face with no words,
            // and every shot re-invents whatever the picture does not pin down.
            prompt: card.look || "",
          },
        ];
      }

      const afterApply = await patchMobileGenJob(jobId, {
        speakers: [...job.speakers, ...newMembers],
        castCandidates,
      });
      if (!afterApply) return NextResponse.json({ error: "Job not found" }, { status: 404 });
      let updated = afterApply;

      // Applying a band reuses each member's shelf photo directly (marked
      // approved without going through the picker's onApprove flow), so the
      // client-side "approve → build the series character plate" trigger
      // never fires for them. Build it here instead — free when the plate
      // already exists (ensureCharacterPlate reuses it), one real generation
      // the first time a reused member has never had a plate made.
      const reusedNames = Object.keys(reusable);
      if (reusedNames.length) {
        const plateResults = await Promise.allSettled(
          reusedNames.map((member) => ensureCharacterPlate(updated, member)),
        );
        const characterPlates = { ...(updated.characterPlates || {}) };
        plateResults.forEach((result, i) => {
          const member = reusedNames[i];
          if (result.status === "fulfilled") {
            characterPlates[member] = { fileName: result.value.filename, status: "done" };
          } else {
            const why = result.reason instanceof Error ? result.reason.message : String(result.reason);
            console.error(`Character plate failed for ${member}: ${why}`);
          }
        });
        updated = (await patchMobileGenJob(jobId, { characterPlates })) || updated;
      }

      return NextResponse.json({ ok: true, job: updated, added: newMembers });
    }

    return NextResponse.json({ error: "Need action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
