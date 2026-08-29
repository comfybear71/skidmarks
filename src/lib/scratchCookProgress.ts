/**
 * Live Send readout for /m. Crash Lab already streams LTX steps.
 * The phone used to throw them away and say "Cooking. Still going."
 * Client-safe — no Node fs. Job writes live in scratchCookStore.
 */

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

/** Plate Send / LTX is actually going — leftover running cuts are not “stuck”. */
export function scratchCookIsLive(
  cook: ScratchCookProgress | null | undefined,
): boolean {
  if (!cook) return false;
  return cook.step !== "done" && cook.step !== "error";
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
  const said = (cook.message || "").trim();
  switch (cook.step) {
    case "sending":
      return `${said || `Sending to ${name}`}${mute}`;
    case "resolving":
      return `${said || `Finding ${name}`}${mute}`;
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
    /** Song / LTX POST has left the phone. */
    posted?: boolean;
    /** Job cut is marked running. */
    cutRunning?: boolean;
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
  const elapsed = scratchCookElapsedSec(null, now, opts?.startedMs);
  const clock = formatCookClock(elapsed);
  const posted = opts?.posted === true;
  const cutRunning = opts?.cutRunning === true;
  if (!posted && !cutRunning) {
    if (elapsed >= 8) return `Starting the Send${mute} · ${clock}`;
    return `Sending to ${name}${mute} · ${clock}`;
  }
  if (posted && !cutRunning && elapsed >= 15) {
    return `Send has not reached LTX yet${mute} · ${clock}`;
  }
  if (elapsed >= 8) {
    return `Studio has the Send. Waiting for a step${mute} · ${clock}`;
  }
  return `Sending to ${name}${mute} · ${clock}`;
}

/** Same step with a new line must land. Running ticks throttle Neon. */
export const SCRATCH_COOK_RUNNING_WRITE_MS = 4000;

export function scratchCookShouldWrite(
  prev: ScratchCookProgress | null,
  next: { cutId?: string; step: ScratchCookStep; message?: string },
  nowMs = Date.now(),
): boolean {
  if (!prev) return true;
  if (next.step === "error" || next.step === "done") return true;
  const sameCut = (next.cutId || "") === (prev.cutId || "");
  if (!sameCut) return true;
  if (prev.step !== next.step) return true;
  if (next.step === "running") {
    const last = Date.parse(prev.updatedAt);
    return !Number.isFinite(last) || nowMs - last >= SCRATCH_COOK_RUNNING_WRITE_MS;
  }
  return String(next.message || "").trim() !== String(prev.message || "").trim();
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

