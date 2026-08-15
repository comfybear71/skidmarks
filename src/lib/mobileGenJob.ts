import fs from "fs";
import path from "path";
import { CRASH_DIR } from "./paths";
import { sortableId } from "./types";
import { useCloudStore } from "./cloudEnv";
import { readMobileJobRow, saveMobileJobRow } from "./neonStore";
import type { ShowStyleId } from "./showStylePresets";
import type { ScriptCharacterData } from "./types";

/**
 * Checkpointed job document for the mobile Auto Studio pipeline. A run can
 * span many /api/crash/mobile/step calls (each doing one bounded unit of
 * work), so unlike every other progress-file in this codebase this is the
 * actual state machine, not just a status readout — losing it loses the run.
 *
 * On Vercel, local disk is per-invocation scratch — a different serverless
 * instance can (and does) handle the next request, so a job written to
 * /tmp by one call is simply gone by the next ("Job not found" in
 * production). Persists through Neon when useCloudStore() is true; local
 * disk otherwise, matching every other dual-mode store in this codebase.
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
  /** Why compositing failed, when it did — otherwise animate can only report
   * that a plate is missing, not what went wrong making it. */
  error?: string;
};

/** One per dialogue beat — the LTX/Comfy pipeline animates per-line, not per-shot (a shot's plate is shared across its beats, but each line gets its own short clip matched to its own audio). */
export type MobileClipUnit = {
  beatId: string;
  shotId: string;
  sceneId: string;
  clipFile: string;
  clipStatus: "pending" | "done" | "error";
  error: string;
  speaker?: string;
  line?: string;
  /** The exact IMAGE MOTION text sent to LTX for this clip — kept so the
   * build can be watched as it happens instead of reconstructed after the
   * fact from route code. Testing wants this visible, not just correct. */
  imageMotion?: string;
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
  /** Cartoon 0 <-> photo 100, same scale as the desktop Image gen slider.
   * Older jobs predate the field, so readers fall back to the style preset. */
  styleRealism?: number;
  phase: MobileGenPhase;
  /** Unique speaker names — drives the cast_images approval cursor. */
  speakers: string[];
  /**
   * Parsed screenplay roster — kept on the job (already Neon-backed) so a
   * later request on a different Vercel instance can re-create Character
   * rows locally before looking one up. createCharactersFromScriptRoster is
   * idempotent by name, so re-running it here is always safe.
   */
  roster: ScriptCharacterData[];
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

export async function createMobileGenJob(opts: {
  styleId: ShowStyleId;
  prompt: string;
  targetDurationSec: number;
  secondsPerShot: number;
  styleRealism?: number;
}): Promise<MobileGenJob> {
  const now = new Date().toISOString();
  const job: MobileGenJob = {
    id: sortableId("mgen"),
    styleId: opts.styleId,
    folderName: "",
    prompt: opts.prompt,
    targetDurationSec: opts.targetDurationSec,
    secondsPerShot: opts.secondsPerShot,
    styleRealism: opts.styleRealism,
    phase: "screenplay",
    speakers: [],
    roster: [],
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
  await writeMobileGenJob(job);
  return job;
}

export async function readMobileGenJob(id: string): Promise<MobileGenJob | null> {
  if (useCloudStore()) {
    return readMobileJobRow<MobileGenJob>(id);
  }
  const p = jobPath(id);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as MobileGenJob;
  } catch {
    return null;
  }
}

export async function writeMobileGenJob(job: MobileGenJob): Promise<void> {
  job.updatedAt = new Date().toISOString();
  if (useCloudStore()) {
    await saveMobileJobRow(job.id, job);
    return;
  }
  fs.writeFileSync(jobPath(job.id), JSON.stringify(job, null, 2));
}

export async function patchMobileGenJob(
  id: string,
  patch: Partial<MobileGenJob>,
): Promise<MobileGenJob | null> {
  const job = await readMobileGenJob(id);
  if (!job) return null;
  const next = { ...job, ...patch };
  await writeMobileGenJob(next);
  return next;
}
