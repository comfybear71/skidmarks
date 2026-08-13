/**
 * Comfy Cloud API (https://cloud.comfy.org) — X-API-Key auth.
 * Same job shape as local Comfy; paths are under /api/.
 */
import fs from "fs";
import path from "path";
import { getEnv } from "./env";
import type { ComfyHistoryOutputs, ComfyOutputFile, ComfyUploadResult } from "./comfyClient";

export const COMFY_CLOUD_BASE = "https://cloud.comfy.org";

export function comfyCloudApiKey(): string {
  return getEnv("COMFY_CLOUD_API_KEY");
}

export function comfyCloudConfigured(): boolean {
  return Boolean(comfyCloudApiKey());
}

function cloudHeaders(json = false): HeadersInit {
  const key = comfyCloudApiKey();
  if (!key) throw new Error("COMFY_CLOUD_API_KEY missing in MY MOVIES\\.env");
  const h: Record<string, string> = { "X-API-Key": key };
  if (json) h["Content-Type"] = "application/json";
  return h;
}

export async function cloudGetJson(
  apiPath: string,
  opts?: { timeoutMs?: number },
): Promise<unknown> {
  const timeoutMs = opts?.timeoutMs ?? 45_000;
  const res = await fetch(`${COMFY_CLOUD_BASE}${apiPath}`, {
    method: "GET",
    headers: cloudHeaders(),
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Cloud GET ${apiPath} → HTTP ${res.status}: ${t.slice(0, 180)}`);
  }
  return res.json();
}

/** Upload plate or mp3 into Cloud input (multipart field name is still "image"). */
export async function cloudUploadInput(filePath: string): Promise<ComfyUploadResult> {
  const buf = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);
  const form = new FormData();
  form.append("image", new Blob([new Uint8Array(buf)]), fileName);
  form.append("type", "input");
  form.append("overwrite", "true");

  const res = await fetch(`${COMFY_CLOUD_BASE}/api/upload/image`, {
    method: "POST",
    headers: { "X-API-Key": comfyCloudApiKey() },
    body: form,
    signal: AbortSignal.timeout(120_000),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Cloud upload failed HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  let json: { name?: string; subfolder?: string; type?: string };
  try {
    json = JSON.parse(text) as typeof json;
  } catch {
    throw new Error(`Cloud upload: bad JSON — ${text.slice(0, 200)}`);
  }
  return {
    name: String(json.name || fileName),
    subfolder: String(json.subfolder || ""),
    type: String(json.type || "input"),
  };
}

export async function cloudQueuePrompt(
  prompt: Record<string, unknown>,
): Promise<{ promptId: string }> {
  const res = await fetch(`${COMFY_CLOUD_BASE}/api/prompt`, {
    method: "POST",
    headers: cloudHeaders(true),
    body: JSON.stringify({ prompt }),
    signal: AbortSignal.timeout(60_000),
  });
  const json = (await res.json().catch(() => ({}))) as {
    prompt_id?: string;
    error?: string | { message?: string };
  };
  if (!res.ok || !json.prompt_id) {
    const err =
      typeof json.error === "string"
        ? json.error
        : json.error?.message || `HTTP ${res.status}`;
    throw new Error(`Cloud queue failed: ${err}`);
  }
  return { promptId: json.prompt_id };
}

export async function cloudWaitJob(opts: {
  promptId: string;
  timeoutMs?: number;
  pollMs?: number;
  onPoll?: (info: { status: string; elapsedMs: number }) => void;
}): Promise<Record<string, ComfyHistoryOutputs>> {
  const timeoutMs = opts.timeoutMs ?? 600_000;
  const pollMs = opts.pollMs ?? 2500;
  const t0 = Date.now();

  while (Date.now() - t0 < timeoutMs) {
    const elapsedMs = Date.now() - t0;
    // Cloud: /api/jobs/{id} (plural) — not /api/history/{id}
    const job = (await cloudGetJson(`/api/jobs/${opts.promptId}`, {
      timeoutMs: 30_000,
    })) as {
      status?: string;
      outputs?: Record<string, ComfyHistoryOutputs & { video?: ComfyOutputFile[] }>;
      execution_error?: { exception_message?: string; message?: string };
      error?: string;
    };

    const status = String(job.status || "unknown").toLowerCase();
    opts.onPoll?.({ status, elapsedMs });

    if (status === "failed" || status === "error" || status === "cancelled") {
      const detail =
        job.execution_error?.exception_message ||
        job.execution_error?.message ||
        job.error ||
        `Cloud job failed (${status})`;
      throw new Error(detail);
    }

    if (status === "completed" || status === "success") {
      const outputs = job.outputs || {};
      if (Object.keys(outputs).length) return outputs as Record<string, ComfyHistoryOutputs>;
      throw new Error("Cloud job completed but no outputs");
    }

    await new Promise((r) => setTimeout(r, pollMs));
  }
  throw new Error(`Cloud job timed out after ${Math.round(timeoutMs / 1000)}s`);
}

export async function cloudDownloadView(opts: {
  filename: string;
  subfolder?: string;
  type?: string;
}): Promise<Buffer> {
  const params = new URLSearchParams({
    filename: opts.filename,
    subfolder: opts.subfolder || "",
    type: opts.type || "output",
  });
  const res = await fetch(`${COMFY_CLOUD_BASE}/api/view?${params}`, {
    method: "GET",
    headers: { "X-API-Key": comfyCloudApiKey() },
    redirect: "manual",
    signal: AbortSignal.timeout(120_000),
  });

  if (res.status === 302 || res.status === 301) {
    const loc = res.headers.get("location");
    if (!loc) throw new Error("Cloud view redirect missing Location");
    const fileRes = await fetch(loc, { signal: AbortSignal.timeout(180_000) });
    if (!fileRes.ok) {
      throw new Error(`Cloud signed download HTTP ${fileRes.status}`);
    }
    return Buffer.from(await fileRes.arrayBuffer());
  }

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Cloud view HTTP ${res.status}: ${t.slice(0, 180)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

export function pickCloudVideo(
  outputs: Record<string, ComfyHistoryOutputs>,
): ComfyOutputFile | null {
  const vids: ComfyOutputFile[] = [];
  for (const node of Object.values(outputs)) {
    const extra = node as ComfyHistoryOutputs & { video?: ComfyOutputFile[] };
    for (const v of extra.video || []) vids.push(v);
    for (const v of node.videos || []) vids.push(v);
    for (const g of node.gifs || []) {
      if (/\.mp4$/i.test(g.filename || "")) vids.push(g);
    }
    for (const im of node.images || []) {
      if (/\.mp4$/i.test(im.filename || "")) vids.push(im);
    }
  }
  if (!vids.length) return null;
  const prefer = vids.find((v) =>
    /ltx|ia2v|video/i.test(`${v.subfolder || ""}/${v.filename}`),
  );
  return prefer || vids[0]!;
}
