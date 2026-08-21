/**
 * Song-cut cook that survives leaving the screen.
 * LTX is one long POST. The phone drops it on a tab switch — the job stays.
 * We poll the job and pick up the next parked cut.
 */
import { readApiJson } from "./studioFetchError";
import type { MobileGenJob } from "./mobileGenJob";
import type { ScratchSongCut } from "./scratchSongWindow";

export const SONG_COOK_MS_PER_CUT = 720_000;
export const SONG_COOK_POLL_MS = 4000;

export function songCookStorageKey(jobId: string): string {
  return `skidmarks.songCook.${(jobId || "").trim()}`;
}

export function setSongCookFlag(jobId: string, on: boolean): void {
  if (typeof window === "undefined") return;
  const key = songCookStorageKey(jobId);
  try {
    if (on) window.sessionStorage.setItem(key, "1");
    else window.sessionStorage.removeItem(key);
  } catch {
    /* private mode */
  }
}

export function songCookFlagOn(jobId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(songCookStorageKey(jobId)) === "1";
  } catch {
    return false;
  }
}

export function pendingSongCuts(job: MobileGenJob | null | undefined): ScratchSongCut[] {
  return (job?.scratchSong?.cuts || []).filter(
    (c) => c.status === "pending" || c.status === "running" || !c.status,
  );
}

export function songCutById(
  job: MobileGenJob | null | undefined,
  cutId: string,
): ScratchSongCut | undefined {
  return (job?.scratchSong?.cuts || []).find((c) => c.id === cutId);
}

export async function refreshMobileJob(jobId: string): Promise<MobileGenJob | null> {
  const res = await fetch(`/api/crash/mobile/job/${encodeURIComponent(jobId)}`);
  const data = await readApiJson<{ job?: MobileGenJob; error?: string }>(res);
  return data.job || null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function waitForSongCut(opts: {
  jobId: string;
  cutId: string;
  setJob: (job: MobileGenJob) => void;
  timeoutMs?: number;
  cancelled?: () => boolean;
}): Promise<MobileGenJob | null> {
  const timeout = opts.timeoutMs ?? SONG_COOK_MS_PER_CUT;
  const started = Date.now();
  let latest: MobileGenJob | null = null;
  while (Date.now() - started < timeout) {
    if (opts.cancelled?.()) return latest;
    await sleep(SONG_COOK_POLL_MS);
    const job = await refreshMobileJob(opts.jobId);
    if (!job) continue;
    latest = job;
    opts.setJob(job);
    const cut = songCutById(job, opts.cutId);
    if (!cut || cut.status === "done" || cut.status === "error") return job;
  }
  return latest;
}

export async function cookPendingSongCuts(opts: {
  jobId: string;
  getJob: () => MobileGenJob | null;
  setJob: (job: MobileGenJob) => void;
  runCut: (cutId: string) => Promise<{ job?: MobileGenJob } | void>;
  unstickCut?: (cutId: string) => Promise<{ job?: MobileGenJob } | void>;
  onNote?: (msg: string) => void;
  cancelled?: () => boolean;
}): Promise<MobileGenJob | null> {
  setSongCookFlag(opts.jobId, true);
  let live = opts.getJob();
  try {
    for (;;) {
      if (opts.cancelled?.()) return live;
      live = opts.getJob() || live;
      const pending = pendingSongCuts(live);
      if (!pending.length) {
        setSongCookFlag(opts.jobId, false);
        opts.onNote?.("");
        return live;
      }
      const cut = pending.find((c) => c.status === "running") || pending[0]!;
      if (cut.status !== "running") {
        try {
          const data = await opts.runCut(cut.id);
          if (data?.job) {
            opts.setJob(data.job);
            live = data.job;
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message.trim() : "";
          // Tab drop / network — keep waiting. Real LTX/API errors must show.
          if (!msg || /couldn't reach studio|failed to fetch|networkerror|load failed/i.test(msg)) {
            opts.onNote?.("Connection dropped — still making clips. Waiting…");
          } else {
            opts.onNote?.(msg);
          }
        }
      } else {
        opts.onNote?.("Still on a clip. You can leave — it keeps going.");
      }
      const afterWait = await waitForSongCut({
        jobId: opts.jobId,
        cutId: cut.id,
        setJob: opts.setJob,
        cancelled: opts.cancelled,
      });
      if (afterWait) live = afterWait;
      const after = songCutById(live, cut.id);
      if (after?.status === "error") {
        opts.onNote?.(after.error?.trim() || "That clip failed.");
        continue;
      }
      if (after?.status === "running" && !after.clipFile && opts.unstickCut) {
        opts.onNote?.("That cut sat too long — sending it again.");
        try {
          const stuck = await opts.unstickCut(cut.id);
          if (stuck?.job) {
            opts.setJob(stuck.job);
            live = stuck.job;
          }
        } catch {
          /* next loop retries */
        }
      }
    }
  } catch (e) {
    opts.onNote?.(e instanceof Error ? e.message : "Couldn't cook that cut");
    return opts.getJob() || live;
  }
}
