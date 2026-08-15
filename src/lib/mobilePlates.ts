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
import type { CrashStoryScene, CrashStoryShot } from "./crashStoryTypes";

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
  } = {},
): Promise<string> {
  if (!scene.worldThumbKey.trim()) {
    throw new Error(`Scene "${scene.title}" has no approved location yet`);
  }
  // Local galleries are written by the request that approved the pick, and on
  // Vercel this phase runs on a different invocation with empty /tmp — so the
  // approved location and cast are only reachable from the cloud shelves.
  const bgPath =
    resolveWorldCardThumbPath(styleId, scene.worldThumbKey) ||
    (await cacheShelfAsset(styleId, "world", scene.worldThumbKey));
  if (!bgPath) {
    throw new Error(
      `Location image for "${scene.placeName}" not found on disk or in the show's world shelf`,
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
      // invocation, so fall back to the show's cast shelf by character name.
      const cloudPath = localPath ? null : await cacheShelfCastByName(styleId, name);
      const p = localPath || cloudPath;
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

  if (!fileName) throw new Error("No matching cast faces found for this shot");
  return fileName;
}
