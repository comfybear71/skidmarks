/**
 * MiniMax H3 video — submit + poll.
 * Docs: https://platform.minimax.io/docs/guides/video-generation
 * POST /v2/video_generation → { task_id }
 * GET  /v2/query/video_generation/{task_id} → task.status + task.content.url
 */

import { getEnv } from "./env";
import {
  MINIMAX_H3_MODEL,
  MINIMAX_H3_RESOLUTION,
  snapMinimaxH3DurationSec,
} from "./minimaxH3";

const MINIMAX_VIDEO_BASE = "https://api.minimax.io";

export function minimaxVideoKey(): string {
  return getEnv("MINIMAX_API_KEY") || getEnv("HAILUO_API_KEY");
}

export function minimaxVideoConfigured(): boolean {
  return Boolean(minimaxVideoKey());
}

function authHeaders(): HeadersInit {
  const key = minimaxVideoKey();
  if (!key) {
    throw new Error(
      "Missing MINIMAX_API_KEY — https://platform.minimax.io then restart Studio.",
    );
  }
  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
  const group = getEnv("MINIMAX_GROUP_ID");
  if (group) headers["Group-Id"] = group;
  return headers;
}

function minimaxError(status: number, data: unknown): string {
  const d = data as {
    error?: string | { message?: string; code?: string };
    message?: string;
    base_resp?: { status_msg?: string; status_code?: number };
    task?: { error?: string | { message?: string } };
  };
  let detail = "";
  if (typeof d?.error === "string") detail = d.error;
  else if (d?.error && typeof d.error === "object") {
    detail = [d.error.code, d.error.message].filter(Boolean).join(": ");
  } else if (d?.task && typeof d.task.error === "string") detail = d.task.error;
  else if (d?.task?.error && typeof d.task.error === "object") {
    detail = d.task.error.message || "";
  } else if (d?.base_resp?.status_msg) detail = d.base_resp.status_msg;
  else if (d?.message) detail = d.message;
  else {
    try {
      detail = JSON.stringify(data);
    } catch {
      detail = "";
    }
  }
  if (status === 401 || status === 403) {
    return (
      (detail || `MiniMax refused the request (${status})`) +
      " — Check MINIMAX_API_KEY at https://platform.minimax.io"
    );
  }
  return detail || `MiniMax H3 failed (${status})`;
}

export async function minimaxSubmitVideo(opts: {
  prompt: string;
  firstImageUrl: string;
  lastImageUrl?: string;
  durationSec: number;
  resolution?: "768P" | "2K";
}): Promise<string> {
  const duration = snapMinimaxH3DurationSec(opts.durationSec);
  const content: Record<string, unknown>[] = [
    { type: "text", text: opts.prompt },
    {
      type: "image_url",
      image_url: { url: opts.firstImageUrl },
      role: "first_frame",
    },
  ];
  const last = (opts.lastImageUrl || "").trim();
  if (last) {
    content.push({
      type: "image_url",
      image_url: { url: last },
      role: "last_frame",
    });
  }
  const res = await fetch(`${MINIMAX_VIDEO_BASE}/v2/video_generation`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      model: MINIMAX_H3_MODEL,
      content,
      duration,
      resolution: opts.resolution || MINIMAX_H3_RESOLUTION,
    }),
  });
  const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(minimaxError(res.status, raw));
  const id = String(raw.task_id || raw.taskId || raw.id || "").trim();
  if (!id) throw new Error("MiniMax H3 submit returned no task_id");
  return id;
}

export type MinimaxVideoPoll =
  | { status: "pending" }
  | { status: "done"; url: string }
  | { status: "failed"; message: string };

export async function minimaxPollVideo(taskId: string): Promise<MinimaxVideoPoll> {
  const id = encodeURIComponent(taskId.trim());
  const res = await fetch(`${MINIMAX_VIDEO_BASE}/v2/query/video_generation/${id}`, {
    method: "GET",
    headers: authHeaders(),
  });
  const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(minimaxError(res.status, raw));
  const task = (
    raw.task && typeof raw.task === "object" ? raw.task : raw
  ) as Record<string, unknown>;
  const status = String(task.status || raw.status || "").toLowerCase();
  if (
    status === "pending" ||
    status === "processing" ||
    status === "queued" ||
    status === "queueing" ||
    status === "preparing" ||
    status === "running"
  ) {
    return { status: "pending" };
  }
  if (status === "succeeded" || status === "success" || status === "done") {
    const content = (
      task.content && typeof task.content === "object" ? task.content : task
    ) as { url?: string };
    const url = String(content.url || task.url || raw.url || "").trim();
    if (!url) throw new Error("MiniMax H3 done but no url");
    return { status: "done", url };
  }
  if (status === "failed" || status === "cancelled" || status === "canceled" || status === "error") {
    return { status: "failed", message: minimaxError(res.status, raw) || `MiniMax H3 ${status}` };
  }
  return { status: "pending" };
}

export async function minimaxDownloadUrl(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Couldn't download MiniMax H3 video (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}
