/**
 * Live Send readout for /m. Crash Lab already streams LTX steps.
 * The phone used to throw them away and say "Cooking. Still going."
 * Persist the last step on the job so a poll can paint it — LTX is one
 * long POST, and leaving the tab drops the fetch.
 */
import { patchMobileGenJob, readMobileGenJob } from "./mobileGenJob";

export type ScratchCookEngine = "ltx" | "h3" | "siray";

export type ScratchCookStep =
  | "sending"
  | "resolving"
  | "uploading"
  | "converting"
  | "queued"
  | "running"
  | "pulling"
  | "done"
  | "error";

export type ScratchCookProgress = {
  cutId?: string;
  engine: ScratchCookEngine;
  step: ScratchCookStep;
  message?: string;
  mute?: boolean;
  startedAt: string;
  updatedAt: string;
};

const STEPS: ScratchCookStep[] = [
  "sending",
  "resolving",
  "uploading",
  "converting",
  "queued",
  "running",
  "pulling",
  "done",
  "error",
];

const ENGINES: ScratchCookEngine[] = ["ltx", "h3", "siray"];

function asStep(raw: unknown): ScratchCookStep | "" {
  const s = String(raw || "").trim();
  return (STEPS as string[]).includes(s) ? (s as ScratchCookStep) : "";
}

function asEngine(raw: unknown): ScratchCookEngine | "" {
  const s = String(raw || "").trim();
  return (ENGINES as string[]).includes(s) ? (s as ScratchCookEngine) : "";
}

export function parseScratchCook(raw: unknown): ScratchCookProgress | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const engine = asEngine(o.engine);
  const step = asStep(o.step);
  const startedAt = String(o.startedAt || "").trim();
  if (!engine || !step || !startedAt) return null;
  const cutId = String(o.cutId || "").trim();
  const message = String(o.message || "").trim();
  return {
    engine,
    step,
    startedAt,
    updatedAt: String(o.updatedAt || startedAt).trim() || startedAt,
    ...(cutId ? { cutId } : {}),
    ...(message ? { message } : {}),
    ...(o.mute === true ? { mute: true } : {}),
  };
}

export function scratchCookEngineName(engine: ScratchCookEngine): string {
  if (engine === "h3") return "H3";
  if (engine === "siray") return "Siray";
  return "LTX";
}

export function formatCookClock(sec: number): string {
  const n = Number.isFinite(sec) ? Math.max(0, Math.floor(sec)) : 0;
  const m = Math.floor(n / 60);
  const s = n % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function scratchCookElapsedSec(
  cook: Pick<ScratchCookProgress, "startedAt"> | null | undefined,
  nowMs = Date.now(),
  startedMs?: number,
): number {
  const fromCook = cook?.startedAt ? Date.parse(cook.startedAt) : NaN;
  const start = Number.isFinite(fromCook) ? fromCook : startedMs ?? nowMs;
  return Math.max(0, (nowMs - start) / 1000);
}

export function humanScratchCookLine(cook: ScratchCookProgress): string {
  if (cook.step === "error") return (cook.message || "Clip failed").trim();
  const name = scratchCookEngineName(cook.engine);
  const mute = cook.mute ? " — mouths shut" : "";
  switch (cook.step) {
    case "sending":
      return `Sending to ${name}${mute}`;
    case "resolving":
      return `Finding ${name}${mute}`;
    case "uploading":
      return `Uploading the still${mute}`;
    case "converting":
      return `Building the cook${mute}`;
    case "queued":
      return `In the ${name} queue${mute}`;
    case "running":
      return `${name} cooking${mute}`;
    case "pulling":
      return `Bringing the clip back${mute}`;
    case "done":
      return "Clip landed";
    default:
      return `${name} cooking${mute}`;
  }
}

export function formatScratchCookNote(
  cook: ScratchCookProgress | null | undefined,
  opts?: {
    nowMs?: number;
    startedMs?: number;
    engine?: ScratchCookEngine;
    mute?: boolean;
  },
): string {
  const now = opts?.nowMs ?? Date.now();
  if (cook?.step === "error") return humanScratchCookLine(cook);
  if (cook) {
    const clock = formatCookClock(scratchCookElapsedSec(cook, now, opts?.startedMs));
    return `${humanScratchCookLine(cook)} · ${clock}`;
  }
  const engine = opts?.engine || "ltx";
  const name = scratchCookEngineName(engine);
  const mute = opts?.mute ? " — mouths shut" : "";
  const clock = formatCookClock(scratchCookElapsedSec(null, now, opts?.startedMs));
  return `Sending to ${name}${mute} · ${clock}`;
}

/** Short Send-button face. Clock once it is actually cooking. */
export function scratchCookButtonLabel(
  cook: ScratchCookProgress | null | undefined,
  busy: boolean,
  opts?: { nowMs?: number; startedMs?: number },
): string {
  if (!busy) return "Send";
  if (cook?.step === "error") return "Failed";
  if (cook?.step === "queued") return "Queued…";
  if (cook?.step === "pulling") return "Pulling…";
  if (cook?.step === "uploading") return "Uploading…";
  if (cook?.step === "running" || cook?.step === "converting") {
    return formatCookClock(scratchCookElapsedSec(cook, opts?.nowMs, opts?.startedMs));
  }
  return "Sending…";
}

export function h3PhaseToCookStep(phase: string): ScratchCookStep {
  const p = (phase || "").toLowerCase();
  if (p === "queued" || p === "queueing" || p === "pending" || p === "preparing") {
    return "queued";
  }
  if (p === "processing" || p === "running") return "running";
  return "running";
}

export async function writeScratchCookProgress(
  jobId: string,
  next: {
    cutId?: string;
    engine: ScratchCookEngine;
    step: ScratchCookStep;
    message?: string;
    mute?: boolean;
    startedAt?: string;
  },
): Promise<void> {
  const id = (jobId || "").trim();
  if (!id) return;
  try {
    const job = await readMobileGenJob(id);
    if (!job) return;
    const prev = parseScratchCook(job.scratchCook);
    const now = new Date().toISOString();
    const sameCut = Boolean(prev && (next.cutId || "") === (prev.cutId || ""));
    if (
      prev &&
      sameCut &&
      prev.step === next.step &&
      next.step !== "error" &&
      next.step !== "done"
    ) {
      return;
    }
    const cook: ScratchCookProgress = {
      engine: next.engine,
      step: next.step,
      startedAt: next.startedAt || (sameCut && prev?.startedAt) || now,
      updatedAt: now,
      ...(next.cutId ? { cutId: next.cutId } : prev?.cutId ? { cutId: prev.cutId } : {}),
      ...(next.message ? { message: next.message } : {}),
      ...((next.mute ?? prev?.mute) ? { mute: true } : {}),
    };
    await patchMobileGenJob(id, { scratchCook: cook });
  } catch {
    /* progress must not break the cook */
  }
}

export async function clearScratchCookProgress(jobId: string): Promise<void> {
  const id = (jobId || "").trim();
  if (!id) return;
  try {
    await patchMobileGenJob(id, { scratchCook: null });
  } catch {
    /* ignore */
  }
}
