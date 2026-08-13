import fs from "fs";
import path from "path";
import { MOVIES_ROOT } from "./paths";

/** Always re-read MY MOVIES/.env so rotated keys pick up without a full reboot. */
export function loadMoviesEnv() {
  const envPath = path.join(MOVIES_ROOT, ".env");
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    // File wins — stale process.env was keeping an expired XAI key alive
    process.env[key] = val;
  }
}

export function getEnv(key: string): string {
  loadMoviesEnv();
  return (process.env[key] || "").trim();
}
