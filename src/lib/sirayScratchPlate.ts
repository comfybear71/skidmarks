/**
 * Scratch pad plates via Siray Seedream 4.5 ref2i Spicy.
 * Place still + face cards as references; position prompt drives the draw.
 */

import fs from "fs";
import path from "path";
import { CRASH_DIR } from "./paths";
import { sortableId } from "./types";
import { getShowStylePreset, type ShowStyleId } from "./showStylePresets";
import { candidateLookPrompt } from "./mobileJobReady";
import { plateCastStagingNote, shotSpeakersOnCard } from "./mobilePlateLines";
import {
  compositeShotPlate,
  resolvePlateBackground,
  resolvePlateCastPath,
  type PlateJobRef,
} from "./mobilePlates";
import type { CrashStoryScene, CrashStoryShot } from "./crashStoryTypes";
import { isScratchShotTitle } from "./mobileScratch";
import {
  SIRAY_SEEDREAM_45_REF2I_SPICY,
  SIRAY_SEEDREAM_45_SIZE,
  sirayConfigured,
  sirayDownloadUrl,
  sirayPollImageTask,
  siraySubmitImageAsync,
  sirayWaitImageOutputs,
} from "./sirayClient";
import { buildCrashGenLook } from "./imageGen";
import { saveCplateMeta } from "./cplateManifest";
import { scratchWantsNude, scratchNudeStillLock, SCRATCH_SINGLE_FRAME_LOCK } from "./sirayI2v";

function genDir() {
  const d = path.join(CRASH_DIR, "gen");
  fs.mkdirSync(d, { recursive: true });
  return d;
}

export function fileToDataUrl(filePath: string): string {
  const buf = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mime =
    ext === ".jpg" || ext === ".jpeg"
      ? "image/jpeg"
      : ext === ".webp"
        ? "image/webp"
        : "image/png";
  return `data:${mime};base64,${buf.toString("base64")}`;
}

