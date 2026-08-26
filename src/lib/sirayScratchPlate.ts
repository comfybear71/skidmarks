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
import { shotSpeakersOnCard } from "./mobilePlateLines";
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
import { saveCplateMeta } from "./cplateManifest";
import { buildScratchStillSend, padHasJo, type ScratchStillSend } from "./scratchStillSend";
import { resolveGenOrPackPlate } from "./crashActivePack";

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

/** Siray i2v accepts data URLs but large 2k PNGs can be rejected — downscale for video submit. */
export async function fileToSirayVideoDataUrl(filePath: string): Promise<string> {
  try {
    const sharp = (await import("sharp")).default;
    const buf = await sharp(filePath)
      .rotate()
      .resize({ width: 1280, height: 1280, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 88 })
      .toBuffer();
    return `data:image/jpeg;base64,${buf.toString("base64")}`;
  } catch {
    return fileToDataUrl(filePath);
  }
}

export function buildSirayScratchPrompt(opts: {
  styleId: ShowStyleId;
  styleRealism: number;
  placeName: string;
  speakers: string[];
  looks: string;
  placeLook: string;
  staging: string;
  refineFromStill?: boolean;
  joPhone?: boolean;
}): string {
  const looksByName: Record<string, string> = {};
  for (const name of opts.speakers) {
    const prefix = `${name} looks like: `;
    if (opts.looks.includes(prefix)) {
      const rest = opts.looks.slice(opts.looks.indexOf(prefix) + prefix.length);
      looksByName[name] = rest.split(". ")[0] || rest;
    }
  }
  return buildScratchStillSend({
    styleId: opts.styleId,
    styleRealism: opts.styleRealism,
    placeName: opts.placeName,
    speakers: opts.speakers,
    looksByName,
    placeLook: opts.placeLook,
    staging: opts.staging,
    refineFromStill: Boolean(opts.refineFromStill),
    joPhone: padHasJo(opts.speakers) ? opts.joPhone === true : false,
  }).prompt;
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
    /** Edit the last Draw. False after Clear plate (empty room again). */
    useLastStill?: boolean;
    joPhone?: boolean;
  } = {},
): Promise<{ taskId: string; castNames: string[]; placeName: string; send: ScratchStillSend }> {
  if (!sirayConfigured()) {
    throw new Error("Missing SIRAY_API_KEY — https://console.siray.ai/keys");
  }

  const lastName = (shot.plateFile || "").trim();
  const lastPath =
    opts.useLastStill !== false && lastName && lastName !== "__error__"
      ? resolveGenOrPackPlate(lastName)
      : null;
  const refineFromStill = Boolean(lastPath);
  const bgPath = lastPath || (await resolvePlateBackground(styleId, scene, opts.job));
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
        castNames: shot.castNames,
      }),
      ...silent,
    ]),
  ];
  if (!speakers.length) throw new Error("Shot has no cast to composite");

  const castPaths: string[] = [];
  const castNames: string[] = [];
  const missing: string[] = [];
  for (const name of speakers) {
    const p = await resolvePlateCastPath(styleId, name, opts.job);
    if (!p) {
      missing.push(name);
      continue;
    }
    castPaths.push(p);
    castNames.push(name);
  }
  if (missing.length) {
    throw new Error(
      `No face still for ${missing.join(", ")} — approve that face or drop them from the shot. Will not plate a partial cast.`,
    );
  }
  if (!castPaths.length) {
    throw new Error("No matching cast faces for Siray — approve a face first");
  }

  const preset = getShowStylePreset(styleId);
  const styleRealism = Number.isFinite(opts.styleRealism)
    ? Math.max(0, Math.min(100, Math.round(opts.styleRealism as number)))
    : preset.defaultRealism;
  const looksByName: Record<string, string> = {};
  for (const name of castNames) {
    looksByName[name] = opts.job ? candidateLookPrompt(opts.job.castCandidates, name) : "";
  }
  const placeLook = opts.job ? candidateLookPrompt(opts.job.locationCandidates, scene.id) : "";
  const send = buildScratchStillSend({
    styleId,
    styleRealism,
    placeName: scene.placeName,
    speakers: castNames,
    looksByName,
    placeLook,
    staging: shot.staging || "",
    refineFromStill,
    joPhone: padHasJo(castNames) ? opts.joPhone === true : false,
  });
  const prompt = send.prompt;

  const images = refineFromStill
    ? [fileToDataUrl(bgPath)]
    : [fileToDataUrl(bgPath), ...castPaths.map(fileToDataUrl)];
  const taskId = await siraySubmitImageAsync({
    model: SIRAY_SEEDREAM_45_REF2I_SPICY,
    prompt,
    size: SIRAY_SEEDREAM_45_SIZE,
    images,
  });
  return { taskId, castNames, placeName: scene.placeName, send };
}

export async function submitSirayScratchPlate(
  styleId: ShowStyleId,
  scene: CrashStoryScene,
  shot: CrashStoryShot,
  opts: {
    silentCast?: string[];
    styleRealism?: number;
    job?: PlateJobRef;
    useLastStill?: boolean;
    joPhone?: boolean;
  } = {},
): Promise<{ taskId: string; castNames: string[]; placeName: string; send: ScratchStillSend }> {
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
