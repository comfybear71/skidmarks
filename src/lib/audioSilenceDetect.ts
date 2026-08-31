/**
 * Runs ffmpeg's silencedetect filter over a local audio file and parses the
 * on/off timestamps it prints to stderr. This is the one real "listen" on
 * the mp3 — everything else in songVocalListen.ts is pure comparison math.
 *
 * silencedetect finds near-silence by amplitude. It is not a vocal
 * detector — see songVocalListen.ts for the honest limit this implies.
 */
import { spawnSync } from "child_process";
import { resolveFfmpeg } from "./mobileStitch";
import type { SilenceWindow } from "./songVocalListen";

/** Below this loudness counts as silence. Quiet mixes may need a lower (more negative) value. */
export const SILENCE_NOISE_DB = "-30dB";
/** Ignore gaps shorter than this — word breaks and breaths, not real quiet. */
export const SILENCE_MIN_DURATION_SEC = 0.35;

/**
 * Parse ffmpeg's `-af silencedetect` stderr output.
 * Lines look like:
 *   [silencedetect @ 0x...] silence_start: 12.345
 *   [silencedetect @ 0x...] silence_end: 15.678 | silence_duration: 3.333
 * If the file ends while still silent, ffmpeg only prints silence_start —
 * durationMs (when given) closes that trailing window at the end of the file.
 */
export function parseSilenceDetectOutput(stderr: string, durationMs?: number): SilenceWindow[] {
  const startRe = /silence_start:\s*(-?[0-9.]+)/;
  const endRe = /silence_end:\s*(-?[0-9.]+)/;
  const windows: SilenceWindow[] = [];
  let pendingStartMs: number | null = null;
  for (const line of String(stderr || "").split("\n")) {
    const startHit = line.match(startRe);
    if (startHit) {
      pendingStartMs = Math.max(0, Math.round(parseFloat(startHit[1]!) * 1000));
      continue;
    }
    const endHit = line.match(endRe);
    if (endHit && pendingStartMs !== null) {
      const endMs = Math.max(0, Math.round(parseFloat(endHit[1]!) * 1000));
      if (endMs > pendingStartMs) windows.push({ startMs: pendingStartMs, endMs });
      pendingStartMs = null;
    }
  }
  if (pendingStartMs !== null && typeof durationMs === "number" && durationMs > pendingStartMs) {
    windows.push({ startMs: pendingStartMs, endMs: durationMs });
  }
  return windows;
}

export type DetectSilenceResult = { silences: SilenceWindow[]; raw: string };

export function detectSilenceWindows(
  audioPath: string,
  opts?: { noiseDb?: string; minDurationSec?: number; durationMs?: number; timeoutMs?: number },
): DetectSilenceResult {
  const { bin, tried } = resolveFfmpeg();
  const noiseDb = opts?.noiseDb || SILENCE_NOISE_DB;
  const minDur = opts?.minDurationSec ?? SILENCE_MIN_DURATION_SEC;
  const args = [
    "-i",
    audioPath,
    "-af",
    `silencedetect=noise=${noiseDb}:d=${minDur}`,
    "-f",
    "null",
    "-",
  ];
  // spawnSync (not execFileSync) because silencedetect writes its findings to
  // stderr on a normal, zero-exit run — execFileSync only returns stdout.
  const res = spawnSync(bin || "ffmpeg", args, {
    timeout: opts?.timeoutMs ?? 120_000,
    encoding: "utf8",
  });
  if (res.error) {
    throw new Error(
      bin
        ? `ffmpeg silencedetect failed using ${bin} — ${res.error.message}`
        : `No packaged ffmpeg found and none on PATH — ${res.error.message}. Looked in: ${tried.join(", ")}`,
    );
  }
  const raw = res.stderr || "";
  return { silences: parseSilenceDetectOutput(raw, opts?.durationMs), raw };
}
