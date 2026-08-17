import fs from "fs";
import path from "path";
import { CRASH_DIR } from "./paths";
import { sortableId } from "./types";
import { useCloudStore } from "./cloudEnv";
import { readMobileJobRow, saveMobileJobRow } from "./neonStore";
import type { ShowStyleId } from "./showStylePresets";
import type { ScriptCharacterData } from "./types";
import { jobVoiceForSpeaker, withJobSpeakerVoice } from "./mobileJobVoices";
import type { PlateLtxCampaign } from "./mobilePlateLtxCampaign";
import type { ScratchPlateRef } from "./mobileScratch";
import { DEFAULT_DESK_ID, normalizeDeskId } from "./mobileDesk";

export { jobHasEpisodePack, mobileCandidateFolders, mobileMediaFolder } from "./mobileJobFolder";

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
  // Cast/locations are built freeform, before there's any script at all —
  // "+" adds a name+face, one at a time, reroll if it's a dud. Once
  // location_build finishes, a script gets written constrained to exactly
  // this cast and these places, rather than inventing its own and picking
  // faces for whatever it happened to write — that call lands the job
  // straight on "cast_images" (skipped in practice: the cast/locations it
  // reused are already approved). Plates build automatically; voice is a
  // deliberate step after that ("review"), not automatic — whatever's left
  // untouched there gets voiced with the AI-drafted line as-is on Generate.
  | "cast_build"
  | "location_build"
  | "cast_images"
  | "location_images"
  | "plates"
  | "review"
  | "animate"
  | "stitch"
  | "done"
  | "error";

export type MobileImageCandidate = {
  id: string;
  fileName: string;
  approved: boolean;
  /** The words that made this take — the tweak box, or the look if
   * that box was empty. More used to wipe the box, so the next tap
   * threw the working prompt away and drifted. */
  prompt?: string;
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
  voiceFile?: string;
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
  /** Leftover from the old "How long?" step. Not a planning input —
   * runtime comes from voiced lines + plates. Kept so older jobs still parse. */
  targetDurationSec: number;
  secondsPerShot: number;
  /** Cartoon 0 <-> photo 100, same scale as the desktop Image gen slider.
   * Older jobs predate the field, so readers fall back to the style preset. */
  styleRealism?: number;
  phase: MobileGenPhase;
  /** Unique speaker names — drives the cast_images approval cursor. */
  speakers: string[];
  /**
   * CAST-assigned library voice per speaker name. Lives on the Neon job so
   * the line editor can still find "Sunny Banks Nan" after Vercel /tmp
   * wipes the crash-voice manifest. Older jobs omit this.
   */
  speakerVoices?: Record<string, { voiceId: string; voiceName?: string }>;
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
  /** Series character plates (front/3/4/profile/back) per speaker name.
   * Show-level sheets — not shot plates. Older jobs omit this. */
  characterPlates?: Record<
    string,
    { fileName: string; status: "pending" | "done" | "error"; error?: string }
  >;
  shots: MobileShotUnit[];
  clips: MobileClipUnit[];
  /**
   * 20 plate+LTX position tests — one locked character, one locked place.
   * Numbered T01–T40 with optional 1–5 scores. Older jobs omit this.
   */
  plateLtxCampaign?: PlateLtxCampaign;
  /**
   * Whose phone this job belongs to. Untagged jobs are Stuie's so the
   * live pack does not vanish when Mum opens /m on the same iPad.
   */
  deskId?: string;
  /** One experiment still — many positions. Lives on /m/scratch, hidden on /m. */
  scratchPlate?: ScratchPlateRef;
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
  deskId?: string;
}): Promise<MobileGenJob> {
  const now = new Date().toISOString();
  const job: MobileGenJob = {
    id: sortableId("mgen"),
    styleId: opts.styleId,
    // Leave empty until the screenplay mints a real pack. Do not put the
    // job id here — a set folderName used to mean "pack exists" and would
    // write a story against it. Cast faces live under mobileMediaFolder.
    folderName: "",
    deskId: normalizeDeskId(opts.deskId || DEFAULT_DESK_ID),
    prompt: opts.prompt,
    targetDurationSec: opts.targetDurationSec,
    secondsPerShot: opts.secondsPerShot,
    styleRealism: opts.styleRealism,
    phase: "cast_build",
    speakers: [],
    roster: [],
    scenes: [],
    castCandidates: {},
    locationCandidates: {},
    characterPlates: {},
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

/** Jobs on this desk only. Untagged rows count as Stuie. */
export async function listMobileGenJobs(deskId: string): Promise<MobileGenJob[]> {
  const want = normalizeDeskId(deskId);
  const belongs = (job: MobileGenJob) => normalizeDeskId(job.deskId || DEFAULT_DESK_ID) === want;
  if (useCloudStore()) {
    const { listMobileJobRowsByDesk } = await import("./neonStore");
    const rows = await listMobileJobRowsByDesk<MobileGenJob>(want);
    return rows.filter(belongs);
  }
  const dir = jobsDir();
  if (!fs.existsSync(dir)) return [];
  const out: MobileGenJob[] = [];
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith(".json")) continue;
    try {
      const job = JSON.parse(fs.readFileSync(path.join(dir, name), "utf8")) as MobileGenJob;
      if (job?.id && belongs(job)) out.push(job);
    } catch {
      /* skip junk */
    }
  }
  return out.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
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

/** Merge one CAST voice onto the job. Retries so parallel CAST cards don't clobber each other. */
export async function saveMobileJobSpeakerVoice(
  id: string,
  speaker: string,
  voice: { voiceId: string; voiceName?: string },
): Promise<MobileGenJob | null> {
  const voiceId = voice.voiceId.trim();
  if (!voiceId) return readMobileGenJob(id);
  for (let i = 0; i < 8; i++) {
    const job = await readMobileGenJob(id);
    if (!job) return null;
    const speakerVoices = withJobSpeakerVoice(job.speakerVoices, speaker, {
      voiceId,
      voiceName: voice.voiceName,
    });
    await writeMobileGenJob({ ...job, speakerVoices });
    const check = await readMobileGenJob(id);
    if (jobVoiceForSpeaker(check?.speakerVoices, speaker)?.voiceId === voiceId) {
      return check;
    }
  }
  return readMobileGenJob(id);
}
