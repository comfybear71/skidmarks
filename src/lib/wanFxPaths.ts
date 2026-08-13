import fs from "fs";
import path from "path";
import { CRASH_DIR, MOVIES_ROOT } from "./paths";

/** Stuie’s SPX stills for boom FX */
export const WAN_FX_PLATES_DIR = path.join(
  MOVIES_ROOT,
  "_XX_SPX",
  "_PLATES",
);

/** Keep destination — folder he already created */
export const WAN_FX_EXPLOSIONS_DIR = path.join(
  MOVIES_ROOT,
  "_XX_SPX",
  "explosions",
);

export const WAN_FX_WF_PATH = path.join(
  MOVIES_ROOT,
  "workflow",
  "wan_fx",
  "WF_explosion_v1.json",
);

const IMAGE_EXT = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".bmp",
  ".tif",
  ".tiff",
]);

export function wanFxCrashDir(): string {
  const d = path.join(CRASH_DIR, "wan_fx");
  fs.mkdirSync(d, { recursive: true });
  return d;
}

export function wanFxUploadDir(): string {
  const d = path.join(wanFxCrashDir(), "_upload");
  fs.mkdirSync(d, { recursive: true });
  return d;
}

export function ensureWanFxExplosionsDir(): string {
  fs.mkdirSync(WAN_FX_EXPLOSIONS_DIR, { recursive: true });
  return WAN_FX_EXPLOSIONS_DIR;
}

export type WanFxPlateRow = {
  name: string;
  mtime: number;
  size: number;
};

/** Normalize a plate id to a safe relative path under _PLATES (forward slashes). */
function normalizeWanFxPlateRel(name: string): string | null {
  if (!name || name.includes("..")) return null;
  const rel = name.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!rel || path.isAbsolute(rel)) return null;
  const parts = rel.split("/");
  if (parts.some((p) => !p || p === "." || p === "..")) return null;
  return parts.join("/");
}

function collectWanFxPlates(
  dir: string,
  relPrefix: string,
  rows: WanFxPlateRow[],
): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    if (ent.name.startsWith(".")) continue;
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      const nextPrefix = relPrefix ? `${relPrefix}/${ent.name}` : ent.name;
      collectWanFxPlates(abs, nextPrefix, rows);
      continue;
    }
    if (!ent.isFile()) continue;
    const ext = path.extname(ent.name).toLowerCase();
    if (!IMAGE_EXT.has(ext)) continue;
    let st: fs.Stats;
    try {
      st = fs.statSync(abs);
    } catch {
      continue;
    }
    const relName = relPrefix ? `${relPrefix}/${ent.name}` : ent.name;
    rows.push({ name: relName, mtime: st.mtimeMs, size: st.size });
  }
}

/** List stills in _XX_SPX\_PLATES and subfolders (newest first). */
export function listWanFxPlates(): WanFxPlateRow[] {
  if (!fs.existsSync(WAN_FX_PLATES_DIR)) return [];
  const rows: WanFxPlateRow[] = [];
  collectWanFxPlates(WAN_FX_PLATES_DIR, "", rows);
  rows.sort((a, b) => b.mtime - a.mtime);
  return rows;
}

/** Safe resolve a plate path under _PLATES (e.g. `_CARS/foo.png`). */
export function wanFxPlatePath(name: string): string | null {
  const rel = normalizeWanFxPlateRel(name);
  if (!rel) return null;
  const ext = path.extname(rel).toLowerCase();
  if (!IMAGE_EXT.has(ext)) return null;
  const abs = path.resolve(WAN_FX_PLATES_DIR, ...rel.split("/"));
  const relCheck = path.relative(WAN_FX_PLATES_DIR, abs);
  if (relCheck.startsWith("..") || path.isAbsolute(relCheck)) return null;
  if (!fs.existsSync(abs)) return null;
  try {
    if (!fs.statSync(abs).isFile()) return null;
  } catch {
    return null;
  }
  return abs;
}

/** Safe resolve a pulled boom mp4 under data/crash/wan_fx/ */
export function wanFxLocalFilePath(name: string): string | null {
  if (!name || name.includes("..") || !/^[\w.\-]+$/.test(name)) return null;
  const abs = path.join(wanFxCrashDir(), name);
  return fs.existsSync(abs) ? abs : null;
}
