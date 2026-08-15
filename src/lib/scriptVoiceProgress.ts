import fs from "fs";
import path from "path";
import { CRASH_DIR } from "./paths";

export type ScriptVoicePhase = "idle" | "casting" | "lines" | "done" | "error";

export type ScriptVoiceProgress = {
  phase: ScriptVoicePhase;
  current: number;
  total: number;
  label: string;
  updatedAt: string;
};

/** Own file, separate from image-progress.json — a distinct job that could run alongside it. */
function progressPath(): string {
  const dir = path.join(CRASH_DIR, "script");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "voice-progress.json");
}

export function writeScriptVoiceProgress(
  partial: Partial<ScriptVoiceProgress> & Pick<ScriptVoiceProgress, "label">,
): ScriptVoiceProgress {
  const prev = readScriptVoiceProgress();
  const next: ScriptVoiceProgress = {
    phase: partial.phase ?? prev?.phase ?? "idle",
    current: partial.current ?? prev?.current ?? 0,
    total: partial.total ?? prev?.total ?? 1,
    label: partial.label,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(progressPath(), JSON.stringify(next, null, 2));
  return next;
}

export function readScriptVoiceProgress(): ScriptVoiceProgress | null {
  const p = progressPath();
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as ScriptVoiceProgress;
  } catch {
    return null;
  }
}

export function clearScriptVoiceProgress(): void {
  writeScriptVoiceProgress({ phase: "idle", current: 0, total: 1, label: "" });
}
