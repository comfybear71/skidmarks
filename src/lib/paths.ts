import path from "path";

/** PC root for MY MOVIES */
export const MOVIES_ROOT = path.resolve(process.cwd(), "..", "..");

export const SKIDMARKS_EPISODES = path.join(
  MOVIES_ROOT,
  "Skidmarks",
  "episodes",
);

export const DATA_DIR = path.join(process.cwd(), "data");
export const EPISODES_FILE = path.join(DATA_DIR, "episodes.json");
export const CHARACTERS_FILE = path.join(DATA_DIR, "characters.json");
export const CHARACTERS_DIR = path.join(DATA_DIR, "characters");
export const LOCATIONS_FILE = path.join(DATA_DIR, "locations.json");
export const LOCATIONS_DIR = path.join(DATA_DIR, "locations");
export const CRASH_FILE = path.join(DATA_DIR, "crash.json");
export const CRASH_DIR = path.join(DATA_DIR, "crash");
export const SKIDMARKS_ROOT = path.join(MOVIES_ROOT, "Skidmarks");
