import fs from "fs";
import path from "path";
import { getEnv } from "./env";

export type ComfyUploadResult = {
  name: string;
  subfolder: string;
  type: string;
};

export type ComfyOutputFile = {
  filename: string;
  subfolder?: string;
  type?: string;
};

export type ComfyHistoryOutputs = {
  images?: ComfyOutputFile[];
  gifs?: ComfyOutputFile[];
  videos?: ComfyOutputFile[];
  /** SaveVideo PreviewVideo also sets animated: (True,) */
  animated?: unknown;
  [key: string]: unknown;
};

/**
 * Resolve Comfy base URL: an explicit override, else COMFY_URL env.
 * RunPod auto-discovery (list pods, resume, pick the first :3000) was the
 * testing-phase path and is gone — Comfy Cloud is the real backend now, and
 * a self-hosted Comfy is reached by setting COMFY_URL directly.
 */
export async function resolveComfyUrl(
  override?: string,
): Promise<{ ok: true; url: string; source: string } | { ok: false; error: string }> {
  const fromArg = (override || "").trim().replace(/\/$/, "");
  if (fromArg) return { ok: true, url: fromArg, source: "request" };

  const fromEnv = getEnv("COMFY_URL").replace(/\/$/, "");
  if (fromEnv) return { ok: true, url: fromEnv, source: "COMFY_URL" };

  return {
    ok: false,
    error: "No COMFY_URL set, and no Comfy Cloud key configured.",
  };
}

/** Plain reachability check — any HTTP response means the URL is alive
 * (even a 404), it doesn't need to be a valid Comfy route. Not RunPod-
 * specific despite once living next to that code; kept here since resolving
 * a manually-set COMFY_URL still benefits from knowing it's actually up. */
export async function probeComfyUrl(url: string): Promise<"up" | "down" | "skip"> {
  if (!url) return "skip";
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (res.status > 0) return "up";
    return "down";
  } catch {
    return "down";
  }
}

function comfyNetError(where: string, e: unknown): Error {
  const msg = e instanceof Error ? e.message : String(e);
  if (/abort|timeout/i.test(msg)) {
    return new Error(`Comfy ${where} timed out — is the pod awake?`);
  }
  if (/fetch failed|ECONNREFUSED|ENOTFOUND|network/i.test(msg)) {
    return new Error(
      `Comfy ${where} unreachable (${msg}) — check COMFY_URL / pod :3000`,
    );
  }
  return e instanceof Error ? e : new Error(String(e));
}

export async function comfyGetJson(
  baseUrl: string,
  apiPath: string,
  opts?: { timeoutMs?: number },
): Promise<unknown> {
  const timeoutMs = opts?.timeoutMs ?? 45_000;
  let res: Response;
  try {
    res = await fetch(`${baseUrl}${apiPath}`, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    throw comfyNetError(`GET ${apiPath}`, e);
  }
  if (!res.ok) {
    throw new Error(`Comfy GET ${apiPath} → HTTP ${res.status}`);
  }
  return res.json();
}

/** Upload a local file into Comfy input/ (optional subfolder). */
export async function comfyUploadFile(opts: {
  baseUrl: string;
  filePath: string;
  subfolder?: string;
  overwrite?: boolean;
}): Promise<ComfyUploadResult> {
  const buf = fs.readFileSync(opts.filePath);
  const fileName = path.basename(opts.filePath);
  const form = new FormData();
  form.append(
    "image",
    new Blob([new Uint8Array(buf)]),
    fileName,
  );
  form.append("overwrite", opts.overwrite === false ? "false" : "true");
  if (opts.subfolder) form.append("subfolder", opts.subfolder);

  let res: Response;
  try {
    res = await fetch(`${opts.baseUrl}/upload/image`, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(120_000),
    });
  } catch (e) {
    throw comfyNetError("upload", e);
  }
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Comfy upload failed HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  let json: { name?: string; subfolder?: string; type?: string };
  try {
    json = JSON.parse(text) as typeof json;
  } catch {
    throw new Error(`Comfy upload: bad JSON — ${text.slice(0, 200)}`);
  }
  return {
    name: String(json.name || fileName),
    subfolder: String(json.subfolder || opts.subfolder || ""),
    type: String(json.type || "input"),
  };
}

