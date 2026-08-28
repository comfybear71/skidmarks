import type { MobileGenJob } from "./mobileGenJob";

/**
 * One Add at a time per still. Send waits on this promise so it sees the
 * hang write — it must not look at a stale job and say he skipped Add.
 */
const inflight = new Map<string, Promise<MobileGenJob | null>>();

export function addPlateInFlightKey(jobId: string, shotId: string): string {
  return `${(jobId || "").trim()}:${(shotId || "").trim()}`;
}

export function peekAddPlateInFlight(
  jobId: string,
  shotId: string,
): Promise<MobileGenJob | null> | undefined {
  return inflight.get(addPlateInFlightKey(jobId, shotId));
}

export function runAddPlateInFlight(
  jobId: string,
  shotId: string,
  run: () => Promise<MobileGenJob | null>,
): Promise<MobileGenJob | null> {
  const key = addPlateInFlightKey(jobId, shotId);
  const existing = inflight.get(key);
  if (existing) return existing;
  const started = run().finally(() => {
    if (inflight.get(key) === started) inflight.delete(key);
  });
  inflight.set(key, started);
  return started;
}
