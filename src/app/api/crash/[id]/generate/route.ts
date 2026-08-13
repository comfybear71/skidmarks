import { NextResponse } from "next/server";
import { getCharacter, faceFilePath } from "@/lib/characters";
import {
  addCrashTake,
  crashAssetPath,
  getCrashJob,
  promptForPreset,
} from "@/lib/crash";
import { generateFaceImage, imageKeyPresent } from "@/lib/imageGen";

export const runtime = "nodejs";
export const maxDuration = 120;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const job = getCrashJob(id);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!imageKeyPresent()) {
    return NextResponse.json(
      { error: "Missing XAI_API_KEY in MY MOVIES\\.env" },
      { status: 503 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as { preset?: string };
  const preset = (body.preset || job.preset) as typeof job.preset;

  const who = job.characterId ? getCharacter(job.characterId) : null;
  const prompt = promptForPreset(preset, who?.name || "Kim");

  const refPaths: string[] = [];
  // Vehicle first. Person cutout you uploaded — NOT Character Lab glam face.
  // rear_only / side_only: bus only (no person glue).
  const vehicle =
    job.vehicleRefs.find((v) => v.id === job.approvedVehicleId) ||
    job.vehicleRefs[0];
  if (vehicle) {
    const vp = crashAssetPath(id, vehicle.fileName);
    if (vp) refPaths.push(vp);
  }
  const person =
    job.personRefs.find((p) => p.id === job.approvedPersonId) ||
    job.personRefs[0] ||
    job.layers.find((l) => l.kind === "person");
  if (
    person?.fileName &&
    preset !== "side_only" &&
    preset !== "rear_only"
  ) {
    const pp = crashAssetPath(id, person.fileName);
    if (pp) refPaths.push(pp);
  }
  // Hell with no person upload: fall back to locked face only if nothing else
  if (
    preset === "hell_smash" &&
    refPaths.length === 0 &&
    who?.approvedFaceId
  ) {
    const face = who.faceAttempts.find((f) => f.id === who.approvedFaceId);
    if (face?.fileName) {
      const fp = faceFilePath(who.id, face.fileName);
      if (fp) refPaths.push(fp);
    }
  }

  try {
    const { buffer, ext } = await generateFaceImage({
      prompt,
      referencePaths: refPaths,
      aspectRatio: "3:2",
    });
    const result = addCrashTake(id, {
      buffer,
      ext: ext.startsWith(".") ? ext : `.${ext}`,
      preset,
      note: preset,
    });
    if (!result)
      return NextResponse.json({ error: "Save failed" }, { status: 500 });
    return NextResponse.json({ job: result.job, take: result.take });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
