/**
 * Siray Model API — async image submit + poll.
 * Spicy models use the same paths; only the model string changes.
 * Docs: https://docs.siray.ai — base https://api.siray.ai
 */

import { getEnv } from "./env";
import { SIRAY_I2V_MODELS, sirayI2vSpec } from "./sirayI2v";

export {
  clampSirayI2vDurationSec,
  isSirayI2vId,
  parseScratchClipEngine,
  SIRAY_I2V_DEFAULT,
  SIRAY_I2V_MODELS,
  sirayI2vSpec,
  type SirayI2vId,
  type SirayI2vSpec,
} from "./sirayI2v";

export const SIRAY_API_BASE = "https://api.siray.ai";

export const SIRAY_SEEDREAM_45_REF2I_SPICY = "bytedance/seedream-4.5-ref2i-spicy";
export const SIRAY_SEEDREAM_45_T2I_SPICY = "bytedance/seedream-4.5-t2i-spicy";
export const SIRAY_SEEDANCE_20_I2V_SPICY = sirayI2vSpec("seedance-20").model;
export const SIRAY_SEEDANCE_25_I2V_SPICY = sirayI2vSpec("seedance-25").model;
export const SIRAY_WAN_27_I2V_SPICY = sirayI2vSpec("wan-27").model;
export const SIRAY_WAN_30_I2V_SPICY = sirayI2vSpec("wan-30").model;

/** Flat $0.040/image on Siray's Spicy 4.5 post — any allowed size. */
export const SIRAY_SEEDREAM_45_SIZE = "2048x2048" as const;

/** Seedance 2.0 i2v Spicy — integer seconds only. */
export const SIRAY_SEEDANCE_I2V_MIN_SEC = SIRAY_I2V_MODELS[0].minSec;
export const SIRAY_SEEDANCE_I2V_MAX_SEC = SIRAY_I2V_MODELS[0].maxSec;

export type SirayTaskStatus =
  | "NOT_START"
  | "SUBMITTED"
  | "QUEUED"
  | "IN_PROGRESS"
  | "SUCCESS"
  | "FAILURE"
  | string;

export function sirayApiKey(): string {
  return getEnv("SIRAY_API_KEY") || getEnv("SIRAY_API_TOKEN");
}

export function sirayConfigured(): boolean {
  return Boolean(sirayApiKey());
}

function authHeaders(): HeadersInit {
  const key = sirayApiKey();
  if (!key) {
    throw new Error(
      "Missing SIRAY_API_KEY. Create one at https://console.siray.ai/keys and add it to .env / Vercel.",
    );
  }
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

type SubmitBody = {
  model: string;
  prompt: string;
  size: string;
  images?: string[];
};

function parseSirayTaskId(raw: Record<string, unknown>): string {
  const data = raw.data;
  if (data && typeof data === "object") {
    const nested = data as Record<string, unknown>;
    const fromNested = String(nested.task_id || nested.taskId || nested.id || "").trim();
    if (fromNested) return fromNested;
  }
  if (typeof data === "string" && data.trim()) return data.trim();
  return String(raw.task_id || raw.taskId || raw.id || "").trim();
}

function siraySubmitFailure(
  raw: Record<string, unknown>,
  res: Response,
  fallback: string,
): string {
  const code = String(raw.code || "").trim();
  const msg =
    (typeof raw.error === "string" ? raw.error : (raw.error as { message?: string })?.message) ||
    String(raw.message || "").trim() ||
    fallback;
  if (code && code.toLowerCase() !== "success") {
    return msg && msg !== code ? `${code}: ${msg}` : code;
  }
  return msg || fallback;
}

function assertSirayTaskId(raw: Record<string, unknown>, res: Response, label: string): string {
  const code = String(raw.code || "").trim().toLowerCase();
  if (code && code !== "success") {
    throw new Error(siraySubmitFailure(raw, res, `Siray ${label} submit rejected`));
  }
  const taskId = parseSirayTaskId(raw);
  if (taskId) return taskId;
  const snippet = JSON.stringify(raw).slice(0, 280);
  throw new Error(
    siraySubmitFailure(
      raw,
      res,
      `Siray did not return a ${label} task_id (${res.status})${snippet ? `: ${snippet}` : ""}`,
    ),
  );
}

export async function siraySubmitImageAsync(body: SubmitBody): Promise<string> {
  const res = await fetch(`${SIRAY_API_BASE}/v1/images/generations/async`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(siraySubmitFailure(raw, res, `Siray submit failed (${res.status})`));
  }
  return assertSirayTaskId(raw, res, "image");
}

export type SirayPollResult = {
  status: SirayTaskStatus;
  progress?: number;
  outputs: string[];
  failReason: string;
  raw: unknown;
};

export async function sirayPollImageTask(taskId: string): Promise<SirayPollResult> {
  const id = encodeURIComponent(taskId.trim());
  const res = await fetch(`${SIRAY_API_BASE}/v1/images/generations/async/${id}`, {
    method: "GET",
    headers: authHeaders(),
  });
  const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg =
      (typeof raw.message === "string" && raw.message) ||
      (typeof raw.error === "string" && raw.error) ||
      `Siray poll failed (${res.status})`;
    throw new Error(msg);
  }
  return parseSirayPoll(raw);
}

