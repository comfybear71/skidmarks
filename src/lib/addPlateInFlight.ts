import type { MobileGenJob } from "./mobileGenJob";

/**
 * One Add at a time per still. Send waits on this promise so it sees the
 * hang write — it must not look at a stale job and say he skipped Add.
 */
const inflight = new Map<string, Promise<MobileGenJob | null>>();
const lastLanded = new Map<string, MobileGenJob>();

export function addPlateInFlightKey(jobId: string, shotId: string): string {
  return `${(jobId || "").trim()}:${(shotId || "").trim()}`;
}

export function peekAddPlateInFlight(
  jobId: string,
  shotId: string,
): Promise<MobileGenJob | null> | undefined {
  return inflight.get(addPlateInFlightKey(jobId, shotId));
}

/** Add already finished — Send still needs this job before React re-renders. */
export function lastAddPlateJob(
  jobId: string,
  shotId: string,
): MobileGenJob | undefined {
  return lastLanded.get(addPlateInFlightKey(jobId, shotId));
}

/** Keep the hung write when a stale parent job arrives next. */
export function preferLiveSongJob(
  live: MobileGenJob | undefined,
  incoming: MobileGenJob | null | undefined,
): MobileGenJob | undefined {
  if (!incoming) return live;
  if (!live || live.id !== incoming.id) return incoming;
  const liveAt = live.updatedAt || "";
  const inAt = incoming.updatedAt || "";
  if (inAt > liveAt) return incoming;
  if (liveAt > inAt) return live;
  const hangs = (job: MobileGenJob) => (job.scratchSong?.plateTimings || []).length;
  return hangs(incoming) >= hangs(live) ? incoming : live;
}

export function runAddPlateInFlight(
  jobId: string,
  shotId: string,
  run: () => Promise<MobileGenJob | null>,
): Promise<MobileGenJob | null> {
  const key = addPlateInFlightKey(jobId, shotId);
  const existing = inflight.get(key);
  if (existing) return existing;
  const started = run()
    .then((job) => {
      if (job) lastLanded.set(key, job);
      return job;
    })
    .finally(() => {
      if (inflight.get(key) === started) inflight.delete(key);
    });
  inflight.set(key, started);
  return started;
}
