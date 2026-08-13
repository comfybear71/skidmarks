/**
 * Server-side: which _CRASH_LAB pack is open.
 * When set, story / dialogue audio / plates / scene-kit live IN that pack — one copy.
 * Never deletes pack media.
 */
import fs from "fs";
import path from "path";
import { CRASH_DIR } from "./paths";
import type { ShowStyleId } from "./showStylePresets";
import { crashLabRootForStyle } from "./showArchivePaths";

const FILE = path.join(CRASH_DIR, "active-pack.json");

export type ActivePackState = {
  folderName: string;
  styleId: ShowStyleId;
};

export function readActivePack(): ActivePackState | null {
  if (!fs.existsSync(FILE)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, "utf8")) as Partial<ActivePackState>;
    const folderName = String(raw.folderName || "").trim();
    const styleId = String(raw.styleId || "").trim() as ShowStyleId;
    if (!folderName || !styleId) return null;
    return { folderName, styleId };
  } catch {
    return null;
  }
}

export function writeActivePack(state: ActivePackState): void {
  fs.mkdirSync(CRASH_DIR, { recursive: true });
  fs.writeFileSync(
    FILE,
    JSON.stringify(
      {
        folderName: state.folderName.trim(),
        styleId: state.styleId,
      },
      null,
      2,
    ) + "\n",
  );
}

export function clearActivePack(): void {
  if (!fs.existsSync(FILE)) return;
  try {
    // Park pointer file — never delete pack media. Overwrite with empty marker.
    fs.writeFileSync(FILE, JSON.stringify({ folderName: "", styleId: "" }, null, 2) + "\n");
  } catch {
    /* ignore */
  }
}

export function activePackDir(): string | null {
  const a = readActivePack();
  if (!a?.folderName) return null;
  const root = crashLabRootForStyle(a.styleId);
  const dir = path.join(root, a.folderName);
  if (!fs.existsSync(dir)) return null;
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(dir);
  if (!resolved.startsWith(resolvedRoot + path.sep) && resolved !== resolvedRoot) {
    return null;
  }
  return resolved;
}

export function activePackStoryPath(): string | null {
  const dir = activePackDir();
  if (!dir) return null;
  const modern = path.join(dir, "_RECIPE", "story.json");
  if (fs.existsSync(modern)) return modern;
  const legacy = path.join(dir, "story.json");
  if (fs.existsSync(legacy)) return legacy;
  // Prefer _RECIPE for new writes when pack is open
  fs.mkdirSync(path.join(dir, "_RECIPE"), { recursive: true });
  return modern;
}

export function activePackSceneKitPath(): string | null {
  const dir = activePackDir();
  if (!dir) return null;
  const modern = path.join(dir, "_RECIPE", "scene-kit.json");
  if (fs.existsSync(modern)) return modern;
  const legacy = path.join(dir, "scene-kit.json");
  if (fs.existsSync(legacy)) return legacy;
  fs.mkdirSync(path.join(dir, "_RECIPE"), { recursive: true });
  return modern;
}

export function activePackAudioDir(): string | null {
  const dir = activePackDir();
  if (!dir) return null;
  const audio = path.join(dir, "audio");
  fs.mkdirSync(audio, { recursive: true });
  return audio;
}

export function activePackPlatesDir(): string | null {
  const dir = activePackDir();
  if (!dir) return null;
  const plates = path.join(dir, "plates");
  fs.mkdirSync(plates, { recursive: true });
  return plates;
}

/** Where new / live plate files are written. Pack plates when open; else Studio gen. */
export function crashGenDir(): string {
  const packPlates = activePackPlatesDir();
  if (packPlates) return packPlates;
  const d = path.join(CRASH_DIR, "gen");
  fs.mkdirSync(d, { recursive: true });
  return d;
}

/** Resolve a plate/gen filename — pack first, then Studio gen. Never deletes. */
export function resolveGenOrPackPlate(name: string): string | null {
  if (!name || name.includes("..") || name.includes("/") || name.includes("\\")) {
    return null;
  }
  const packPlates = activePackPlatesDir();
  if (packPlates) {
    const p = path.join(packPlates, name);
    if (fs.existsSync(p)) return p;
  }
  const studio = path.join(CRASH_DIR, "gen", name);
  if (fs.existsSync(studio)) return studio;
  return null;
}
