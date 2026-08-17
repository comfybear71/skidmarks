/**
 * Siray Model API — async image submit + poll.
 * Spicy models use the same paths; only the model string changes.
 * Docs: https://docs.siray.ai — base https://api.siray.ai
 */

import { getEnv } from "./env";

export const SIRAY_API_BASE = "https://api.siray.ai";

export const SIRAY_SEEDREAM_45_REF2I_SPICY = "bytedance/seedream-4.5-ref2i-spicy";
export const SIRAY_SEEDREAM_45_T2I_SPICY = "bytedance/seedream-4.5-t2i-spicy";

/** Flat $0.040/image on Siray's Spicy 4.5 post — any allowed size. */
export const SIRAY_SEEDREAM_45_SIZE = "2048x2048" as const;

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

export async function siraySubmitImageAsync(body: SubmitBody): Promise<string> {
  const res = await fetch(`${SIRAY_API_BASE}/v1/images/generations/async`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  const raw = (await res.json().catch(() => ({}))) as {
    code?: string;
    message?: string;
    data?: { task_id?: string };
    error?: string | { message?: string };
  };
  if (!res.ok) {
    const msg =
      (typeof raw.error === "string" ? raw.error : raw.error?.message) ||
      raw.message ||
      `Siray submit failed (${res.status})`;
    throw new Error(msg);
  }
  const taskId = (raw.data?.task_id || "").trim();
  if (!taskId) throw new Error(raw.message || "Siray did not return a task_id");
  return taskId;
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
  const data = (raw.data && typeof raw.data === "object" ? raw.data : raw) as Record<
    string,
    unknown
  >;
  const status = String(data.status || raw.status || "").toUpperCase() || "UNKNOWN";
  const outputsRaw = data.outputs ?? data.output ?? data.images ?? data.result;
  const outputs: string[] = [];
  if (Array.isArray(outputsRaw)) {
    for (const item of outputsRaw) {
      if (typeof item === "string" && item.trim()) outputs.push(item.trim());
      else if (item && typeof item === "object") {
        const row = item as Record<string, unknown>;
        const url = String(row.url || row.image_url || row.image || "").trim();
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