export async function comfyQueuePrompt(opts: {
  baseUrl: string;
  prompt: Record<string, unknown>;
  clientId?: string;
}): Promise<{ promptId: string }> {
  let res: Response;
  try {
    res = await fetch(`${opts.baseUrl}/prompt`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        prompt: opts.prompt,
        client_id: opts.clientId || `studio-${Date.now()}`,
      }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (e) {
    throw comfyNetError("/prompt", e);
  }
  const json = (await res.json().catch(() => ({}))) as {
    prompt_id?: string;
    error?: { message?: string; details?: string; type?: string } | string;
    node_errors?: Record<
      string,
      {
        errors?: Array<{ message?: string; details?: string; type?: string }>;
        class_type?: string;
      }
    >;
  };
  if (!res.ok || !json.prompt_id) {
    const bits: string[] = [];
    if (typeof json.error === "string") bits.push(json.error);
    else if (json.error?.message) {
      bits.push(
        json.error.details
          ? `${json.error.message}: ${json.error.details}`
          : json.error.message,
      );
    }
    if (json.node_errors && typeof json.node_errors === "object") {
      for (const [nodeId, ne] of Object.entries(json.node_errors)) {
        const cls = ne.class_type ? ` ${ne.class_type}` : "";
        for (const err of ne.errors || []) {
          const line = err.details || err.message || err.type || "error";
          bits.push(`node ${nodeId}${cls}: ${line}`);
        }
      }
    }
    const msg = bits.join(" · ").slice(0, 700) || JSON.stringify(json).slice(0, 400);
    throw new Error(
      `Comfy /prompt rejected (job never queued): ${msg}`,
    );
  }
  return { promptId: json.prompt_id };
}

type ComfyHistoryEntry = {
  outputs?: Record<string, ComfyHistoryOutputs>;
  status?: {
    status_str?: string;
    completed?: boolean;
    messages?: unknown[];
  };
};

function nodeWhere(d: {
  node_id?: string | number;
  node_type?: string;
}): string {
  if (!d.node_type && d.node_id == null) return "";
  return ` (${d.node_type || "node"}${
    d.node_id != null && d.node_id !== "" ? ` #${d.node_id}` : ""
  })`;
}

/** Pull a readable error out of Comfy /history status.messages. */
export function formatComfyHistoryError(entry: ComfyHistoryEntry | undefined): string {
  const messages = entry?.status?.messages;
  if (Array.isArray(messages)) {
    for (const m of messages) {
      if (!Array.isArray(m) || m.length < 2) continue;
      const kind = String(m[0] || "");
      const detail = m[1];
      if (kind === "execution_error" && detail && typeof detail === "object") {
        const d = detail as {
          exception_message?: string;
          exception_type?: string;
          node_id?: string | number;
          node_type?: string;
        };
        const msg = (
          d.exception_message ||
          d.exception_type ||
          JSON.stringify(detail)
        ).slice(0, 500);
        return `Comfy error${nodeWhere(d)}: ${msg}`;
      }
      if (kind === "execution_interrupted") {
        const d =
          detail && typeof detail === "object"
            ? (detail as {
                node_id?: string | number;
                node_type?: string;
              })
            : {};
        return (
          `Comfy interrupted (Cancel / Global interrupt)${nodeWhere(d)} — ` +
          `job was stopped in Comfy or by a script calling /interrupt. ` +
          `Leave Send to LTX alone until Done; don't Cancel the queue.`
        );
      }
      if (typeof detail === "string" && detail.trim()) {
        return `Comfy ${kind || "message"}: ${detail.slice(0, 400)}`;
      }
      if (detail && typeof detail === "object") {
        const d = detail as {
          exception_message?: string;
          message?: string;
          node_id?: string | number;
          node_type?: string;
        };
        if (d.exception_message || d.message) {
          return `Comfy ${kind}${nodeWhere(d)}: ${(
            d.exception_message ||
            d.message ||
            ""
          ).slice(0, 500)}`;
        }
      }
    }
    const kinds = messages
      .map((m) => (Array.isArray(m) ? String(m[0] || "") : ""))
      .filter(Boolean);
    if (kinds.length) {
      const st = entry?.status?.status_str || "error";
      return `Comfy job ${st} (${kinds.join(" → ")})`;
    }
  }
  const st = entry?.status?.status_str;
  return st
    ? `Comfy job ${st} — no exception_message in history`
    : "Comfy job error — empty history entry";
}

async function comfyQueuePhase(
  baseUrl: string,
  promptId: string,
): Promise<"queued" | "running" | "unknown"> {
  try {
    const q = (await comfyGetJson(baseUrl, "/queue")) as {
      queue_running?: unknown[][];
      queue_pending?: unknown[][];
    };
    const inList = (list: unknown[][] | undefined) =>
      Array.isArray(list) &&
      list.some((row) => Array.isArray(row) && row.includes(promptId));
    if (inList(q.queue_running)) return "running";
    if (inList(q.queue_pending)) return "queued";
  } catch {
    /* queue probe optional */
  }
  return "unknown";
}

