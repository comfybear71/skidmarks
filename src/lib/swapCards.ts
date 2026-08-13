import fs from "fs";
import path from "path";
import { formatCplateDisplayName, readCplateManifest } from "@/lib/cplateManifest";
import type { ShowStyleId } from "./showStylePresets";
import { CRASH_DIR } from "./paths";
import { resolveStyleCardThumbPath } from "./styleCardThumbs";
import { resolveWorldCardThumbPath } from "./worldCardThumbs";

export const SWAP_DIR = path.join(CRASH_DIR, "swap");

export type SwapTargetRef =
  | { kind: "world"; styleId: ShowStyleId; thumbKey: string }
  | { kind: "gen"; fileName: string }
  | { kind: "upload"; fileName: string };

export type SwapResultLabel = {
  castKey: string;
  castName: string;
  sourceKey: string;
  target: SwapTargetRef;
  resultFile: string;
  engine?: string;
  locked: boolean;
};

export function swapGalleryDir(styleId: ShowStyleId): string {
  return path.join(SWAP_DIR, styleId);
}

export function swapTargetsDir(styleId: ShowStyleId): string {
  return path.join(swapGalleryDir(styleId), "targets");
}

export function swapManifestPath(styleId: ShowStyleId): string {
  return path.join(swapGalleryDir(styleId), "manifest.json");
}

export function ensureSwapDirs(styleId: ShowStyleId): void {
  for (const d of [SWAP_DIR, swapGalleryDir(styleId), swapTargetsDir(styleId)]) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  }
}

export function readSwapManifest(styleId: ShowStyleId): Record<string, SwapResultLabel> {
  const p = swapManifestPath(styleId);
  if (!fs.existsSync(p)) return {};
  try {
    const raw = JSON.parse(fs.readFileSync(p, "utf8")) as Record<string, SwapResultLabel>;
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

export function writeSwapManifest(styleId: ShowStyleId, manifest: Record<string, SwapResultLabel>): void {
  ensureSwapDirs(styleId);
  fs.writeFileSync(swapManifestPath(styleId), JSON.stringify(manifest, null, 2));
}

export function resolveSwapTargetPath(
  styleId: ShowStyleId,
  target: SwapTargetRef,
): string | null {
  if (target.kind === "world") {
    return resolveWorldCardThumbPath(target.styleId, target.thumbKey);
  }
  if (target.kind === "gen") {
    const f = target.fileName;
    if (!/^[\w.\-]+$/.test(f)) return null;
    const p = path.join(CRASH_DIR, "gen", f);
    return fs.existsSync(p) ? p : null;
  }
  if (target.kind === "upload") {
    const f = target.fileName;
    if (!/^[\w.\-]+$/.test(f)) return null;
    const p = path.join(swapTargetsDir(styleId), f);
    return fs.existsSync(p) ? p : null;
  }
  return null;
}

export function targetRefKey(target: SwapTargetRef): string {
  if (target.kind === "gen") return `gen:${target.fileName}`;
  if (target.kind === "world") return `world:${target.styleId}:${target.thumbKey}`;
  return `upload:${target.fileName}`;
}

/** Use prior swap results on the same target so multi-person plates swap one face at a time. */
export function resolveChainedSwapTargetPath(
  styleId: ShowStyleId,
  target: SwapTargetRef,
  castKey: string,
  castOrder: string[],
): string | null {
  const base = resolveSwapTargetPath(styleId, target);
  if (!base) return null;
  const key = targetRefKey(target);
  const manifest = readSwapManifest(styleId);
  let chainPath = base;
  for (const ck of castOrder) {
    if (ck === castKey) break;
    const entry = manifest[ck];
    if (!entry || targetRefKey(entry.target) !== key) continue;
    const p = resolveSwapResultPath(styleId, entry.resultFile);
    if (p) chainPath = p;
  }
  return chainPath;
}

export function resolveSwapResultPath(styleId: ShowStyleId, resultFile: string): string | null {
  if (!/^[\w.\-]+$/.test(resultFile)) return null;
  const p = path.join(swapGalleryDir(styleId), resultFile);
  return fs.existsSync(p) ? p : null;
}

export function listGenPlateTargets(
  styleId?: ShowStyleId,
  limit = 30,
): {
  fileName: string;
  mtime: number;
  label: string;
}[] {
  const genDir = path.join(CRASH_DIR, "gen");
  if (!fs.existsSync(genDir)) return [];
  const manifest = readCplateManifest();
  const out: { fileName: string; mtime: number; label: string }[] = [];
  for (const f of fs.readdirSync(genDir)) {
    if (!/^cplate_[\w.\-]+\.(png|jpe?g|webp)$/i.test(f)) continue;
    const meta = manifest[f];
    /* Untagged plates still show — old gens often lack styleId */
    if (styleId && meta?.styleId && meta.styleId !== styleId) continue;
    const mtime = fs.statSync(path.join(genDir, f)).mtimeMs;
    out.push({
      fileName: f,
      mtime,
      label: formatCplateDisplayName(f, mtime),
    });
  }
  out.sort((a, b) => b.mtime - a.mtime);
  return out.slice(0, limit);
}

export function saveSwapTargetUpload(
  styleId: ShowStyleId,
  buffer: Buffer,
  ext: string,
): { fileName: string; path: string } {
  ensureSwapDirs(styleId);
  const safeExt = ext.toLowerCase().match(/^\.(png|jpe?g|webp)$/)
    ? ext.toLowerCase().replace(".jpeg", ".jpg")
    : ".png";
  const fileName = `target_${Date.now()}${safeExt === ".jpeg" ? ".jpg" : safeExt}`;
  const dest = path.join(swapTargetsDir(styleId), fileName);
  fs.writeFileSync(dest, buffer);
  return { fileName, path: dest };
}

export function saveSwapResult(opts: {
  styleId: ShowStyleId;
  castKey: string;
  castName: string;
  sourceKey: string;
  target: SwapTargetRef;
  resultBuffer: Buffer;
  ext: string;
  engine?: string;
}): SwapResultLabel {
  ensureSwapDirs(opts.styleId);
  const ext = opts.ext.toLowerCase().match(/^\.(png|jpe?g|webp)$/) ? opts.ext : ".png";
  const resultFile = `swap_${Date.now()}${ext === ".jpeg" ? ".jpg" : ext}`;
  fs.writeFileSync(path.join(swapGalleryDir(opts.styleId), resultFile), opts.resultBuffer);

  const manifest = readSwapManifest(opts.styleId);
  const label: SwapResultLabel = {
    castKey: opts.castKey,
    castName: opts.castName,
    sourceKey: opts.sourceKey,
    target: opts.target,
    resultFile,
    engine: opts.engine,
    locked: true,
  };
  manifest[opts.castKey] = label;
  writeSwapManifest(opts.styleId, manifest);
  return label;
}

export function readSwapResultFile(
  styleId: ShowStyleId,
  resultFile: string,
): { buf: Buffer; contentType: string } | null {
  const p = resolveSwapResultPath(styleId, resultFile);
  if (!p) return null;
  const ext = path.extname(p).toLowerCase();
  const contentType =
    ext === ".jpg" || ext === ".jpeg"
      ? "image/jpeg"
      : ext === ".webp"
        ? "image/webp"
        : "image/png";
  return { buf: fs.readFileSync(p), contentType };
}

export function resolveSourceFacePath(
  styleId: ShowStyleId,
  sourceKey: string,
): string | null {
  return resolveStyleCardThumbPath(styleId, sourceKey);
}
