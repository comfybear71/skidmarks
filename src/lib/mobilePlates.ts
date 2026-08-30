import fs from "fs";
import path from "path";
import {
  plateCastIntoGen,
  PLATE_FACES_PER_PASS,
} from "./plateCast";
import {
  readStyleCardManifest,
  resolveStyleCardThumbPath,
  type StyleCardThumbLabel,
} from "./styleCardThumbs";
import { resolveWorldCardThumbPath } from "./worldCardThumbs";
import { getShowStylePreset, type ShowStyleId } from "./showStylePresets";
import { CRASH_DIR } from "./paths";
import { cloudListShowFiles, readShowAssetBytes } from "./cloudShelf";
import {
  approvedCandidateFileName,
  cacheJobPlateFile,
  mobileCandidateFolders,
} from "./mobilePlateMedia";
import { candidateLookPrompt, locationStillFileName } from "./mobileJobReady";
import { pickCastCardIndexByName } from "./castCardMatch";
import { plateCastStagingNote, shotSpeakersOnCard } from "./mobilePlateLines";
import type { CrashStoryScene, CrashStoryShot } from "./crashStoryTypes";
import type { MobileGenJob } from "./mobileGenJob";
import { sortableId } from "./types";

/** Pull a show-shelf asset down to a temp file so code that needs a path works
 * the same whether the bytes came from disk or Blob. Keys arrive as "g:name". */
async function cacheShelfAsset(
  styleId: ShowStyleId,
  kind: "world" | "cast",
  key: string,
): Promise<string | null> {
  const fileName = key.startsWith("g:") ? key.slice(2) : key;
  if (!fileName) return null;
  const bytes = await readShowAssetBytes(styleId, kind, fileName).catch(() => null);
  if (!bytes?.length) return null;
  const dir = path.join(CRASH_DIR, "gen");
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, fileName);
  fs.writeFileSync(dest, bytes);
  return dest;
}

/** A character's approved card from the show's cast shelf, matched by name the
 * same way the local manifest is. */
async function cacheShelfCastByName(
  styleId: ShowStyleId,
  name: string,
): Promise<string | null> {
  if (!name.trim()) return null;
  const rows = await cloudListShowFiles(styleId, "cast").catch(() => []);
  const named = rows
    .map((r) => ({ label: (r.label_name || "").trim().toLowerCase(), filename: r.filename }))
    .filter((r) => r.label && r.filename);
  const i = pickCastCardIndexByName(named.map((r) => r.label), name);
  if (i < 0) return null;
  return cacheShelfAsset(styleId, "cast", named[i].filename);
}

function resolveCastKeyByName(
  manifest: Record<string, StyleCardThumbLabel>,
  name: string,
): string | null {
  const entries = Object.entries(manifest);
  const i = pickCastCardIndexByName(
    entries.map(([, meta]) => meta.name || ""),
    name,
  );
  return i < 0 ? null : entries[i][0];
}

function uniqueShotSpeakers(
  shot: CrashStoryShot,
  jobSpeakers: string[] = [],
): string[] {
  return shotSpeakersOnCard({
    shotId: shot.id,
    title: shot.title,
    staging: shot.staging,
    summary: shot.summary,
    plateFile: shot.plateFile,
    jobSpeakers,
    beats: shot.beats,
    castNames: shot.castNames,
  });
}

function hangPlaceAsPlate(bgPath: string): string {
  const ext = path.extname(bgPath) || ".png";
  const fileName = `${sortableId("cplate")}${ext.startsWith(".") ? ext : `.${ext}`}`;
  const dest = path.join(CRASH_DIR, "gen", fileName);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(bgPath, dest);
  return fileName;
}

export type PlateJobRef = Pick<
  MobileGenJob,
  "id" | "folderName" | "castCandidates" | "locationCandidates" | "speakers"
>;

/** Location still for a shot — local gallery, show shelf, then this job's pick. */
export async function resolvePlateBackground(
  styleId: ShowStyleId,
  scene: Pick<CrashStoryScene, "id" | "title" | "placeName" | "worldThumbKey">,
  job?: PlateJobRef,
): Promise<string> {
  const folders = job ? mobileCandidateFolders(job) : [];
  const locationFile = job
    ? locationStillFileName(job.locationCandidates, scene.id)
    : null;

  // The phone already shows the job take (Pick, or the last generate).
  // Read that first. Local galleries and g:place_… are this instance's
  // /tmp — gone on the next Vercel invoke, and not in Blob.
  const bgPath =
    (locationFile ? await cacheJobPlateFile({ styleId, folders, fileName: locationFile }) : null) ||
    (scene.worldThumbKey.trim()
      ? resolveWorldCardThumbPath(styleId, scene.worldThumbKey)
      : null) ||
    (scene.worldThumbKey.trim()
      ? await cacheShelfAsset(styleId, "world", scene.worldThumbKey)
      : null);
  if (!bgPath) {
    if (!scene.worldThumbKey.trim() && !locationFile) {
      throw new Error(`Scene "${scene.title}" has no location still yet`);
    }
    throw new Error(
      `Location image for "${scene.placeName}"${locationFile ? ` (${locationFile})` : ""} not found on disk, the show's world shelf, or this job's place still`,
    );
  }
  return bgPath;
}

