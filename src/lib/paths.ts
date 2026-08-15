import os from "os";
import path from "path";
import { runningOnVercel } from "./cloudEnv";

/**
 * PC root for MY MOVIES.
 * - Local Studio: two levels above the repo, where the real MY MOVIES tree lives.
 * - On Vercel that tree doesn't exist and /var/task is read-only, so any
 *   Crash Lab pack write there throws ENOENT/EROFS. Redirect to the OS temp
 *   dir like DATA_DIR — per-invocation scratch only; the cloud-sync helpers
 *   in cursorCloudSync.ts mirror packs to/from Neon+Blob around that scratch.
 */
export const MOVIES_ROOT = runningOnVercel()
  ? path.join(os.tmpdir(), "skidmarks-movies-root")
  : path.resolve(process.cwd(), "..", "..");

export const SKIDMARKS_EPISODES = path.join(
  MOVIES_ROOT,
  "Skidmarks",
  "episodes",
);

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
export const EPISODES_FILE = path.join(DATA_DIR, "episodes.json");
export const CHARACTERS_FILE = path.join(DATA_DIR, "characters.json");
export const CHARACTERS_DIR = path.join(DATA_DIR, "characters");
export const LOCATIONS_FILE = path.join(DATA_DIR, "locations.json");
export const LOCATIONS_DIR = path.join(DATA_DIR, "locations");
export const CRASH_FILE = path.join(DATA_DIR, "crash.json");
export const CRASH_DIR = path.join(DATA_DIR, "crash");
export const SKIDMARKS_ROOT = path.join(MOVIES_ROOT, "Skidmarks");
