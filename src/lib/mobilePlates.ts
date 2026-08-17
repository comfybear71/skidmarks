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
import { candidateLookPrompt } from "./mobileJobReady";
import { plateCastStagingNote, shotSpeakersOnCard } from "./mobilePlateLines";
import type { CrashStoryScene, CrashStoryShot } from "./crashStoryTypes";
import type { MobileGenJob } from "./mobileGenJob";

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
  const wanted = name.trim().toLowerCase();
  if (!wanted) return null;
  const rows = await cloudListShowFiles(styleId, "cast").catch(() => []);
  const named = rows
    .map((r) => ({ label: (r.label_name || "").trim().toLowerCase(), filename: r.filename }))
    .filter((r) => r.label && r.filename);
  const hit =
    named.find((r) => r.label === wanted) ||
    named.find((r) => r.label.includes(wanted) || wanted.includes(r.label));
  if (!hit) return null;
  return cacheShelfAsset(styleId, "cast", hit.filename);
}

function resolveCastKeyByName(
  manifest: Record<string, StyleCardThumbLabel>,
  name: string,
): string | null {
  const lower = name.trim().toLowerCase();
  if (!lower) return null;
  for (const [key, meta] of Object.entries(manifest)) {
    const n = (meta.name || "").trim().toLowerCase();
    if (n === lower) return key;
  }
  for (const [key, meta] of Object.entries(manifest)) {
    const n = (meta.name || "").trim().toLowerCase();
    if (n && (n.includes(lower) || lower.includes(n))) return key;
  }
  return null;
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
  });
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
    ? approvedCandidateFileName(job.locationCandidates, scene.id)
    : null;

  // This job's approved still first. worldThumbKey (g:place_…) is a copy
  // that used to land in the shared WORLD gallery — missing on Vercel, and
  // the wrong person's tiles when two accounts share a machine.
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
      throw new Error(`Scene "${scene.title}" has no approved location yet`);
    }
    throw new Error(
      `Location image for "${scene.placeName}"${locationFile ? ` (${locationFile})` : ""} not found on disk, the show's world shelf, or this job's approved still`,
    );
  }
  return bgPath;
}

/** One face for a speaker — local gallery, job pick, then show shelf. */
export async function resolvePlateCastPath(
  styleId: ShowStyleId,
  name: string,
  job?: PlateJobRef,
): Promise<string | null> {
  const folders = job ? mobileCandidateFolders(job) : [];
  const manifest = readStyleCardManifest(styleId);
  const key = resolveCastKeyByName(manifest, name);
  const localPath = key ? resolveStyleCardThumbPath(styleId, key) : null;
  const jobFile = job ? approvedCandidateFileName(job.castCandidates, name) : null;
  const jobPath =
    localPath || !jobFile
      ? null
      : await cacheJobPlateFile({ styleId, folders, fileName: jobFile });
  const shelfByFile =
    localPath || jobPath || !jobFile
      ? null
      : await cacheShelfAsset(styleId, "cast", jobFile);
  const cloudPath =
    localPath || jobPath || shelfByFile
      ? null
      : await cacheShelfCastByName(styleId, name);
  return localPath || jobPath || shelfByFile || cloudPath;
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
  if (!speakers.length) throw new Error("Shot has no cast to composite");

  const manifest = readStyleCardManifest(styleId);
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
  });

  let currentBg = bgPath;
  let chainPass = false;
  let fileName = "";
  const remaining = [...speakers];

  while (remaining.length) {
    const batch = remaining.splice(0, PLATE_FACES_PER_PASS);
    const castFiles: { buf: Buffer; ext: string }[] = [];
    const castNames: string[] = [];
    for (const name of batch) {
      const p = await resolvePlateCastPath(styleId, name, opts.job);
      if (!p) continue;
      const key = resolveCastKeyByName(manifest, name);
      castNames.push((key && manifest[key]?.name) || name);
      castFiles.push({ buf: fs.readFileSync(p), ext: path.extname(p).toLowerCase() || ".png" });
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
