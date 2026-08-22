import fs from "fs";
import os from "os";
import path from "path";
import { runningOnVercel } from "./cloudEnv";

/**
 * Writable data root.
 * - Local Studio writes beside the app (./data).
 * - On Vercel the deployment dir (/var/task) is read-only, so any scratch
 *   write there throws (ENOENT/EROFS). The only writable location is the OS
 *   temp dir, so redirect there. Persistent media on Vercel lives in Vercel
 *   Blob + Neon (see cloudEnv/useCloudStore); this disk root is just
 *   per-invocation scratch and read fallbacks.
 */
export const DATA_DIR = runningOnVercel()
  ? path.join(os.tmpdir(), "skidmarks-data")
  : path.join(process.cwd(), "data");

function isFilesystemRoot(p: string): boolean {
  return path.parse(p).root === p;
}

function resolveMoviesRoot(): string {
  if (runningOnVercel()) return path.join(os.tmpdir(), "skidmarks-movies-root");
  const real = path.resolve(process.cwd(), "..", "..");
  if (!isFilesystemRoot(real) && fs.existsSync(real)) return real;
  // Agent VM / no real MY MOVIES tree at that depth — use the git-ignored local
  // data dir instead of a path that doesn't exist (or is the filesystem root).
  return DATA_DIR;
}

/**
 * PC root for MY MOVIES when that tree exists two levels above the repo.
 * Falls back to DATA_DIR on agent VMs where ../.. is the filesystem root.
 */
export const MOVIES_ROOT = resolveMoviesRoot();

export const SKIDMARKS_EPISODES = path.join(
  MOVIES_ROOT,
  "Skidmarks",
  "episodes",
);

export const EPISODES_FILE = path.join(DATA_DIR, "episodes.json");
export const CHARACTERS_FILE = path.join(DATA_DIR, "characters.json");
export const CHARACTERS_DIR = path.join(DATA_DIR, "characters");
export const LOCATIONS_FILE = path.join(DATA_DIR, "locations.json");
export const LOCATIONS_DIR = path.join(DATA_DIR, "locations");
export const CRASH_FILE = path.join(DATA_DIR, "crash.json");
export const CRASH_DIR = path.join(DATA_DIR, "crash");
export const SKIDMARKS_ROOT = path.join(MOVIES_ROOT, "Skidmarks");
