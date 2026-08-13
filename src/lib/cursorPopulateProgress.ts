import fs from "fs";
import path from "path";
import { CRASH_DIR } from "./paths";

export type PopulatePhase =
  | "idle"
  | "plates"
  | "swap"
  | "voices"
  | "sfx"
  | "done"
  | "error";

export type PopulateProgress = {
  phase: PopulatePhase;
  current: number;
  total: number;
  label: string;
  updatedAt: string;
};

function progressPath(): string {
  const dir = path.join(CRASH_DIR, "cursor");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "populate-progress.json");
}

export function writePopulateProgress(
  partial: Partial<PopulateProgress> & Pick<PopulateProgress, "label">,
): PopulateProgress {
  const prev = readPopulateProgress();
  const next: PopulateProgress = {
    phase: partial.phase ?? prev?.phase ?? "idle",
    current: partial.current ?? prev?.current ?? 0,
    total: partial.total ?? prev?.total ?? 1,
    label: partial.label,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(progressPath(), JSON.stringify(next, null, 2));
  return next;
}

export function readPopulateProgress(): PopulateProgress | null {
  const p = progressPath();
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as PopulateProgress;
  } catch {
    return null;
  }
}

export function clearPopulateProgress(): void {
  writePopulateProgress({
    phase: "idle",
    current: 0,
    total: 1,
    label: "",
  });
}
