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

function uniqueShotSpeakers(shot: CrashStoryShot): string[] {
  return [
    ...new Set(shot.beats.map((b) => b.speaker.trim()).filter(Boolean)),
  ];
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
    job?: Pick<
      MobileGenJob,
      "id" | "folderName" | "castCandidates" | "locationCandidates"
    >;
  } = {},
): Promise<string> {
  const folders = opts.job ? mobileCandidateFolders(opts.job) : [];
  const locationFile = opts.job
    ? approvedCandidateFileName(opts.job.locationCandidates, scene.id)
    : null;

  // Local galleries are written by the request that approved the pick, and on
  // Vercel this phase runs on a different invocation with empty /tmp. The
  // show shelf is only populated for series reuse — a first job's still is
  // the approved candidate under the job id (same file the phone already
  // shows). worldThumbKey (g:place_…) is a local-gallery copy that does
  // not exist in Blob.
  const bgPath =
    (scene.worldThumbKey.trim()
      ? resolveWorldCardThumbPath(styleId, scene.worldThumbKey)
      : null) ||
    (scene.worldThumbKey.trim()
      ? await cacheShelfAsset(styleId, "world", scene.worldThumbKey)
      : null) ||
    (locationFile ? await cacheJobPlateFile({ styleId, folders, fileName: locationFile }) : null);
  if (!bgPath) {
    if (!scene.worldThumbKey.trim() && !locationFile) {
      throw new Error(`Scene "${scene.title}" has no approved location yet`);
    }
    throw new Error(
      `Location image for "${scene.placeName}"${locationFile ? ` (${locationFile})` : ""} not found on disk, the show's world shelf, or this job's approved still`,
    );
  }

  const silent = (opts.silentCast || []).map((n) => n.trim()).filter(Boolean);
  const speakers = [...new Set([...uniqueShotSpeakers(shot), ...silent])];
  if (!speakers.length) throw new Error("Shot has no cast to composite");

  const manifest = readStyleCardManifest(styleId);
  const preset = getShowStylePreset(styleId);
  const staging = shot.staging || shot.summary || shot.title;

  let currentBg = bgPath;
  let chainPass = false;
  let fileName = "";
  const remaining = [...speakers];

  while (remaining.length) {
    const batch = remaining.splice(0, PLATE_FACES_PER_PASS);
    const castFiles: { buf: Buffer; ext: string }[] = [];
    const castNames: string[] = [];
    for (const name of batch) {
      const key = resolveCastKeyByName(manifest, name);
      const localPath = key ? resolveStyleCardThumbPath(styleId, key) : null;
      // Same story as the background: the card was approved on another
      // invocation. Show shelf by name is series reuse; this job's approved
      // candidate is the first-run file (uploaded under the job id).
      const jobFile = opts.job
        ? approvedCandidateFileName(opts.job.castCandidates, name)
        : null;
      const jobPath =
        localPath || !jobFile
          ? null
          : await cacheJobPlateFile({ styleId, folders, fileName: jobFile });
      // Reusable series cards store the shelf filename on the job, not a
      // job-id Blob object — try that name on the cast shelf before a
      // fuzzy name match.
      const shelfByFile =
        localPath || jobPath || !jobFile
          ? null
          : await cacheShelfAsset(styleId, "cast", jobFile);
      const cloudPath =
        localPath || jobPath || shelfByFile
          ? null
          : await cacheShelfCastByName(styleId, name);
      const p = localPath || jobPath || shelfByFile || cloudPath;
      if (!p) continue;
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
      note: [
        staging,
        castNames[0] ? `${castNames[0]} is prominent if this is their line.` : "",
        "Characters physically in the place — contact with furniture/ground, matching light.",
      ]
        .filter(Boolean)
        .join(". "),
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
