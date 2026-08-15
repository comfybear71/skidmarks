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
import type { CrashStoryScene, CrashStoryShot } from "./crashStoryTypes";

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
  const bgPath = resolveWorldCardThumbPath(styleId, scene.worldThumbKey);
  if (!bgPath) throw new Error("Location image missing on disk");

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
      if (!key) continue;
      const p = resolveStyleCardThumbPath(styleId, key);
      if (!p) continue;
      castNames.push(manifest[key]?.name || name);
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
