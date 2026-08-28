/**
 * Song-cut cook that survives leaving the screen.
 * LTX is one long POST. The phone drops it on a tab switch — the job stays.
 * We poll the job and pick up the next parked cut.
 */
import { readApiJson } from "./studioFetchError";
import type { MobileGenJob } from "./mobileGenJob";
import type { ScratchSongCut } from "./scratchSongWindow";
import { songCookAlert, songCookNote, type SongCookAlert } from "./musicVideoSong";

const SONG_COOK_PAGE_TITLE = "Skidmarks — Vibe Director";
const pingedAlerts = new Set<string>();

/** Ask once when they tap Generate — needed before we can ping the phone. */
export function askSongCookNotifyPermission(): void {
  if (typeof window === "undefined" || typeof Notification === "undefined") return;
  if (Notification.permission === "default") {
    void Notification.requestPermission();
  }
}

export function restoreSongCookTitle(): void {
  if (typeof document === "undefined") return;
  if (document.title.startsWith("FAIL ·") || document.title.startsWith("STUCK ·")) {
    document.title = SONG_COOK_PAGE_TITLE;
  }
}

/** Tab title + phone notification when a clip fails or the cook is stuck. */
export function notifySongCookProblem(alert: SongCookAlert): void {
  if (typeof window === "undefined") return;
  if (alert.kind !== "failed" && alert.kind !== "stuck") {
    restoreSongCookTitle();
    return;
  }
  document.title = `${alert.kind === "failed" ? "FAIL" : "STUCK"} · ${alert.short}`;
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  const key = `skidmarks.songCookPing.${alert.fingerprint}`;
  if (pingedAlerts.has(key)) return;
  try {
    if (window.sessionStorage.getItem(key) === "1") {
      pingedAlerts.add(key);
      return;
    }
    window.sessionStorage.setItem(key, "1");
  } catch {
    /* private mode — still ping once this session */
  }
  pingedAlerts.add(key);
  try {
    new Notification(alert.title, {
      body: alert.detail || alert.short,
      tag: alert.fingerprint,
    });
  } catch {
    /* unsupported */
  }
}

function pushCookStatus(
  opts: { onNote?: (msg: string) => void },
  cuts: Pick<ScratchSongCut, "id" | "status" | "error" | "clipFile">[],
  extra?: { cooking?: boolean },
): SongCookAlert {
  const alert = songCookAlert(cuts, { cooking: extra?.cooking ?? true });
  if (alert.kind === "failed" || alert.kind === "stuck") {
    notifySongCookProblem(alert);
  }
  opts.onNote?.(songCookNote(alert));
  return alert;
}

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

const cookStopIds = new Set<string>();

function cookStopKey(jobId: string): string {
  return `skidmarks.songCookStop.${(jobId || "").trim()}`;
}

/** ✕ / Redo — stop the phone send loop so the desk is not locked. */
export function requestSongCookStop(jobId: string): void {
  const id = (jobId || "").trim();
  if (!id) return;
  cookStopIds.add(id);
  setSongCookFlag(id, false);
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(cookStopKey(id), "1");
  } catch {
    /* private mode */
  }
}

export function songCookStopRequested(jobId: string): boolean {
  const id = (jobId || "").trim();
  if (!id) return false;
  if (cookStopIds.has(id)) return true;
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(cookStopKey(id)) === "1";
  } catch {
    return false;
  }
}

export function clearSongCookStop(jobId: string): void {
  const id = (jobId || "").trim();
  if (!id) return;
  cookStopIds.delete(id);
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(cookStopKey(id));
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
  const pending = (job?.scratchSong?.cuts || []).filter(
    (c) => c.status === "pending" || c.status === "running" || !c.status,
  );
  return pending
    .map((c, i) => ({ c, i }))
    .sort((a, b) => {
      const as = Number(a.c.startSec) || 0;
      const bs = Number(b.c.startSec) || 0;
      if (as !== bs) return as - bs;
      return a.i - b.i;
    })
    .map(({ c }) => c);
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
    if (opts.cancelled?.() || songCookStopRequested(opts.jobId)) return latest;
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
      if (opts.cancelled?.() || songCookStopRequested(opts.jobId)) return live;
      live = opts.getJob() || live;
      const pending = pendingSongCuts(live);
      if (!pending.length) {
        const doneCuts = live?.scratchSong?.cuts || [];
        const doneAlert = songCookAlert(doneCuts, { cooking: false });
        if (doneAlert.kind === "failed" || doneAlert.kind === "stuck") {
          notifySongCookProblem(doneAlert);
          opts.onNote?.(songCookNote(doneAlert));
        } else {
          opts.onNote?.("");
        }
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
        pushCookStatus(opts, live?.scratchSong?.cuts || [], { cooking: true });
      }

      live = opts.getJob() || live;
      const afterStart = songCutById(live, cut.id);
      // Hard fail and never left pending — don't sit for 12 minutes.
      if (startFailed && afterStart && (afterStart.status === "pending" || !afterStart.status)) {
        continue;
      }
      if (afterStart?.status === "error") {
        pushCookStatus(opts, live?.scratchSong?.cuts || [], { cooking: true });
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
        pushCookStatus(opts, live?.scratchSong?.cuts || [], { cooking: true });
        continue;
      }
      if (after?.status === "done") {
        continue;
      }
      if (after?.status === "running" && !after.clipFile && opts.unstickCut) {
        const n = (unstickCount[cut.id] || 0) + 1;
        unstickCount[cut.id] = n;
        if (n > SONG_COOK_MAX_UNSTICK) {
          pushCookStatus(opts, live?.scratchSong?.cuts || [], { cooking: false });
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
