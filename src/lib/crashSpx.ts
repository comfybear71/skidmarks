import fs from "fs";
import path from "path";
import { CRASH_DIR } from "./paths";
import { morphKeepersDir } from "./morph";
import { newId } from "./types";
import type { ShowStyleId } from "./showStylePresets";
import { retireFile } from "./retire";

export type CrashSpxKind = "sfx" | "video";

export type CrashSpxItem = {
  id: string;
  kind: CrashSpxKind;
  fileName: string;
  label: string;
  note?: string;
  mtime: number;
};

export type MorphKeeperRow = {
  fileName: string;
  label: string;
  mtime: number;
};

function spxRoot(styleId: ShowStyleId): string {
  return path.join(CRASH_DIR, "spx", styleId);
}

function manifestPath(styleId: ShowStyleId): string {
  return path.join(spxRoot(styleId), "manifest.json");
}

function kindDir(styleId: ShowStyleId, kind: CrashSpxKind): string {
  return path.join(spxRoot(styleId), kind);
}

function ensureSpxDirs(styleId: ShowStyleId): void {
  for (const d of [spxRoot(styleId), kindDir(styleId, "sfx"), kindDir(styleId, "video")]) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  }
}

export function readCrashSpxManifest(styleId: ShowStyleId): CrashSpxItem[] {
  const p = manifestPath(styleId);
  if (!fs.existsSync(p)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(p, "utf8")) as CrashSpxItem[];
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function writeCrashSpxManifest(styleId: ShowStyleId, items: CrashSpxItem[]): void {
  ensureSpxDirs(styleId);
  fs.writeFileSync(manifestPath(styleId), JSON.stringify(items, null, 2) + "\n");
}

export function crashSpxFilePath(
  styleId: ShowStyleId,
  kind: CrashSpxKind,
  fileName: string,
): string | null {
  if (!fileName || fileName.includes("..") || !/^[\w.\-]+$/.test(fileName)) {
    return null;
  }
  const p = path.join(kindDir(styleId, kind), fileName);
  return fs.existsSync(p) ? p : null;
}

export function addCrashSpxGeneratedSound(opts: {
  styleId: ShowStyleId;
  buffer: Buffer;
  label: string;
  prompt: string;
}): CrashSpxItem {
  ensureSpxDirs(opts.styleId);
  const fileName = `sfx_${Date.now()}.mp3`;
  const dest = path.join(kindDir(opts.styleId, "sfx"), fileName);
  fs.writeFileSync(dest, opts.buffer);

  const item: CrashSpxItem = {
    id: newId("spx"),
    kind: "sfx",
    fileName,
    label: opts.label.trim() || "SFX",
    note: opts.prompt.trim() || undefined,
    mtime: fs.statSync(dest).mtimeMs,
  };

  const items = readCrashSpxManifest(opts.styleId);
  items.unshift(item);
  writeCrashSpxManifest(opts.styleId, items);
  return item;
}

export function findCrashSpxItem(
  styleId: ShowStyleId,
  id: string,
): CrashSpxItem | null {
  return readCrashSpxManifest(styleId).find((i) => i.id === id) ?? null;
}

export function addCrashSpxUpload(opts: {
  styleId: ShowStyleId;
  kind: CrashSpxKind;
  buffer: Buffer;
  ext: string;
  label?: string;
  note?: string;
}): CrashSpxItem {
  const ext = opts.ext.toLowerCase();
  if (opts.kind === "sfx" && !/^\.(mp3|wav|m4a|ogg)$/.test(ext)) {
    throw new Error("Sound: use mp3, wav, m4a, or ogg");
  }
  if (opts.kind === "video" && !/^\.(mp4|webm|mov)$/.test(ext)) {
    throw new Error("Video: use mp4, webm, or mov");
  }

  ensureSpxDirs(opts.styleId);
  const fileName = `${opts.kind}_${Date.now()}${ext === ".jpeg" ? ".jpg" : ext}`;
  const dest = path.join(kindDir(opts.styleId, opts.kind), fileName);
  fs.writeFileSync(dest, opts.buffer);

  const item: CrashSpxItem = {
    id: newId("spx"),
    kind: opts.kind,
    fileName,
    label: opts.label?.trim() || fileName,
    note: opts.note?.trim() || undefined,
    mtime: fs.statSync(dest).mtimeMs,
  };

  const items = readCrashSpxManifest(opts.styleId);
  items.unshift(item);
  writeCrashSpxManifest(opts.styleId, items);
  return item;
}

export function removeCrashSpxItem(
  styleId: ShowStyleId,
  id: string,
): CrashSpxItem[] {
  const items = readCrashSpxManifest(styleId);
  const hit = items.find((i) => i.id === id);
  if (hit) {
    const fp = crashSpxFilePath(styleId, hit.kind, hit.fileName);
    retireFile(fp);
  }
  const next = items.filter((i) => i.id !== id);
  writeCrashSpxManifest(styleId, next);
  return next;
}

export function listMorphKeepers(): MorphKeeperRow[] {
  const dir = morphKeepersDir();
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => /\.(mp4|webm|mov)$/i.test(f))
    .map((fileName) => {
      const st = fs.statSync(path.join(dir, fileName));
      const label = fileName.replace(/^morph_keeper_/, "").replace(/\.[^.]+$/, "");
      return { fileName, label, mtime: st.mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);
}

export function readCrashSpxDesk(styleId: ShowStyleId) {
  return {
    styleId,
    items: readCrashSpxManifest(styleId),
  };
}
