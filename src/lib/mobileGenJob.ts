import fs from "fs";
import path from "path";
import { CRASH_DIR } from "./paths";
import { newId, sortableId } from "./types";
import { useCloudStore } from "./cloudEnv";
import { readMobileJobRow, saveMobileJobRow } from "./neonStore";
import type { ShowStyleId } from "./showStylePresets";
import type { ScriptCharacterData } from "./types";
import { jobVoiceForSpeaker, withJobSpeakerVoice } from "./mobileJobVoices";
import type { PlateLtxCampaign } from "./mobilePlateLtxCampaign";
import type { ScratchClipTask, ScratchDrawTask, ScratchPlateRef } from "./mobileScratch";
import type { ScratchSong } from "./scratchSongWindow";
import type { MusicVideoTrackDraft } from "./musicVideoTrack";
import { DEFAULT_DESK_ID, normalizeDeskId } from "./mobileDesk";
import { styleStartRoster } from "./styleEpisodeProcess";
import type { StockLook } from "./stockLook";

export { jobHasEpisodePack, mobileCandidateFolders, mobileMediaFolder } from "./mobileJobFolder";

/**
 * Neon miss / one-shot read fail — the leftover pack is still in the
 * table. /m resume and song/TRACK posts show this instead of
 * "Job not found" (that read as wipe and sent people to Start directing).
 */
export const MOBILE_JOB_READ_MISS =
  "Couldn't read this episode. It's still there — don't tap Start directing.";

/**
 * Checkpointed job document for the mobile Auto Studio pipeline. A run can
 * span many /api/crash/mobile/step calls (each doing one bounded unit of
 * work), so unlike every other progress-file in this codebase this is the
 * actual state machine, not just a status readout — losing it loses the run.
 *
 * On Vercel, local disk is per-invocation scratch — a different serverless
 * instance can (and does) handle the next request, so a job written to
 * /tmp by one call is simply gone by the next (MOBILE_JOB_READ_MISS).
 * Persists through Neon when useCloudStore() is true; local disk
 * otherwise, matching every other dual-mode store in this codebase.
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
  /**
   * Plate QA checks this still failed on the take that was kept (peopleCount,
   * sameFace, anatomy…). Make keeps a drawn still and walks on, which is right
   * — but it used to clear the shot error too, so the one thing that knew the
   * plate was wrong threw the answer away. Not an error: the still is usable,
   * it just needs eyes.
   */
  qaFails?: string[];
};

/** One per dialogue beat — LTX animates per-line, not per-shot. The first
 * clip on a shot uses the plate; later clips on that shot start from the
 * previous take's last frame so a split rant does not snap back to T=0. */
export type MobileClipUnit = {
  beatId: string;
  shotId: string;
  sceneId: string;
  clipFile: string;
  /** Earlier LTX takes for this line — Generate again must stack, not replace. */
  priorClipFiles?: string[];
  /** pending = queued; running = this invoke owns the LTX job; done/error = finished. */
  clipStatus: "pending" | "running" | "done" | "error";
  error: string;
  /** Seconds this take runs — talking desk sizes the box from this, not a square thumb. */
  durationSec?: number;
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
  /** Music video only. Older jobs omit these. */
  artist?: string;
  songTitle?: string;
  /** Music video only. Pasted words — never sent as a spoken line. */
  lyrics?: string;
  /**
   * Music video only. Who sings and when (start–stop). For AI plates later.
   * Older jobs omit it.
   */
  songScript?: string;
  /** Pre-lock TRACK draft — peaks/markers before scratchSong exists. */
  trackDraft?: MusicVideoTrackDraft | null;
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
   * Names pulled off CAST on purpose. Story/kit leftover beats must not
   * put them back. Older jobs omit this.
   */
  droppedCast?: string[];
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
  /**
   * Sunny Banks Make this episode — lock then cook without Pick / Send.
   * /step plates actually draws and voices. Older jobs omit this.
   */
  sunnyAuto?: boolean;
  /**
   * Another /step still owns this Sunny cook. ISO time — ignore if past.
   * Older jobs omit it.
   */
  sunnyStepUntil?: string;
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
  /** Siray Draw in flight. Cleared when the still lands. */
  scratchDraw?: ScratchDrawTask | null;
  /** Episode plate Draw in flight — same Siray wait as scratch, not the Scratch shot. */
  plateDraw?: ScratchDrawTask | null;
  /** Scratch I2V clip in flight (Siray or Grok). Cleared when the mp4 lands. */
  scratchClip?: ScratchClipTask | null;
  /**
   * Last Send step the phone can poll. LTX is one long POST — Crash Lab
   * streams these; /m used to throw them away. Older jobs omit it.
   */
  scratchCook?: import("./scratchCookProgress").ScratchCookProgress | null;
  /** Scratch-only full song + cut list. Never an episode stitch. */
  scratchSong?: ScratchSong | null;
  /**
   * Free-film look for Support stock. Theme / colour / type ride every
   * search on this job. Older jobs omit it — searches stay per-shot.
   */
  stockLook?: StockLook | null;
  /** Hide the last still on /scratch. Plate file stays — refresh must not put it back. */
  scratchPadCleared?: boolean;
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
  artist?: string;
  songTitle?: string;
}): Promise<MobileGenJob> {
  const now = new Date().toISOString();
  const seed = styleStartRoster(opts.styleId);
  const job: MobileGenJob = {
    id: sortableId("mgen"),
    styleId: opts.styleId,
    // Leave empty until the screenplay mints a real pack. Do not put the
    // job id here — a set folderName used to mean "pack exists" and would
    // write a story against it. Cast faces live under mobileMediaFolder.
    folderName: "",
    deskId: normalizeDeskId(opts.deskId || DEFAULT_DESK_ID),
    prompt: opts.prompt,
    artist: (opts.artist || "").trim() || undefined,
    songTitle: (opts.songTitle || "").trim() || undefined,
    targetDurationSec: opts.targetDurationSec,
    secondsPerShot: opts.secondsPerShot,
    styleRealism: opts.styleRealism,
    phase: "cast_build",
    // Names only. Faces stay empty until Generate / approve.
    speakers: [...seed.speakers],
    roster: seed.speakers.map((name) => ({
      name,
      description: "",
      appearance: "",
    })),
    scenes: seed.placeNames.map((placeName) => ({
      id: newId("scene"),
      placeName,
      worldThumbKey: "",
    })),
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
  const clean = (id || "").trim();
  if (!clean) return null;
  if (useCloudStore()) {
    // A one-shot Neon miss used to 404 "Job not found" while the
    // leftover pack was still in the table. Retry before we lie.
    for (let i = 0; i < 3; i++) {
      const row = await readMobileJobRow<MobileGenJob>(clean);
      if (row?.id) return row;
      if (i < 2) await new Promise((r) => setTimeout(r, 80 * (i + 1)));
    }
    return null;
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

/**
 * Remove an episode from Your episodes. Drops the job document only —
 * faces/plates in Blob and any Crash Lab pack stay (no media wipe).
 */
export async function deleteMobileGenJob(id: string): Promise<boolean> {
  const clean = id.trim();
  if (!clean) return false;
  if (useCloudStore()) {
    const { deleteMobileJobRow } = await import("./neonStore");
    return deleteMobileJobRow(clean);
  }
  const p = jobPath(clean);
  if (!fs.existsSync(p)) return false;
  try {
    fs.unlinkSync(p);
    return true;
  } catch {
    return false;
  }
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
