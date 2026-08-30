import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { generateImagineImage, imageKeyPresent } from "@/lib/imageGen";
import { grokVideoConfigured } from "@/lib/grokVideo";
import {
  GROK_IMAGINE_IMAGE_MODEL,
  GROK_IMAGINE_VIDEO_MODEL,
  parseGrokImagineAspect,
  parseGrokImagineImageRes,
} from "@/lib/grokImagine";
import { patchMobileGenJob, readMobileGenJob } from "@/lib/mobileGenJob";
import { readMobileStory, writeMobileStory } from "@/lib/mobileStoryStore";
import { resolveMobileMedia, uploadMobileMedia } from "@/lib/mobileMediaStore";
import { resolveGenOrPackPlate } from "@/lib/crashActivePack";
import { CRASH_DIR } from "@/lib/paths";
import { newId, sortableId } from "@/lib/types";
import type { PlateTake } from "@/lib/crashStoryTypes";
import type { ShowStyleId } from "@/lib/showStylePresets";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * In-house GROK Imagine 2.0 still. Video Send goes through song run.
 * Does not cook LTX. Does not generate until he posts.
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    grok: imageKeyPresent() || grokVideoConfigured(),
    image: imageKeyPresent(),
    video: grokVideoConfigured(),
    imageModel: GROK_IMAGINE_IMAGE_MODEL,
    videoModel: GROK_IMAGINE_VIDEO_MODEL,
  });
}

async function resolvePlatePath(
  job: { styleId: ShowStyleId | string; folderName: string },
  fileName: string,
): Promise<string | null> {
  const name = fileName.trim();
  if (!name) return null;
  return (
    resolveGenOrPackPlate(name) ||
    (await resolveMobileMedia({
      styleId: job.styleId as ShowStyleId,
      folderName: job.folderName,
      kind: "plates",
      fileName: name,
      destPath: path.join(CRASH_DIR, "gen", name),
    }))
  );
}

async function attachDroppedPlate(req: Request) {
  const form = await req.formData();
  const jobId = String(form.get("jobId") || "").trim();
  const shotId = String(form.get("shotId") || "").trim();
  const file = form.get("file");
  if (!jobId || !shotId) {
    return NextResponse.json({ error: "Need jobId and shotId" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Need a plate image" }, { status: 400 });
  }
  const job = await readMobileGenJob(jobId);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  const story = job.folderName ? await readMobileStory(job.styleId, job.folderName) : null;
  if (!story) return NextResponse.json({ error: "Open the pack first." }, { status: 400 });
  const shot = story.scenes.flatMap((sc) => sc.shots).find((sh) => sh.id === shotId);
  if (!shot) return NextResponse.json({ error: "That still is not on this pack." }, { status: 404 });
  const ext = path.extname(file.name || "").toLowerCase() || ".png";
  const safeExt = ext === ".jpg" || ext === ".jpeg" || ext === ".webp" ? ext : ".png";
  const fileName = `${sortableId("gimg")}${safeExt}`;
  const localPath = path.join(CRASH_DIR, "gen", fileName);
  fs.mkdirSync(path.dirname(localPath), { recursive: true });
  fs.writeFileSync(localPath, Buffer.from(await file.arrayBuffer()));
  try {
    await uploadMobileMedia({
      styleId: job.styleId as ShowStyleId,
      folderName: job.folderName,
      kind: "plates",
      localPath,
    });
  } catch {
    /* still usable this request */
  }
  const newTake: PlateTake = {
    id: newId("take"),
    fileName,
    staging: shot.staging || "GROK plate",
    approved: true,
  };
  const plateTakes = [...(shot.plateTakes || []).map((t) => ({ ...t, approved: false })), newTake];
  const nextStory = {
    ...story,
    scenes: story.scenes.map((sc) => ({
      ...sc,
      shots: sc.shots.map((sh) =>
        sh.id === shotId ? { ...sh, plateFile: fileName, plateTakes } : sh,
      ),
    })),
  };
  await writeMobileStory(nextStory, job.folderName);
  const shots = (job.shots || []).map((s) =>
    s.shotId === shotId ? { ...s, plateFile: fileName, error: "" } : s,
  );
  const updated = await patchMobileGenJob(jobId, { shots, error: "" });
  return NextResponse.json({ ok: true, job: updated, fileName, attached: true });
}

export async function POST(req: Request) {
  const ctype = req.headers.get("content-type") || "";
  if (ctype.includes("multipart/form-data")) {
    try {
      return await attachDroppedPlate(req);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : String(e) },
        { status: 500 },
      );
    }
  }
  try {
    const body = (await req.json().catch(() => ({}))) as {
      jobId?: string;
      shotId?: string;
      prompt?: string;
      plateFile?: string;
      aspectRatio?: string;
      resolution?: string;
    };
    const jobId = String(body.jobId || "").trim();
    const shotId = String(body.shotId || "").trim();
    const prompt = String(body.prompt || "").trim();
    if (!jobId || !shotId) {
      return NextResponse.json({ error: "Need jobId and shotId" }, { status: 400 });
    }
    if (!prompt) {
      return NextResponse.json({ error: "Type something to imagine first." }, { status: 400 });
    }
    if (!imageKeyPresent()) {
      return NextResponse.json({ error: "GROK is not on this Studio." }, { status: 400 });
    }

    const job = await readMobileGenJob(jobId);
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    const story = job.folderName ? await readMobileStory(job.styleId, job.folderName) : null;
    if (!story) return NextResponse.json({ error: "Open the pack first." }, { status: 400 });
    const shot = story.scenes.flatMap((sc) => sc.shots).find((sh) => sh.id === shotId);
    if (!shot) return NextResponse.json({ error: "That still is not on this pack." }, { status: 404 });

    const plateFile = String(body.plateFile || shot.plateFile || "").trim();
    const refPath = plateFile ? await resolvePlatePath(job, plateFile) : null;
    const { buffer, ext } = await generateImagineImage({
      prompt,
      referencePaths: refPath ? [refPath] : [],
      aspectRatio: parseGrokImagineAspect(body.aspectRatio),
      resolution: parseGrokImagineImageRes(body.resolution),
    });
    const fileName = `${sortableId("gimg")}${ext || ".png"}`;
    const localPath = path.join(CRASH_DIR, "gen", fileName);
    fs.mkdirSync(path.dirname(localPath), { recursive: true });
    fs.writeFileSync(localPath, buffer);
    try {
      await uploadMobileMedia({
        styleId: job.styleId as ShowStyleId,
        folderName: job.folderName,
        kind: "plates",
        localPath,
      });
    } catch {
      /* still usable this request */
    }

    const newTake: PlateTake = {
      id: newId("take"),
      fileName,
      staging: shot.staging || prompt,
      approved: true,
    };
    const plateTakes = [...(shot.plateTakes || []).map((t) => ({ ...t, approved: false })), newTake];
    const nextStory = {
      ...story,
      scenes: story.scenes.map((sc) => ({
        ...sc,
        shots: sc.shots.map((sh) =>
          sh.id === shotId ? { ...sh, plateFile: fileName, plateTakes } : sh,
        ),
      })),
    };
    await writeMobileStory(nextStory, job.folderName);
    const shots = (job.shots || []).map((s) =>
      s.shotId === shotId ? { ...s, plateFile: fileName, error: "" } : s,
    );
    const updated = await patchMobileGenJob(jobId, { shots, error: "" });
    return NextResponse.json({ ok: true, job: updated, fileName, model: GROK_IMAGINE_IMAGE_MODEL });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
