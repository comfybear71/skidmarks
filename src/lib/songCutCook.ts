/**
 * Song-cut cook that survives leaving the screen.
 * LTX is one long POST. The phone drops it on a tab switch — the job stays.
 * We poll the job and pick up the next parked cut.
 */
import { readApiJson } from "./studioFetchError";
import type { MobileGenJob } from "./mobileGenJob";
import type { ScratchSongCut } from "./scratchSongWindow";

/** How long we wait for a cut that is actually running on the server. */
export const SONG_COOK_MS_PER_CUT = 720_000;
/** After a failed start (still pending), don't sit for 12 minutes — retry sooner. */
export const SONG_COOK_PENDING_WAIT_MS = 20_000;
export const SONG_COOK_POLL_MS = 4000;
/** Unstick the same stuck cut this many times, then stop and show an error. */
export const SONG_COOK_MAX_UNSTICK = 2;

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
  try {
    const res = await fetch(`/api/crash/mobile/job/${encodeURIComponent(jobId)}`);
    const data = await readApiJson<{ job?: MobileGenJob; error?: string }>(res);
    return data.job || null;
  } catch {
    return null;
  }
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
  /** If true, return early when the cut is still pending (start never stuck). */
  bailIfPending?: boolean;
}): Promise<MobileGenJob | null> {
  const timeout = opts.timeoutMs ?? SONG_COOK_MS_PER_CUT;
  const started = Date.now();
  let latest: MobileGenJob | null = null;
  let sawRunning = false;
  while (Date.now() - started < timeout) {
    if (opts.cancelled?.()) return latest;
    await sleep(SONG_COOK_POLL_MS);
    const job = await refreshMobileJob(opts.jobId);
    if (!job) continue;
    latest = job;
    opts.setJob(job);
    const cut = songCutById(job, opts.cutId);
    if (!cut || cut.status === "done" || cut.status === "error") return job;
    if (cut.status === "running") sawRunning = true;
    if (opts.bailIfPending && !sawRunning && cut.status === "pending" && Date.now() - started >= SONG_COOK_PENDING_WAIT_MS) {
      return job;
    }
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
  const unstickCount: Record<string, number> = {};
  try {
    for (;;) {
      if (opts.cancelled?.()) return live;
      live = opts.getJob() || live;
      const pending = pendingSongCuts(live);
      if (!pending.length) {
        opts.onNote?.("");
        return live;
      }
      const cut = pending.find((c) => c.status === "running") || pending[0]!;
      let startFailed = false;
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
            startFailed = true;
          }
        }
      } else {
        const doneN = (live?.scratchSong?.cuts || []).filter((c) => c.status === "done").length;
        const total = (live?.scratchSong?.cuts || []).length;
        opts.onNote?.(
          total
            ? `Still on a clip (${doneN}/${total}). You can leave — it keeps going.`
            : "Still on a clip. You can leave — it keeps going.",
        );
      }

      live = opts.getJob() || live;
      const afterStart = songCutById(live, cut.id);
      // Hard fail and never left pending — don't sit for 12 minutes.
      if (startFailed && afterStart && (afterStart.status === "pending" || !afterStart.status)) {
        continue;
      }
      if (afterStart?.status === "error") {
        opts.onNote?.(afterStart.error?.trim() || "That clip failed.");
        continue;
      }
      if (afterStart?.status === "done") {
        continue;
      }

      const waitingOnRunning = afterStart?.status === "running";
      const afterWait = await waitForSongCut({
        jobId: opts.jobId,
        cutId: cut.id,
        setJob: opts.setJob,
        cancelled: opts.cancelled,
        bailIfPending: !waitingOnRunning,
        timeoutMs: waitingOnRunning ? SONG_COOK_MS_PER_CUT : SONG_COOK_PENDING_WAIT_MS,
      });
      if (afterWait) live = afterWait;
      const after = songCutById(live, cut.id);
      if (after?.status === "error") {
        opts.onNote?.(after.error?.trim() || "That clip failed.");
        continue;
      }
      if (after?.status === "done") {
        continue;
      }
      if (after?.status === "running" && !after.clipFile && opts.unstickCut) {
        const n = (unstickCount[cut.id] || 0) + 1;
        unstickCount[cut.id] = n;
        if (n > SONG_COOK_MAX_UNSTICK) {
          opts.onNote?.(
            "That clip is stuck on the server. Close this tab and open the episode again — don't Start directing.",
          );
          return live;
        }
        opts.onNote?.("That cut sat too long — sending it again.");
        try {
          const stuck = await opts.unstickCut(cut.id);
          if (stuck?.job) {
            opts.setJob(stuck.job);
            live = stuck.job;
          }
        } catch (e) {
          opts.onNote?.(e instanceof Error ? e.message : "Couldn't unstick that clip.");
          return live;
        }
      }
    }
  } catch (e) {
    opts.onNote?.(e instanceof Error ? e.message : "Couldn't make that cut");
    return opts.getJob() || live;
  } finally {
    setSongCookFlag(opts.jobId, false);
  }
}
