import fs from "fs";
import path from "path";
import { CRASH_DIR } from "./paths";

export type ScriptImagePhase = "idle" | "characters" | "locations" | "done" | "error";

export type ScriptImageProgress = {
  phase: ScriptImagePhase;
  current: number;
  total: number;
  label: string;
  updatedAt: string;
};

/** Own file, separate from cursor/populate-progress.json — a distinct job that could run alongside Populate. */
function progressPath(): string {
  const dir = path.join(CRASH_DIR, "script");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "image-progress.json");
}

export function writeScriptImageProgress(
  partial: Partial<ScriptImageProgress> & Pick<ScriptImageProgress, "label">,
): ScriptImageProgress {
  const prev = readScriptImageProgress();
  const next: ScriptImageProgress = {
    phase: partial.phase ?? prev?.phase ?? "idle",
    current: partial.current ?? prev?.current ?? 0,
    total: partial.total ?? prev?.total ?? 1,
    label: partial.label,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(progressPath(), JSON.stringify(next, null, 2));
  return next;
}

export function readScriptImageProgress(): ScriptImageProgress | null {
  const p = progressPath();
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as ScriptImageProgress;
  } catch {
    return null;
  }
}

export function clearScriptImageProgress(): void {
  writeScriptImageProgress({ phase: "idle", current: 0, total: 1, label: "" });
}
