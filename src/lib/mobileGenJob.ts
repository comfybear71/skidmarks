import fs from "fs";
import path from "path";
import { CRASH_DIR } from "./paths";
import { sortableId } from "./types";
import type { ShowStyleId } from "./showStylePresets";

/**
 * Checkpointed job document for the mobile Auto Studio pipeline. A run can
 * span many /api/crash/mobile/step calls (each doing one bounded unit of
 * work), so unlike every other progress-file in this codebase this is the
 * actual state machine, not just a status readout — losing it loses the run.
 */
export type MobileGenPhase =
  | "screenplay"
  | "cast_images"
  | "location_images"
  | "plates"
  | "voices"
  | "review"
  | "animate"
  | "stitch"
  | "done"
  | "error";

export type MobileImageCandidate = {
  id: string;
  fileName: string;
  approved: boolean;
};

export type MobileShotUnit = {
  shotId: string;
  sceneId: string;
  plateFile: string;
};

/** One per dialogue beat — the LTX/Comfy pipeline animates per-line, not per-shot (a shot's plate is shared across its beats, but each line gets its own short clip matched to its own audio). */
export type MobileClipUnit = {
  beatId: string;
  shotId: string;
  sceneId: string;
  clipFile: string;
  clipStatus: "pending" | "done" | "error";
  error: string;
};

export type MobileSceneRef = {
  id: string;
  placeName: string;
  worldThumbKey: string;
};

export type MobileGenJob = {
  id: string;
  styleId: ShowStyleId;
  folderName: string;
  prompt: string;
  targetDurationSec: number;
  secondsPerShot: number;
  phase: MobileGenPhase;
  /** Unique speaker names — drives the cast_images approval cursor. */
  speakers: string[];
  /** Scenes needing a location — drives the location_images approval cursor. */
  scenes: MobileSceneRef[];
  /** Candidate portraits per speaker name, awaiting a swipe pick. */
  castCandidates: Record<string, MobileImageCandidate[]>;
  /** Candidate location stills per scene id, awaiting a swipe pick. */
  locationCandidates: Record<string, MobileImageCandidate[]>;
  shots: MobileShotUnit[];
  clips: MobileClipUnit[];
  finalVideoFile: string;
  error: string;
  createdAt: string;
  updatedAt: string;
};

function jobsDir(): string {
  const dir = path.join(CRASH_DIR, "mobile", "jobs");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function jobPath(id: string): string {
  return path.join(jobsDir(), `${id}.json`);
}

export function createMobileGenJob(opts: {
  styleId: ShowStyleId;
  prompt: string;
  targetDurationSec: number;
  secondsPerShot: number;
}): MobileGenJob {
  const now = new Date().toISOString();
  const job: MobileGenJob = {
    id: sortableId("mgen"),
    styleId: opts.styleId,
    folderName: "",
    prompt: opts.prompt,
    targetDurationSec: opts.targetDurationSec,
    secondsPerShot: opts.secondsPerShot,
    phase: "screenplay",
    speakers: [],
    scenes: [],
    castCandidates: {},
    locationCandidates: {},
    shots: [],
    clips: [],
    finalVideoFile: "",
    error: "",
    createdAt: now,
    updatedAt: now,
  };
  writeMobileGenJob(job);
  return job;
}

export function readMobileGenJob(id: string): MobileGenJob | null {
  const p = jobPath(id);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as MobileGenJob;
  } catch {
    return null;
  }
}

export function writeMobileGenJob(job: MobileGenJob): void {
  job.updatedAt = new Date().toISOString();
  fs.writeFileSync(jobPath(job.id), JSON.stringify(job, null, 2));
}

export function patchMobileGenJob(
  id: string,
  patch: Partial<MobileGenJob>,
): MobileGenJob | null {
  const job = readMobileGenJob(id);
  if (!job) return null;
  const next = { ...job, ...patch };
  writeMobileGenJob(next);
  return next;
}