export function buildSirayScratchPrompt(opts: {
  styleId: ShowStyleId;
  styleRealism: number;
  placeName: string;
  speakers: string[];
  looks: string;
  placeLook: string;
  staging: string;
}): string {
  const look = buildCrashGenLook(opts.styleId, opts.styleRealism);
  const n = opts.speakers.length;
  const nudeText = `${opts.staging} ${opts.looks}`;
  const nude = scratchWantsNude(nudeText);
  const who =
    n === 1
      ? `Image 2 is ${opts.speakers[0]} — same face, hair, age and body. Place them IN image 1. One person only. One photograph.`
      : `Images 2–${n + 1} are ${opts.speakers.join(", ")} — one identity each. Put all of them INTO image 1 as people in that room. Match each face. Never merge faces. Exactly ${n} people. Not a panel per person.`;
  const looks = nude
    ? "Looks: identity only — same face, hair, age, skin and body. Ignore clothes on the face cards."
    : opts.looks
      ? `Looks: ${opts.looks}`
      : "";
  return [
    look,
    "Image 1 is the LOCKED place — keep that exact location, lighting and materials. Do not replace the place.",
    SCRATCH_SINGLE_FRAME_LOCK,
    who,
    nude ? scratchNudeStillLock(nudeText, opts.speakers) : "",
    nude && n > 1
      ? "Only undress who the staging names as nude. Everyone else keeps their clothes. No floating name labels."
      : "",
    looks,
    opts.placeLook ? `Place look: ${opts.placeLook}` : "",
    opts.staging
      ? `Staging / position: ${opts.staging}`
      : `Staging: ${opts.speakers.join(" and ")} naturally in ${opts.placeName || "this place"}.`,
    "No writing, no signage text, no captions, no watermarks.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Draw a Scratch (or any) plate on Siray when the key is set.
 * Falls back to the existing XAI compositor if Siray is off or throws
 * when allowFallback is true.
 */
export type ScratchPlateBackend = "siray-spicy" | "xai";

export async function compositeShotPlatePreferSiray(
  styleId: ShowStyleId,
  scene: CrashStoryScene,
  shot: CrashStoryShot,
  opts: {
    silentCast?: string[];
    styleRealism?: number;
    job?: PlateJobRef;
    /** Force Siray even for non-scratch shots. */
    forceSiray?: boolean;
    /** If Siray fails, use XAI plateCastIntoGen. Default true. */
    allowFallback?: boolean;
  } = {},
): Promise<{ fileName: string; backend: ScratchPlateBackend }> {
  const scratch = isScratchShotTitle(shot.title);
  const wantSiray = sirayConfigured() && (opts.forceSiray || scratch);
  if (!wantSiray) {
    const fileName = await compositeShotPlate(styleId, scene, shot, opts);
    return { fileName, backend: "xai" };
  }

  try {
    const fileName = await compositeShotPlateSiray(styleId, scene, shot, opts);
    return { fileName, backend: "siray-spicy" };
  } catch (e) {
    if (opts.allowFallback === false) throw e;
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[siray] Scratch plate failed, falling back to XAI: ${msg}`);
    const fileName = await compositeShotPlate(styleId, scene, shot, opts);
    return { fileName, backend: "xai" };
  }
}

async function startSirayScratchPlate(
  styleId: ShowStyleId,
  scene: CrashStoryScene,
  shot: CrashStoryShot,
  opts: {
    silentCast?: string[];
    styleRealism?: number;
    job?: PlateJobRef;
  } = {},
): Promise<{ taskId: string; castNames: string[]; placeName: string }> {
  if (!sirayConfigured()) {
    throw new Error("Missing SIRAY_API_KEY — https://console.siray.ai/keys");
  }

  const bgPath = await resolvePlateBackground(styleId, scene, opts.job);
  const silent = (opts.silentCast || []).map((n) => n.trim()).filter(Boolean);
  const speakers = [
    ...new Set([
      ...shotSpeakersOnCard({
        shotId: shot.id,
        title: shot.title,
        staging: shot.staging,
        summary: shot.summary,
        plateFile: shot.plateFile,
        jobSpeakers: opts.job?.speakers || [],
        beats: shot.beats,
      }),
      ...silent,
    ]),
  ];
  if (!speakers.length) throw new Error("Shot has no cast to composite");

  const castPaths: string[] = [];
  const castNames: string[] = [];
  for (const name of speakers) {
    const p = await resolvePlateCastPath(styleId, name, opts.job);
    if (!p) continue;
    castPaths.push(p);
    castNames.push(name);
  }
  if (!castPaths.length) {
    throw new Error("No matching cast faces for Siray — approve a face first");
  }

  const preset = getShowStylePreset(styleId);
  const styleRealism = Number.isFinite(opts.styleRealism)
    ? Math.max(0, Math.min(100, Math.round(opts.styleRealism as number)))
    : preset.defaultRealism;
  const looks = castNames
    .map((name) => {
      const look = opts.job ? candidateLookPrompt(opts.job.castCandidates, name) : "";
      return look ? `${name} looks like: ${look}` : "";
    })
    .filter(Boolean)
    .join(". ");
  const placeLook = opts.job ? candidateLookPrompt(opts.job.locationCandidates, scene.id) : "";
  const staging = plateCastStagingNote({
    speakers: castNames,
    staging: shot.staging,
    looks,
    placeLook,
  });

  const prompt = buildSirayScratchPrompt({
    styleId,
    styleRealism,
    placeName: scene.placeName,
    speakers: castNames,
    looks,
    placeLook,
    staging,
  });

  const images = [fileToDataUrl(bgPath), ...castPaths.map(fileToDataUrl)];
  const taskId = await siraySubmitImageAsync({
    model: SIRAY_SEEDREAM_45_REF2I_SPICY,
    prompt,
    size: SIRAY_SEEDREAM_45_SIZE,
    images,
  });
  return { taskId, castNames, placeName: scene.placeName };
}

export async function submitSirayScratchPlate(
  styleId: ShowStyleId,
  scene: CrashStoryScene,
  shot: CrashStoryShot,
  opts: {
    silentCast?: string[];
    styleRealism?: number;
    job?: PlateJobRef;
  } = {},
): Promise<{ taskId: string; castNames: string[]; placeName: string }> {
  return startSirayScratchPlate(styleId, scene, shot, opts);
}

/** One poll. `null` = still cooking. */
export async function finishSirayScratchPlate(opts: {
  taskId: string;
  styleId: ShowStyleId;
  castNames: string[];
  placeName: string;
}): Promise<string | null> {
  const tick = await sirayPollImageTask(opts.taskId);
  if (tick.status === "FAILURE") {
    throw new Error(tick.failReason || "Siray generation failed");
  }
  if (tick.status !== "SUCCESS") return null;
  if (!tick.outputs.length) throw new Error("Siray SUCCESS but no output URLs");
  const buffer = await sirayDownloadUrl(tick.outputs[0]);
  const fileName = `${sortableId("cplate")}.png`;
  fs.writeFileSync(path.join(genDir(), fileName), buffer);
  saveCplateMeta({
    fileName,
    styleId: opts.styleId,
    castNames: opts.castNames,
    placeName: opts.placeName,
    people: opts.castNames.length,
  });
  return fileName;
}

export async function compositeShotPlateSiray(
  styleId: ShowStyleId,
  scene: CrashStoryScene,
  shot: CrashStoryShot,
  opts: {
    silentCast?: string[];
    styleRealism?: number;
    job?: PlateJobRef;
  } = {},
): Promise<string> {
  const started = await startSirayScratchPlate(styleId, scene, shot, opts);
  const urls = await sirayWaitImageOutputs(started.taskId);
  const buffer = await sirayDownloadUrl(urls[0]);
  const fileName = `${sortableId("cplate")}.png`;
  fs.writeFileSync(path.join(genDir(), fileName), buffer);
  saveCplateMeta({
    fileName,
    styleId,
    castNames: started.castNames,
    placeName: started.placeName,
    people: started.castNames.length,
  });
  return fileName;
}