/** One face for a speaker — this job's picked still first, then show shelf.
 * A leftover shelf card that merely shares the name must not replace the
 * face he picked (Amitabha's golden Buddha becoming a stranger). */
export async function resolvePlateCastPath(
  styleId: ShowStyleId,
  name: string,
  job?: PlateJobRef,
): Promise<string | null> {
  const folders = job ? mobileCandidateFolders(job) : [];
  const jobFile = job ? approvedCandidateFileName(job.castCandidates, name) : null;
  if (jobFile) {
    const jobPath = await cacheJobPlateFile({ styleId, folders, fileName: jobFile });
    if (jobPath) return jobPath;
    const shelfByFile = await cacheShelfAsset(styleId, "cast", jobFile);
    if (shelfByFile) return shelfByFile;
    // Picked a face on this job — do not swap in a leftover shelf card.
    return null;
  }
  const manifest = readStyleCardManifest(styleId);
  const key = resolveCastKeyByName(manifest, name);
  const localPath = key ? resolveStyleCardThumbPath(styleId, key) : null;
  if (localPath) return localPath;
  return cacheShelfCastByName(styleId, name);
}

/**
 * AI-composite a shot's cast onto its scene's location — the automated
 * mobile pipeline uses plateCastIntoGen (plateCast.ts), the same AI
 * compositor the desktop "gen-plate" route's Path A uses, NOT the manual
 * drag/scale Compositor panel built for desktop review workflows.
 */
export async function compositeShotPlate(
  styleId: ShowStyleId,
  scene: CrashStoryScene,
  shot: CrashStoryShot,
  opts: {
    /** Cast who never speak anywhere in the story. Shots are keyed off
     * dialogue beats, so without this a silent character — the monkey in
     * "a monkey holding hands with Elon Musk" — gets a cast card approved
     * and then never appears in a single plate. */
    silentCast?: string[];
    /** The job's slider. Plates used to fall back to the style preset, so
     * dragging to photoreal changed the cast and location but not the plate
     * they were composited into. */
    styleRealism?: number;
    /** First-job faces/places live under the job id in Blob, not on the
     * show shelf. Approve writes local galleries that vanish on the next
     * Vercel invoke — without this, compositing only sees an empty /tmp. */
    job?: PlateJobRef;
  } = {},
): Promise<string> {
  const bgPath = await resolvePlateBackground(styleId, scene, opts.job);

  const silent = (opts.silentCast || []).map((n) => n.trim()).filter(Boolean);
  const speakers = [
    ...new Set([...uniqueShotSpeakers(shot, opts.job?.speakers || []), ...silent]),
  ];
  if (!speakers.length) {
    // Extra-only scenery (bush turkeys, a crowd) — hang the place still.
    // Shots whose Cast: names series people must have those names on the
    // card already; do not drop Dazza because the spoken Name is a resident.
    return hangPlaceAsPlate(bgPath);
  }

  const manifest = readStyleCardManifest(styleId);
  const resolved: { name: string; path: string }[] = [];
  const missing: string[] = [];
  for (const name of speakers) {
    const p = await resolvePlateCastPath(styleId, name, opts.job);
    if (!p) missing.push(name);
    else resolved.push({ name, path: p });
  }
  if (missing.length) {
    throw new Error(
      `No face still for ${missing.join(", ")} — approve that face or drop them from the shot. Will not plate a partial cast.`,
    );
  }

  const preset = getShowStylePreset(styleId);
  const looks = speakers
    .map((name) => {
      const look = opts.job ? candidateLookPrompt(opts.job.castCandidates, name) : "";
      return look ? `${name} looks like: ${look}` : "";
    })
    .filter(Boolean)
    .join(". ");
  const placeLook = opts.job
    ? candidateLookPrompt(opts.job.locationCandidates, scene.id)
    : "";
  const staging = plateCastStagingNote({
    speakers,
    staging: shot.staging,
    looks,
    placeLook,
    styleId,
  });

  let currentBg = bgPath;
  let chainPass = false;
  let fileName = "";
  const remaining = [...resolved];

  while (remaining.length) {
    const batch = remaining.splice(0, PLATE_FACES_PER_PASS);
    const castFiles: { buf: Buffer; ext: string }[] = [];
    const castNames: string[] = [];
    for (const row of batch) {
      const key = resolveCastKeyByName(manifest, row.name);
      castNames.push((key && manifest[key]?.name) || row.name);
      castFiles.push({
        buf: fs.readFileSync(row.path),
        ext: path.extname(row.path).toLowerCase() || ".png",
      });
    }
    if (!castFiles.length) continue;

    const result = await plateCastIntoGen({
      styleId,
      bgPath: currentBg,
      castFiles,
      castNames,
      placeName: scene.placeName,
      note: staging,
      styleRealism: Number.isFinite(opts.styleRealism)
        ? Math.max(0, Math.min(100, Math.round(opts.styleRealism as number)))
        : preset.defaultRealism,
      chainPass,
      skipMeta: remaining.length > 0, // only register the final composite
    });
    fileName = result.fileName;
    currentBg = path.join(CRASH_DIR, "gen", fileName);
    chainPass = true;
  }

  if (!fileName) {
    throw new Error(
      "No matching cast faces found for this shot — not on disk, the show's cast shelf, or this job's approved picks",
    );
  }
  return fileName;
}
