import fs from "fs";
import path from "path";
import { CRASH_DIR } from "./paths";
import { retireFile } from "./retire";
import { activePackDir } from "./crashActivePack";
import {
  getStyleCharacterRoster,
  parseCharacterPromptLabel,
  rosterEntryByName,
} from "./styleCharacterRoster";
import {
  DEFAULT_SHOW_STYLE,
  SHOW_STYLE_PRESETS,
  type ShowStyleId,
} from "./showStylePresets";
import { worldCardGalleryDir } from "./worldCardThumbs";

export const STYLE_CARDS_DIR = path.join(CRASH_DIR, "style-cards");
export const STYLE_CARD_DRAFTS_DIR = path.join(STYLE_CARDS_DIR, "_drafts");

export type StyleCardThumbLabel = {
  name: string;
  brief: string;
};

export function styleCardManifestPath(styleId: ShowStyleId): string {
  return path.join(styleCardGalleryDir(styleId), "manifest.json");
}

export function readStyleCardManifest(
  styleId: ShowStyleId,
): Record<string, StyleCardThumbLabel> {
  const p = styleCardManifestPath(styleId);
  if (!fs.existsSync(p)) return {};
  try {
    const raw = JSON.parse(fs.readFileSync(p, "utf8")) as Record<
      string,
      StyleCardThumbLabel
    >;
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

/** Live cast on disk — name → thumb key (PROMPT + populate). */
export function liveCastKeys(styleId: ShowStyleId): Record<string, string> {
  const manifest = readStyleCardManifest(styleId);
  const out: Record<string, string> = {};
  for (const [key, label] of Object.entries(manifest)) {
    const name = label.name?.trim();
    if (name) out[name] = key;
  }
  return out;
}

/** Sorted cast names + look hints from Characters gallery. */
export function liveCastRoster(
  styleId: ShowStyleId,
): { name: string; brief: string }[] {
  const manifest = readStyleCardManifest(styleId);
  return Object.values(manifest)
    .map((l) => ({
      name: l.name?.trim() || "",
      brief: l.brief?.trim() || "",
    }))
    .filter((r) => r.name)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function writeStyleCardManifestLabel(
  styleId: ShowStyleId,
  thumbKey: string,
  label: StyleCardThumbLabel,
): Record<string, StyleCardThumbLabel> {
  ensureStyleCardDirs(styleId);
  const manifest = readStyleCardManifest(styleId);
  manifest[thumbKey] = label;
  fs.writeFileSync(styleCardManifestPath(styleId), JSON.stringify(manifest, null, 2));
  return manifest;
}

/** Drop manifest rows whose PNG is gone — stops ghost cast like "Zuckerberg + podium". */
export function pruneOrphanStyleCardManifest(
  styleId: ShowStyleId,
): Record<string, StyleCardThumbLabel> {
  const manifest = readStyleCardManifest(styleId);
  let changed = false;
  for (const key of Object.keys(manifest)) {
    if (!resolveStyleCardThumbPath(styleId, key)) {
      delete manifest[key];
      changed = true;
    }
  }
  if (changed) {
    ensureStyleCardDirs(styleId);
    fs.writeFileSync(styleCardManifestPath(styleId), JSON.stringify(manifest, null, 2));
  }
  return manifest;
}

/** Location prompts must not land in the cast gallery. */
export function looksLikeWorldPlacePrompt(prompt: string): boolean {
  const p = prompt.toLowerCase();
  return (
    p.includes("empty location") ||
    p.includes("no people") ||
    p.includes("photoreal empty") ||
    p.includes("empty podium") ||
    p.includes("empty place")
  );
}

/** Fill manifest from roster order — names back on every face; fix mismatches in dropdown only. */
export function ensureManifestLabels(styleId: ShowStyleId): void {
  const manifest = readStyleCardManifest(styleId);
  const thumbs = listStyleCardThumbs(styleId);
  const roster = getStyleCharacterRoster(styleId);
  if (!thumbs.length) return;

  const usedNames = new Set(
    Object.values(manifest)
      .map((l) => l.name)
      .filter((n) => n && !/^character$/i.test(n)),
  );
  let rosterIdx = 0;
  let changed = false;

  for (const thumb of thumbs) {
    const cur = manifest[thumb.key];
    // Junk "Character" from comma-prompts — re-parse brief / look line.
    if (cur?.name && /^character$/i.test(cur.name.trim())) {
      const repaired = parseCharacterPromptLabel(cur.brief || "");
      if (repaired.name && !/^character$/i.test(repaired.name)) {
        manifest[thumb.key] = repaired;
        usedNames.add(repaired.name);
        changed = true;
        continue;
      }
    }
    if (cur?.name) continue;
    if (!roster.length) continue;
    while (rosterIdx < roster.length && usedNames.has(roster[rosterIdx].name)) {
      rosterIdx += 1;
    }
    const entry = roster[rosterIdx];
    if (!entry) break;
    manifest[thumb.key] = entry;
    usedNames.add(entry.name);
    rosterIdx += 1;
    changed = true;
  }

  if (changed) {
    ensureStyleCardDirs(styleId);
    fs.writeFileSync(styleCardManifestPath(styleId), JSON.stringify(manifest, null, 2));
  }
}

export function listStyleCardThumbsWithLabels(styleId: ShowStyleId): {
  key: string;
  mtime: number;
  name?: string;
  brief?: string;
}[] {
  pruneOrphanStyleCardManifest(styleId);
  ensureManifestLabels(styleId);
  const manifest = readStyleCardManifest(styleId);
  return listStyleCardThumbs(styleId).map((t) => ({
    ...t,
    name: manifest[t.key]?.name,
    brief: manifest[t.key]?.brief,
  }));
}

export type StyleCardThumbRef = {
  /** Fetch key for /api/crash/style-cards/file?thumb= */
  key: string;
  mtime: number;
};

const IMAGE_EXT = /\.(png|jpe?g|webp)$/i;
const SAFE_NAME = /^[\w.\-]+$/;

/** Skip face-strip thumbs that are the same bytes as a saved world/location plate. */
function worldCardFileSizes(styleId: ShowStyleId): Set<number> {
  const dir = worldCardGalleryDir(styleId);
  const sizes = new Set<number>();
  if (!fs.existsSync(dir)) return sizes;
  for (const f of fs.readdirSync(dir)) {
    if (!IMAGE_EXT.test(f) || f === "manifest.json") continue;
    try {
      sizes.add(fs.statSync(path.join(dir, f)).size);
    } catch {
      /* skip */
    }
  }
  return sizes;
}

/** Per-style gallery — every Save style thumb lands here (append, never replace). */
export function styleCardGalleryDir(styleId: ShowStyleId): string {
  return path.join(STYLE_CARDS_DIR, styleId);
}

export function styleCardDraftDir(styleId: ShowStyleId): string {
  return path.join(STYLE_CARD_DRAFTS_DIR, styleId);
}

/** Legacy single hero PNG — older saves; still listed if present. */
export function styleCardThumbPath(styleId: ShowStyleId): string {
  return path.join(STYLE_CARDS_DIR, `${styleId}.png`);
}

export function ensureStyleCardDirs(styleId: ShowStyleId): void {
  for (const d of [
    STYLE_CARDS_DIR,
    STYLE_CARD_DRAFTS_DIR,
    styleCardGalleryDir(styleId),
    styleCardDraftDir(styleId),
  ]) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  }
}

export function parseStyleCardId(raw: string | null): ShowStyleId | null {
  if (!raw) return null;
  return SHOW_STYLE_PRESETS.some((p) => p.id === raw) ? (raw as ShowStyleId) : null;
}

/** All saved thumbs for a style — oldest first (left → right in the scroll strip). */
export function listStyleCardThumbs(styleId: ShowStyleId): StyleCardThumbRef[] {
  const out: StyleCardThumbRef[] = [];

  const legacyPath = styleCardThumbPath(styleId);
  if (fs.existsSync(legacyPath)) {
    out.push({ key: "legacy", mtime: fs.statSync(legacyPath).mtimeMs });
  }

  const galleryDir = styleCardGalleryDir(styleId);
  if (fs.existsSync(galleryDir)) {
    for (const f of fs.readdirSync(galleryDir)) {
      if (!IMAGE_EXT.test(f) || !SAFE_NAME.test(f)) continue;
      out.push({
        key: `g:${f}`,
        mtime: fs.statSync(path.join(galleryDir, f)).mtimeMs,
      });
    }
  }

  const draftDir = styleCardDraftDir(styleId);
  if (fs.existsSync(draftDir)) {
    for (const f of fs.readdirSync(draftDir)) {
      if (!IMAGE_EXT.test(f) || !SAFE_NAME.test(f)) continue;
      out.push({
        key: `d:${f}`,
        mtime: fs.statSync(path.join(draftDir, f)).mtimeMs,
      });
    }
  }

  out.sort((a, b) => a.mtime - b.mtime);
  return dedupeStyleCardThumbs(out, styleId);
}

/** One slot per unique image — drops legacy/draft copies of the same PNG. */
function dedupeStyleCardThumbs(
  refs: StyleCardThumbRef[],
  styleId: ShowStyleId,
): StyleCardThumbRef[] {
  const kept: StyleCardThumbRef[] = [];
  const seenSizes = new Set<number>();
  const worldSizes = worldCardFileSizes(styleId);

  for (const ref of refs) {
    const filePath = resolveStyleCardThumbPath(styleId, ref.key);
    if (!filePath) continue;
    const size = fs.statSync(filePath).size;
    if (worldSizes.has(size)) continue;
    if (seenSizes.has(size)) continue;
    seenSizes.add(size);
    kept.push(ref);
  }

  return kept;
}

export function resolveStyleCardThumbPath(
  styleId: ShowStyleId,
  key: string,
): string | null {
  if (key === "legacy") {
    const p = styleCardThumbPath(styleId);
    return fs.existsSync(p) ? p : null;
  }
  if (key.startsWith("g:")) {
    const f = key.slice(2);
    if (!SAFE_NAME.test(f)) return null;
    const gallery = path.join(styleCardGalleryDir(styleId), f);
    if (fs.existsSync(gallery)) return gallery;
    // Open pack faces live under images\characters\
    const pack = activePackDir();
    if (pack) {
      const packFace = path.join(pack, "images", "characters", f);
      if (fs.existsSync(packFace)) return packFace;
    }
    return null;
  }
  if (key.startsWith("d:")) {
    const f = key.slice(2);
    if (!SAFE_NAME.test(f)) return null;
    const p = path.join(styleCardDraftDir(styleId), f);
    return fs.existsSync(p) ? p : null;
  }
  return null;
}

export function styleCardHasThumb(styleId: ShowStyleId): boolean {
  return listStyleCardThumbs(styleId).length > 0;
}

function readImageFile(
  filePath: string,
): { buf: Buffer; contentType: string; fileName: string } | null {
  if (!fs.existsSync(filePath)) return null;
  const ext = path.extname(filePath).toLowerCase();
  const contentType =
    ext === ".jpg" || ext === ".jpeg"
      ? "image/jpeg"
      : ext === ".webp"
        ? "image/webp"
        : "image/png";
  return {
    buf: fs.readFileSync(filePath),
    contentType,
    fileName: path.basename(filePath),
  };
}

export function readStyleCardThumbByKey(
  styleId: ShowStyleId,
  key: string,
): { buf: Buffer; contentType: string; fileName: string } | null {
  const filePath = resolveStyleCardThumbPath(styleId, key);
  if (!filePath) return null;
  return readImageFile(filePath);
}

/** Latest thumb — last in the gallery scroll order. */
export function readStyleCardThumb(
  styleId: ShowStyleId,
): { buf: Buffer; contentType: string; fileName: string } | null {
  const refs = listStyleCardThumbs(styleId);
  if (!refs.length) return null;
  return readStyleCardThumbByKey(styleId, refs[refs.length - 1].key);
}

/** Append gen still to style gallery — does not remove earlier thumbs. */
export function saveGenStillAsStyleCard(opts: {
  genFileName: string;
  styleId: ShowStyleId;
  prompt?: string;
}): {
  thumbPath: string;
  thumbKey: string;
  label?: StyleCardThumbLabel;
} {
  if (!/^[\w.\-]+$/.test(opts.genFileName)) {
    throw new Error("Bad gen file name");
  }
  const src = path.join(CRASH_DIR, "gen", opts.genFileName);
  if (!fs.existsSync(src)) {
    throw new Error("Generated file missing — Generate first");
  }
  ensureStyleCardDirs(opts.styleId);
  const thumbName = `thumb_${Date.now()}${path.extname(src) || ".png"}`;
  const dest = path.join(styleCardGalleryDir(opts.styleId), thumbName);
  fs.copyFileSync(src, dest);
  const thumbKey = `g:${thumbName}`;

  let label: StyleCardThumbLabel | undefined;
  const prompt = opts.prompt?.trim();
  if (prompt) {
    const rosterHit = rosterEntryByName(
      opts.styleId,
      parseCharacterPromptLabel(prompt).name,
    );
    label = rosterHit ?? parseCharacterPromptLabel(prompt);
    writeStyleCardManifestLabel(opts.styleId, thumbKey, label);
  }

  return { thumbPath: dest, thumbKey, label };
}

/** Append an uploaded still to the style gallery — same slot as Generate → Add to cast. */
export function saveUploadAsStyleCard(opts: {
  buffer: Buffer;
  ext: string;
  styleId: ShowStyleId;
  name?: string;
  brief?: string;
}): {
  thumbPath: string;
  thumbKey: string;
  label?: StyleCardThumbLabel;
} {
  const ext = opts.ext.toLowerCase();
  if (!/^\.(png|jpe?g|webp)$/.test(ext)) {
    throw new Error("Use PNG, JPG, or WebP");
  }
  ensureStyleCardDirs(opts.styleId);
  const thumbName = `upload_${Date.now()}${ext === ".jpeg" ? ".jpg" : ext}`;
  const dest = path.join(styleCardGalleryDir(opts.styleId), thumbName);
  fs.writeFileSync(dest, opts.buffer);
  const thumbKey = `g:${thumbName}`;

  let label: StyleCardThumbLabel | undefined;
  const name = opts.name?.trim();
  if (name) {
    const brief = opts.brief?.trim();
    label =
      rosterEntryByName(opts.styleId, name) ??
      { name, brief: brief || name };
    writeStyleCardManifestLabel(opts.styleId, thumbKey, label);
  }

  return { thumbPath: dest, thumbKey, label };
}

/** Remove from gallery — PNG moves to retired, not destroyed. */
export function removeStyleCardThumb(
  styleId: ShowStyleId,
  thumbKey: string,
): Record<string, StyleCardThumbLabel> {
  const filePath = resolveStyleCardThumbPath(styleId, thumbKey);
  if (filePath) retireFile(filePath);
  const manifest = readStyleCardManifest(styleId);
  delete manifest[thumbKey];
  ensureStyleCardDirs(styleId);
  fs.writeFileSync(styleCardManifestPath(styleId), JSON.stringify(manifest, null, 2));
  return manifest;
}

export function listStyleCardStatus(): {
  id: ShowStyleId;
  hasThumb: boolean;
  thumbs: {
    key: string;
    mtime: number;
    name?: string;
    brief?: string;
  }[];
}[] {
  return SHOW_STYLE_PRESETS.map((p) => ({
    id: p.id,
    hasThumb: styleCardHasThumb(p.id),
    thumbs: listStyleCardThumbsWithLabels(p.id),
  }));
}

export function defaultStyleCardId(): ShowStyleId {
  return DEFAULT_SHOW_STYLE;
}
