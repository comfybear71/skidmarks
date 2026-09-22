/**
 * ElevenLabs Scribe (speech-to-text) for /m song auto-lyrics.
 *
 * Skidmarks-owned — not shared with Deck. Pattern matches Deck's
 * /api/skidmarks/transcribe route (scribe_v2, word timestamps) but lives
 * here so /m can time marquee pins from the mp3 without a paste+pin pass.
 *
 * Requires ELEVENLABS_API_KEY (or ELEVEN_LABS_API_KEY). Voice Design /
 * TTS keys without speech_to_text permission will fail with an honest
 * auth error — that is expected and must not be papered over.
 */

import { getEnv } from "./env";

export const ELEVENLABS_SCRIBE_ENV_CANDIDATES = [
  "ELEVENLABS_API_KEY",
  "ELEVEN_LABS_API_KEY",
] as const;

const ELEVENLABS_TRANSCRIBE_URL = "https://api.elevenlabs.io/v1/speech-to-text";
const ELEVENLABS_MODEL_ID = "scribe_v2";
const UPSTREAM_TIMEOUT_MS = 90_000;
const RATE_LIMIT_RETRY_DELAY_MS = 4_000;

export type ScribeWord = {
  word: string;
  startSec: number;
  endSec: number;
};

export type ScribeSuccess = {
  ok: true;
  words: ScribeWord[];
  durationSec: number | null;
};

export type ScribeFailure = {
  ok: false;
  unconfigured: boolean;
  code: string;
  error: string;
  status: number;
};

export type ScribeResult = ScribeSuccess | ScribeFailure;

export function resolveElevenLabsScribeKey(): { key: string; envVarName: string } | null {
  for (const envVarName of ELEVENLABS_SCRIBE_ENV_CANDIDATES) {
    const key = getEnv(envVarName);
    if (key) return { key, envVarName };
  }
  return null;
}

type ElevenLabsErrorDetail = {
  message: string;
  type?: string;
  code?: string;
};

function extractElevenLabsErrorDetail(payload: unknown): ElevenLabsErrorDetail | null {
  if (!payload || typeof payload !== "object") return null;
  const detail = (payload as { detail?: unknown }).detail;
  if (typeof detail === "string") return detail ? { message: detail } : null;
  if (detail && typeof detail === "object") {
    const d = detail as { message?: unknown; type?: unknown; code?: unknown; status?: unknown };
    const message = typeof d.message === "string" ? d.message : "";
    if (!message) return null;
    const type = typeof d.type === "string" ? d.type : undefined;
    const code =
      typeof d.code === "string" ? d.code : typeof d.status === "string" ? d.status : undefined;
    return { message, type, code };
  }
  return null;
}

const INVALID_AUDIO_CODES = new Set([
  "invalid_audio",
  "invalid_audio_format",
  "invalid_file_type",
  "audio_too_long",
  "audio_too_short",
]);

function classifyFailure(
  upstreamStatus: number,
  detail: ElevenLabsErrorDetail | null,
): { httpStatus: number; code: string } {
  const type = detail?.type;
  if (upstreamStatus === 401 || type === "authentication_error") {
    return { httpStatus: 401, code: "auth_error" };
  }
  if (upstreamStatus === 403 || type === "authorization_error") {
    return { httpStatus: 403, code: "auth_error" };
  }
  if (upstreamStatus === 429 || type === "rate_limit_error") {
    return { httpStatus: 429, code: "rate_limited" };
  }
  if (upstreamStatus === 402 || type === "payment_required") {
    return { httpStatus: 402, code: "payment_required" };
  }
  if (type === "validation_error" || upstreamStatus === 400 || upstreamStatus === 422) {
    const isAudio = !!detail?.code && INVALID_AUDIO_CODES.has(detail.code);
    return { httpStatus: 422, code: isAudio ? "invalid_audio" : "invalid_request" };
  }
  return { httpStatus: 502, code: "upstream_error" };
}

async function attemptScribe(file: File | Blob, fileName: string, apiKey: string): Promise<ScribeResult> {
  const form = new FormData();
  form.set("file", file, fileName || "song.mp3");
  form.set("model_id", ELEVENLABS_MODEL_ID);
  form.set("timestamps_granularity", "word");
  form.set("tag_audio_events", "true");

  let res: Response;
  try {
    res = await fetch(ELEVENLABS_TRANSCRIBE_URL, {
      method: "POST",
      headers: { "xi-api-key": apiKey },
      body: form,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    return {
      ok: false,
      unconfigured: false,
      status: 502,
      code: timedOut ? "timeout" : "network_error",
      error: timedOut
        ? `ElevenLabs Scribe did not respond within ${UPSTREAM_TIMEOUT_MS / 1000}s.`
        : `Could not reach ElevenLabs Scribe: ${err instanceof Error ? err.message : "network error"}.`,
    };
  }

  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    /* handled below */
  }

  if (!res.ok) {
    const detail = extractElevenLabsErrorDetail(payload);
    const { httpStatus, code } = classifyFailure(res.status, detail);
    return {
      ok: false,
      unconfigured: false,
      status: httpStatus,
      code,
      error: `ElevenLabs Scribe returned ${res.status}${detail ? `: ${detail.message}` : "."}`,
    };
  }

  const body = (payload ?? {}) as { words?: unknown; audio_duration_secs?: unknown };
  const rawWords = Array.isArray(body.words) ? (body.words as Record<string, unknown>[]) : [];
  const words: ScribeWord[] = rawWords
    .filter(
      (w): w is { text: string; start: number; end: number; type: string } =>
        w.type === "word" &&
        typeof w.text === "string" &&
        typeof w.start === "number" &&
        typeof w.end === "number",
    )
    .map((w) => ({ word: w.text, startSec: w.start, endSec: w.end }));

  if (!words.length) {
    return {
      ok: false,
      unconfigured: false,
      status: 502,
      code: "no_words",
      error: "ElevenLabs Scribe succeeded but returned no word-level timestamps.",
    };
  }

  return {
    ok: true,
    words,
    durationSec: typeof body.audio_duration_secs === "number" ? body.audio_duration_secs : null,
  };
}

/**
 * Transcribe an mp3 (or any audio blob) with ElevenLabs Scribe.
 * Never throws — missing key / upstream failure come back as ScribeFailure.
 */
export async function scribeSongAudio(
  file: File | Blob,
  fileName = "song.mp3",
): Promise<ScribeResult> {
  const resolved = resolveElevenLabsScribeKey();
  if (!resolved) {
    return {
      ok: false,
      unconfigured: true,
      status: 501,
      code: "missing_api_key",
      error:
        `Neither ${ELEVENLABS_SCRIBE_ENV_CANDIDATES.join(" nor ")} is set on the server — ` +
        "auto lyrics from the mp3 need ElevenLabs Scribe (speech_to_text). " +
        "Paste lyrics remains available as a legacy path. " +
        "If you just added the key on Vercel, redeploy so this function can see it.",
    };
  }

  const first = await attemptScribe(file, fileName, resolved.key);
  if (first.ok || first.code !== "rate_limited") return first;
  await new Promise((r) => setTimeout(r, RATE_LIMIT_RETRY_DELAY_MS));
  return attemptScribe(file, fileName, resolved.key);
}
