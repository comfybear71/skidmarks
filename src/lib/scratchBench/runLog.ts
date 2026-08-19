/** localStorage run log for Scratch bench. */

import type { ScratchBenchRun, ScratchBenchSession, ScratchChaosId, ScratchScoreTag } from "./types";

export const SCRATCH_BENCH_STORAGE_KEY = "skidmarks.scratch.bench.v1";
export const SCRATCH_BENCH_MAX_RUNS = 40;

export function emptyBenchSession(chaosId: ScratchChaosId = "none"): ScratchBenchSession {
  return { version: 1, chaosId, runs: [], lastTags: [] };
}

export function loadBenchSession(): ScratchBenchSession {
  if (typeof window === "undefined") return emptyBenchSession();
  try {
    const raw = window.localStorage.getItem(SCRATCH_BENCH_STORAGE_KEY);
    if (!raw) return emptyBenchSession();
    const parsed = JSON.parse(raw) as Partial<ScratchBenchSession>;
    if (parsed?.version !== 1 || !Array.isArray(parsed.runs)) return emptyBenchSession();
    return {
      version: 1,
      chaosId: (parsed.chaosId as ScratchChaosId) || "none",
      runs: parsed.runs.slice(0, SCRATCH_BENCH_MAX_RUNS),
      lastTags: Array.isArray(parsed.lastTags) ? (parsed.lastTags as ScratchScoreTag[]) : [],
    };
  } catch {
    return emptyBenchSession();
  }
}

export function saveBenchSession(session: ScratchBenchSession): void {
  if (typeof window === "undefined") return;
  try {
    const next: ScratchBenchSession = {
      ...session,
      version: 1,
      runs: session.runs.slice(0, SCRATCH_BENCH_MAX_RUNS),
    };
    window.localStorage.setItem(SCRATCH_BENCH_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota / private mode */
  }
}

export function appendBenchRun(
  session: ScratchBenchSession,
  run: Omit<ScratchBenchRun, "id" | "at"> & { id?: string; at?: number },
): ScratchBenchSession {
  const full: ScratchBenchRun = {
    ...run,
    id: run.id || `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    at: run.at ?? Date.now(),
    tags: run.tags?.length ? run.tags : [],
  };
  const next: ScratchBenchSession = {
    ...session,
    runs: [full, ...session.runs].slice(0, SCRATCH_BENCH_MAX_RUNS),
  };
  saveBenchSession(next);
  return next;
}

export function updateBenchRunTags(
  session: ScratchBenchSession,
  runId: string,
  tags: ScratchScoreTag[],
): ScratchBenchSession {
  const next: ScratchBenchSession = {
    ...session,
    lastTags: tags,
    runs: session.runs.map((r) => (r.id === runId ? { ...r, tags } : r)),
  };
  saveBenchSession(next);
  return next;
}

export function setBenchChaos(session: ScratchBenchSession, chaosId: ScratchChaosId): ScratchBenchSession {
  const next = { ...session, chaosId };
  saveBenchSession(next);
  return next;
}

export function clearBenchRuns(session: ScratchBenchSession): ScratchBenchSession {
  const next = { ...session, runs: [], lastTags: [] };
  saveBenchSession(next);
  return next;
}

/** Drop one history card. Does not delete Blob / Neon media. */
export function removeBenchRun(session: ScratchBenchSession, runId: string): ScratchBenchSession {
  const id = (runId || "").trim();
  if (!id) return session;
  const next: ScratchBenchSession = {
    ...session,
    runs: session.runs.filter((r) => r.id !== id),
  };
  saveBenchSession(next);
  return next;
}