export async function sirayWaitImageOutputs(
  taskId: string,
  opts?: { intervalMs?: number; timeoutMs?: number },
): Promise<string[]> {
  const intervalMs = opts?.intervalMs ?? 4000;
  const timeoutMs = opts?.timeoutMs ?? 180_000;
  const started = Date.now();
  for (;;) {
    const tick = await sirayPollImageTask(taskId);
    if (tick.status === "SUCCESS") {
      if (!tick.outputs.length) throw new Error("Siray SUCCESS but no output URLs");
      return tick.outputs;
    }
    if (tick.status === "FAILURE") {
      throw new Error(tick.failReason || "Siray generation failed");
    }
    if (Date.now() - started > timeoutMs) {
      throw new Error(`Siray timed out after ${Math.round(timeoutMs / 1000)}s (last: ${tick.status})`);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

export async function sirayDownloadUrl(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Couldn't download Siray output (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

type VideoSubmitBody = {
  model: string;
  prompt: string;
  image: string;
  duration: number;
  size: string;
  aspect_ratio?: string;
  audio_enable?: boolean;
  prompt_expansion_enable?: boolean;
  seed?: number;
};

export async function siraySubmitVideoAsync(body: VideoSubmitBody): Promise<string> {
  const payload: VideoSubmitBody = {
    ...body,
    duration: Math.round(body.duration),
  };
  const res = await fetch(`${SIRAY_API_BASE}/v1/video/generations`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(siraySubmitFailure(raw, res, `Siray video submit failed (${res.status})`));
  }
  return assertSirayTaskId(raw, res, "video");
}

export async function sirayPollVideoTask(taskId: string): Promise<SirayPollResult> {
  const id = encodeURIComponent(taskId.trim());
  const res = await fetch(`${SIRAY_API_BASE}/v1/video/generations/${id}`, {
    method: "GET",
    headers: authHeaders(),
  });
  const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg =
      (typeof raw.message === "string" && raw.message) ||
      (typeof raw.error === "string" && raw.error) ||
      `Siray video poll failed (${res.status})`;
    throw new Error(msg);
  }
  return parseSirayPoll(raw);
}

function parseSirayPoll(raw: Record<string, unknown>): SirayPollResult {
  const data = (raw.data && typeof raw.data === "object" ? raw.data : raw) as Record<
    string,
    unknown
  >;
  const status = String(data.status || raw.status || "").toUpperCase() || "UNKNOWN";
  const outputsRaw = data.outputs ?? data.output ?? data.videos ?? data.result;
  const outputs: string[] = [];
  if (Array.isArray(outputsRaw)) {
    for (const item of outputsRaw) {
      if (typeof item === "string" && item.trim()) outputs.push(item.trim());
      else if (item && typeof item === "object") {
        const row = item as Record<string, unknown>;
        const url = String(row.url || row.video_url || row.video || row.image_url || "").trim();
        if (url) outputs.push(url);
      }
    }
  } else if (typeof outputsRaw === "string" && outputsRaw.trim()) {
    outputs.push(outputsRaw.trim());
  }
  const failReason = String(
    data.fail_reason || data.failReason || data.error || raw.message || "",
  ).trim();
  const progress =
    typeof data.progress === "number"
      ? data.progress
      : typeof raw.progress === "number"
        ? (raw.progress as number)
        : undefined;
  return { status, progress, outputs, failReason, raw };
}

export async function sirayWaitVideoOutputs(
  taskId: string,
  opts?: { intervalMs?: number; timeoutMs?: number },
): Promise<string[]> {
  const intervalMs = opts?.intervalMs ?? 5000;
  const timeoutMs = opts?.timeoutMs ?? 480_000;
  const started = Date.now();
  for (;;) {
    const tick = await sirayPollVideoTask(taskId);
    if (tick.status === "SUCCESS") {
      if (!tick.outputs.length) throw new Error("Siray video SUCCESS but no output URLs");
      return tick.outputs;
    }
    if (tick.status === "FAILURE") {
      throw new Error(tick.failReason || "Siray video generation failed");
    }
    if (Date.now() - started > timeoutMs) {
      throw new Error(`Siray video timed out after ${Math.round(timeoutMs / 1000)}s (last: ${tick.status})`);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
