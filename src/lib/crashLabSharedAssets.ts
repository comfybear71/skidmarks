/**
 * Shared Crash Lab images — MY MOVIES\{SHOW}\_CRASH_LAB\images\
 * Specials live under characters\; New episode pulls them back into Scene kit.
 */
import fs from "fs";
import path from "path";
import { runningOnVercel } from "./cloudEnv";
import { crashLabRootForStyle } from "./showArchivePaths";
import {
  getShowStylePreset,
  type ShowStyleId,
} from "./showStylePresets";
import {
  liveCastKeys,
  readStyleCardManifest,
  resolveStyleCardThumbPath,
  saveUploadAsStyleCard,
} from "./styleCardThumbs";

const IMAGE_EXT = /\.(png|jpe?g|webp)$/i;

function nameFromFile(file: string): string {
  const base = path.basename(file).replace(IMAGE_EXT, "");
  return base.replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

export function crashLabCharactersDir(styleId: ShowStyleId): string {
  return path.join(crashLabRootForStyle(styleId), "images", "characters");
}

export function crashLabPlacesDir(styleId: ShowStyleId): string {
  return path.join(crashLabRootForStyle(styleId), "images", "places");
}

/** Copy a gallery face into the show Crash Lab characters folder (named). */
export function mirrorFaceIntoCrashLabCharacters(opts: {
  styleId: ShowStyleId;
  thumbKey: string;
  name: string;
}): string | null {
  // MY MOVIES\{show}\_CRASH_LAB lives on the real PC disk (MOVIES_ROOT) —
  // there's nothing to mirror into on Vercel, and mkdirSync there throws
  // (read-only deployment filesystem), so skip rather than 500 the caller.
  if (runningOnVercel()) return null;
  const src = resolveStyleCardThumbPath(opts.styleId, opts.thumbKey);
  if (!src) return null;
  const safe =
    opts.name
      .trim()
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
      .replace(/\s+/g, "_")
      .slice(0, 80) || "character";
  const destDir = crashLabCharactersDir(opts.styleId);
  fs.mkdirSync(destDir, { recursive: true });
  const ext = path.extname(src) || ".png";
  const dest = path.join(destDir, `${safe}${ext}`);
  fs.copyFileSync(src, dest);
  return dest;
}

/**
 * Ensure every PNG in _CRASH_LAB\images\characters\ is in the Style gallery.
 * Returns park keys (preset order) + guest keys (shared folder, not park).
 */
export function syncCrashLabCharactersForSceneKit(styleId: ShowStyleId): {
  parkKeys: string[];
  guestKeys: string[];
  castKeys: string[];
  imported: string[];
} {
  // Same MOVIES_ROOT-only disk as mirrorFaceIntoCrashLabCharacters — no
  // local _CRASH_LAB\images\characters\ to read on Vercel, so return the
  // empty-but-valid shape instead of throwing on the read-only filesystem.
  if (runningOnVercel()) {
    return { parkKeys: [], guestKeys: [], castKeys: [], imported: [] };
  }
  const preset = getShowStylePreset(styleId);
  const parkNameList = preset.presetCast.map((c) => c.name.trim());
  const parkNameSet = new Set(parkNameList.map((n) => n.toLowerCase()));

  const charsDir = crashLabCharactersDir(styleId);
  fs.mkdirSync(charsDir, { recursive: true });

  const imported: string[] = [];
  let byName = liveCastKeys(styleId);

  if (fs.existsSync(charsDir)) {
    for (const ent of fs.readdirSync(charsDir, { withFileTypes: true })) {
      if (!ent.isFile() || !IMAGE_EXT.test(ent.name)) continue;
      const name = nameFromFile(ent.name);
      if (!name) continue;
      const existing = Object.entries(byName).find(
        ([n]) => n.toLowerCase() === name.toLowerCase(),
      );
      if (existing) continue;

      const buf = fs.readFileSync(path.join(charsDir, ent.name));
      const ext = path.extname(ent.name).toLowerCase() || ".png";
      const saved = saveUploadAsStyleCard({
        buffer: buf,
        ext: ext === ".jpeg" ? ".jpg" : ext,
        styleId,
        name,
        brief: name,
      });
      imported.push(name);
      if (saved.thumbKey) {
        byName = { ...byName, [name]: saved.thumbKey };
      }
    }
  }

  // Refresh after imports
  byName = liveCastKeys(styleId);
  const findKey = (want: string): string | null => {
    const hit = Object.entries(byName).find(
      ([n]) => n.toLowerCase() === want.toLowerCase(),
    );
    return hit?.[1] || null;
  };

  const parkKeys: string[] = [];
  for (const n of parkNameList) {
    const k = findKey(n);
    if (k && !parkKeys.includes(k)) parkKeys.push(k);
  }

  const guestKeys: string[] = [];
  if (fs.existsSync(charsDir)) {
    for (const ent of fs.readdirSync(charsDir, { withFileTypes: true })) {
      if (!ent.isFile() || !IMAGE_EXT.test(ent.name)) continue;
      const name = nameFromFile(ent.name);
      if (!name || parkNameSet.has(name.toLowerCase())) continue;
      const k = findKey(name);
      if (k && !guestKeys.includes(k) && !parkKeys.includes(k)) {
        guestKeys.push(k);
      }
    }
  }

  // Also keep any gallery face already labelled that isn't park (e.g. just generated)
  const man = readStyleCardManifest(styleId);
  for (const [key, lab] of Object.entries(man)) {
    const n = (lab.name || "").trim();
    if (!n || parkNameSet.has(n.toLowerCase())) continue;
    if (parkKeys.includes(key) || guestKeys.includes(key)) continue;
    // Only auto-include if a same-named file exists in Crash Lab characters
    const safe = n.replace(/\s+/g, "_");
    const hasFile =
      fs.existsSync(path.join(charsDir, `${safe}.png`)) ||
      fs.existsSync(path.join(charsDir, `${safe}.jpg`)) ||
      fs.existsSync(path.join(charsDir, `${n}.png`));
    if (hasFile) guestKeys.push(key);
  }

  return {
    parkKeys,
    guestKeys,
    castKeys: [...parkKeys, ...guestKeys],
    imported,
  };
}