/**
 * Poll /history until outputs appear.
 * Never calls /interrupt — Studio waits; cancel only if Stuie clicks Cancel in Comfy.
 */
export async function comfyWaitHistory(opts: {
  baseUrl: string;
  promptId: string;
  timeoutMs?: number;
  pollMs?: number;
  onPoll?: (info: {
    phase: "queued" | "running";
    promptId: string;
    elapsedMs: number;
  }) => void;
}): Promise<{
  outputs: Record<string, ComfyHistoryOutputs>;
  status?: unknown;
}> {
  const timeoutMs = opts.timeoutMs ?? 900_000;
  const pollMs = opts.pollMs ?? 3000;
  const started = Date.now();
  let consecutivePollFails = 0;

  while (Date.now() - started < timeoutMs) {
    let hist: Record<string, ComfyHistoryEntry>;
    try {
      hist = (await comfyGetJson(
        opts.baseUrl,
        `/history/${opts.promptId}`,
        { timeoutMs: 60_000 },
      )) as Record<string, ComfyHistoryEntry>;
      consecutivePollFails = 0;
    } catch (e) {
      // Transient pod blips — keep waiting, do NOT interrupt the job
      consecutivePollFails += 1;
      if (consecutivePollFails >= 40) {
        throw new Error(
          e instanceof Error
            ? `Comfy poll failed (${consecutivePollFails}×): ${e.message}`
            : `Comfy poll failed (${consecutivePollFails}×)`,
        );
      }
      await new Promise((r) => setTimeout(r, pollMs));
      continue;
    }

    const entry = hist[opts.promptId];
    const st = entry?.status?.status_str || "";
    if (st === "error" || (entry?.status?.completed && st === "error")) {
      throw new Error(formatComfyHistoryError(entry));
    }
    // Interrupted in Comfy UI (or elsewhere) — report, never re-interrupt
    if (st === "interrupted" || /interrupt/i.test(st)) {
      throw new Error(
        `Comfy job interrupted (not by Studio wait). Check Comfy — Cancel was hit or another client cleared the queue.`,
      );
    }

    const outputs = entry?.outputs || {};
    // SaveVideo (filename_prefix video/LTX_Director) lands under images+animated —
    // do NOT return on first preview stills; wait for an mp4 (or true completion).
    const vid = pickComfyVideoOutput(outputs);
    if (vid) {
      return { outputs, status: entry?.status };
    }

    const completed =
      entry?.status?.completed === true ||
      st === "success" ||
      st === "completed";
    if (completed) {
      // Job finished — caller may fall back to probing video/LTX_Director_*_.mp4
      return { outputs, status: entry?.status };
    }

    const phase = await comfyQueuePhase(opts.baseUrl, opts.promptId);
    opts.onPoll?.({
      phase: phase === "queued" ? "queued" : "running",
      promptId: opts.promptId,
      elapsedMs: Date.now() - started,
    });

    await new Promise((r) => setTimeout(r, pollMs));
  }
  throw new Error(
    `Timed out waiting for Comfy job ${opts.promptId} (${Math.round(timeoutMs / 1000)}s) — job may still be running in Comfy; do not re-Send yet`,
  );
}

const VIDEO_EXT_RE = /\.(mp4|webm|mov|mkv)$/i;

function videoPickScore(f: {
  filename: string;
  subfolder: string;
}): number {
  let s = 0;
  if (/LTX_Director/i.test(f.filename)) s += 20;
  if (/^video(\/|$)/i.test(f.subfolder) || f.subfolder === "video") s += 10;
  if (/\.mp4$/i.test(f.filename)) s += 2;
  // SaveVideo uses `{name}_{#####}_.mp4`
  if (/_\d{5}_\.(mp4|webm|mov|mkv)$/i.test(f.filename)) s += 5;
  return s;
}

/** Pick best video-like output from history (prefers SaveVideo video/LTX_Director). */
export function pickComfyVideoOutput(
  outputs: Record<string, ComfyHistoryOutputs>,
): { filename: string; subfolder: string; type: string } | null {
  const candidates: Array<{
    filename: string;
    subfolder: string;
    type: string;
  }> = [];

  for (const nodeOut of Object.values(outputs || {})) {
    if (!nodeOut || typeof nodeOut !== "object") continue;
    for (const val of Object.values(nodeOut)) {
      if (!Array.isArray(val)) continue;
      for (const raw of val) {
        if (!raw || typeof raw !== "object") continue;
        const f = raw as ComfyOutputFile;
        if (!f.filename || !VIDEO_EXT_RE.test(f.filename)) continue;
        candidates.push({
          filename: f.filename,
          subfolder: f.subfolder || "",
          type: f.type || "output",
        });
      }
    }
  }

  if (!candidates.length) return null;
  candidates.sort((a, b) => videoPickScore(b) - videoPickScore(a));
  return candidates[0];
}

