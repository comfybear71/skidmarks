/**
 * xAI Imagine video — submit + poll.
 * Docs: https://docs.x.ai/developers/model-capabilities/video/image-to-video
 * POST /v1/videos/generations → { request_id }
 * GET  /v1/videos/{request_id} → pending | done | failed | expired
 */

import { getEnv } from "./env";
import {
  GROK_I2V_MODEL,
  GROK_I2V_RESOLUTION,
  snapGrokI2vDurationSec,
} from "./grokI2v";

const XAI_VIDEO_BASE = "https://api.x.ai/v1";

export function grokVideoKey(): string {
  return getEnv("XAI_API_KEY") || getEnv("GROK_API_KEY");
}

export function grokVideoConfigured(): boolean {
  return Boolean(grokVideoKey());
}

function authHeaders(): HeadersInit {
  const key = grokVideoKey();
  if (!key) {
    throw new Error(
      "Missing XAI_API_KEY. Add it to your environment variables then restart Studio.",
    );
  }
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

function xaiVideoError(status: number, data: unknown): string {
  const d = data as {
    error?: string | { message?: string; code?: string };
    message?: string;
  };
  let detail = "";
  if (typeof d?.error === "string") detail = d.error;
  else if (d?.error && typeof d.error === "object") {
    detail = [d.error.code, d.error.message].filter(Boolean).join(": ");
  } else if (d?.message) detail = d.message;
  else {
    try {
      detail = JSON.stringify(data);
    } catch {
      detail = "";
    }
  }
  if (/expired/i.test(detail)) {
    return (
      detail +
      " — Make a new key at https://console.x.ai → API Keys, paste as XAI_API_KEY, then restart Studio."
    );
  }
  if (status === 403) {
    return (
      (detail || "xAI refused the request (403)") +
      " — Check credits + that this API key still works at https://console.x.ai"
    );
  }
  return detail || `xAI video failed (${status})`;
}

export async function grokSubmitVideo(opts: {
  prompt: string;
  imageUrl: string;
  durationSec: number;
  resolution?: "480p" | "720p" | "1080p";
}): Promise<string> {
  const duration = snapGrokI2vDurationSec(opts.durationSec);
  const res = await fetch(`${XAI_VIDEO_BASE}/videos/generations`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      model: GROK_I2V_MODEL,
      prompt: opts.prompt,
      image: { url: opts.imageUrl },
      duration,
      resolution: opts.resolution || GROK_I2V_RESOLUTION,
    }),
  });
  const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(xaiVideoError(res.status, raw));
  const id = String(raw.request_id || raw.requestId || raw.id || "").trim();
  if (!id) throw new Error("xAI video submit returned no request_id");
  return id;
}

export type GrokVideoPoll =
  | { status: "pending" }
  | { status: "done"; url: string; duration?: number }
  | { status: "failed"; message: string };

export async function grokPollVideo(requestId: string): Promise<GrokVideoPoll> {
  const id = encodeURIComponent(requestId.trim());
  const res = await fetch(`${XAI_VIDEO_BASE}/videos/${id}`, {
    method: "GET",
    headers: authHeaders(),
  });
  const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(xaiVideoError(res.status, raw));
  const status = String(raw.status || "").toLowerCase();
  if (status === "pending" || status === "processing" || status === "queued") {
    return { status: "pending" };
  }
  if (status === "done" || status === "succeeded" || status === "success") {
    const video = (raw.video && typeof raw.video === "object" ? raw.video : raw) as {
      url?: string;
      duration?: number;
    };
    const url = String(video.url || raw.url || "").trim();
    if (!url) throw new Error("xAI video done but no url");
    const duration = Number(video.duration);
    return {
      status: "done",
      url,
      duration: Number.isFinite(duration) && duration > 0 ? duration : undefined,
    };
  }
  if (status === "expired" || status === "failed" || status === "error") {
    return { status: "failed", message: xaiVideoError(res.status, raw) || `xAI video ${status}` };
  }
  return { status: "pending" };
}

export async function grokDownloadUrl(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Couldn't download Grok video (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}