export type ComfyVideoRef = {
  filename: string;
  subfolder: string;
  type: string;
  promptId?: string;
};

function historyEntryTimestamp(entry: ComfyHistoryEntry | undefined): number {
  const messages = entry?.status?.messages;
  if (!Array.isArray(messages)) return 0;
  let max = 0;
  for (const m of messages) {
    if (!Array.isArray(m) || m.length < 2) continue;
    const d = m[1];
    if (
      d &&
      typeof d === "object" &&
      typeof (d as { timestamp?: number }).timestamp === "number"
    ) {
      max = Math.max(max, (d as { timestamp: number }).timestamp);
    }
  }
  return max;
}

function historyWasInterrupted(entry: ComfyHistoryEntry | undefined): boolean {
  const st = entry?.status?.status_str || "";
  if (/interrupt/i.test(st)) return true;
  const messages = entry?.status?.messages;
  if (!Array.isArray(messages)) return false;
  return messages.some(
    (m) => Array.isArray(m) && String(m[0] || "") === "execution_interrupted",
  );
}

/**
 * Scan Comfy /history for SaveVideo outputs (filename + subfolder + type).
 * Prefers newest LTX_Director mp4 (e.g. video/LTX_Director_00001_.mp4).
 */
export async function findNewestComfyVideoFromHistory(
  baseUrl: string,
): Promise<{
  video: ComfyVideoRef | null;
  interruptedOnly: boolean;
  successWithoutVideo: boolean;
  historyCount: number;
}> {
  const hist = (await comfyGetJson(baseUrl, "/history", {
    timeoutMs: 60_000,
  })) as Record<string, ComfyHistoryEntry>;

  type Cand = ComfyVideoRef & { ts: number; score: number };
  const cands: Cand[] = [];
  let anyInterrupted = false;
  let anySuccessNoVideo = false;

  for (const [promptId, entry] of Object.entries(hist || {})) {
    const vid = pickComfyVideoOutput(entry?.outputs || {});
    if (vid) {
      cands.push({
        ...vid,
        promptId,
        ts: historyEntryTimestamp(entry),
        score: videoPickScore(vid),
      });
      continue;
    }
    if (historyWasInterrupted(entry)) {
      anyInterrupted = true;
      continue;
    }
    const st = entry?.status?.status_str || "";
    const completed =
      entry?.status?.completed === true ||
      st === "success" ||
      st === "completed";
    if (completed) anySuccessNoVideo = true;
  }

  cands.sort((a, b) => b.ts - a.ts || b.score - a.score);
  const best = cands[0] || null;
  return {
    video: best
      ? {
          filename: best.filename,
          subfolder: best.subfolder,
          type: best.type,
          promptId: best.promptId,
        }
      : null,
    interruptedOnly: !cands.length && anyInterrupted && !anySuccessNoVideo,
    successWithoutVideo: !cands.length && anySuccessNoVideo,
    historyCount: Object.keys(hist || {}).length,
  };
}

/**
 * Probe Comfy /view for SaveVideo files under subfolder `video`.
 * SaveVideo prefix `video/LTX_Director` → `LTX_Director_00001_.mp4`
 * (trailing underscore before extension — that form is tried first).
 */
export async function probeComfyLtxDirectorVideo(
  baseUrl: string,
  maxCounter = 80,
): Promise<ComfyVideoRef | null> {
  type Hit = ComfyVideoRef & { n: number };
  const hits: Hit[] = [];

  const tryOne = async (filename: string, n: number) => {
    const q = new URLSearchParams({
      filename,
      subfolder: "video",
      type: "output",
    });
    try {
      const res = await fetch(`${baseUrl}/view?${q}`, {
        method: "GET",
        cache: "no-store",
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) {
        if (res.body) await res.body.cancel().catch(() => undefined);
        return;
      }
      if (res.body) await res.body.cancel().catch(() => undefined);
      hits.push({
        filename,
        subfolder: "video",
        type: "output",
        n,
      });
    } catch {
      /* miss */
    }
  };

  // Underscore form first (real SaveVideo), then bare, then webm
  const batch: Promise<void>[] = [];
  let foundHigh = 0;
  for (let i = maxCounter; i >= 1; i--) {
    const n = String(i).padStart(5, "0");
    batch.push(tryOne(`LTX_Director_${n}_.mp4`, i));
    batch.push(tryOne(`LTX_Director_${n}.mp4`, i));
    batch.push(tryOne(`LTX_Director_${n}_.webm`, i));
    if (batch.length >= 9) {
      await Promise.all(batch.splice(0, batch.length));
      if (hits.length) {
        foundHigh = Math.max(foundHigh, ...hits.map((h) => h.n));
        if (i < foundHigh - 3) break;
      }
    }
  }
  if (batch.length) await Promise.all(batch);

  // Also try counter-less names Comfy sometimes writes
  if (!hits.length) {
    for (const filename of [
      "LTX_Director_.mp4",
      "LTX_Director.mp4",
      "LTX_Director_.webm",
    ]) {
      await tryOne(filename, 0);
    }
  }

  if (!hits.length) return null;
  hits.sort((a, b) => b.n - a.n);
  const best = hits[0];
  return {
    filename: best.filename,
    subfolder: best.subfolder,
    type: best.type,
  };
}

/** History first, then /view probe. Used by Pull mp4 + Send auto-pull fallback. */
export async function resolveComfyLtxVideoToPull(baseUrl: string): Promise<{
  video: ComfyVideoRef | null;
  via: "history" | "probe" | null;
  interruptedOnly: boolean;
  successWithoutVideo: boolean;
  historyCount: number;
}> {
  const fromHist = await findNewestComfyVideoFromHistory(baseUrl);
  if (fromHist.video) {
    return {
      video: fromHist.video,
      via: "history",
      interruptedOnly: false,
      successWithoutVideo: false,
      historyCount: fromHist.historyCount,
    };
  }
  const probed = await probeComfyLtxDirectorVideo(baseUrl);
  return {
    video: probed,
    via: probed ? "probe" : null,
    interruptedOnly: fromHist.interruptedOnly,
    successWithoutVideo: fromHist.successWithoutVideo,
    historyCount: fromHist.historyCount,
  };
}

/** Blunt message when Pull/Send finds no mp4. */
export function comfyLtxMissingVideoError(info: {
  interruptedOnly: boolean;
  successWithoutVideo: boolean;
  historyCount: number;
}): string {
  if (info.interruptedOnly) {
    return (
      "Comfy job was interrupted — no mp4 written. " +
      "Send to LTX again; don't Cancel the queue."
    );
  }
  if (info.successWithoutVideo) {
    return (
      "Comfy job finished but Save Video left no file in history. " +
      "Check Save Video on the pod, then Pull mp4."
    );
  }
  if (info.historyCount === 0) {
    return "No Comfy history — nothing to pull. Send to LTX first.";
  }
  return (
    "No mp4 on Comfy output (looked for video/LTX_Director_#####_.mp4). " +
    "Job may still be running, was cancelled, or file is gone — Send again if needed."
  );
}

export async function comfyDownloadView(opts: {
  baseUrl: string;
  filename: string;
  subfolder?: string;
  type?: string;
}): Promise<Buffer> {
  const q = new URLSearchParams({
    filename: opts.filename,
    subfolder: opts.subfolder || "",
    type: opts.type || "output",
  });
  let res: Response;
  try {
    res = await fetch(`${opts.baseUrl}/view?${q}`, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(180_000),
    });
  } catch (e) {
    throw comfyNetError("/view", e);
  }
  if (!res.ok) {
    throw new Error(`Comfy /view failed HTTP ${res.status}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

export type ObjectInfo = Record<
  string,
  {
    input?: {
      required?: Record<string, unknown>;
      optional?: Record<string, unknown>;
    };
  }
>;

export async function comfyObjectInfo(baseUrl: string): Promise<ObjectInfo> {
  return (await comfyGetJson(baseUrl, "/object_info")) as ObjectInfo;
}

/** Try custom convert endpoint; null if missing. */
export async function comfyTryWorkflowConvert(
  baseUrl: string,
  workflow: unknown,
): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${baseUrl}/workflow/convert`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(workflow),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as unknown;
    if (json && typeof json === "object" && !Array.isArray(json)) {
      // Some converters wrap { prompt: {...} }
      const obj = json as Record<string, unknown>;
      if (obj.prompt && typeof obj.prompt === "object") {
        return obj.prompt as Record<string, unknown>;
      }
      return obj;
    }
    return null;
  } catch {
    return null;
  }
}
