import fs from "fs";
import path from "path";
import {
  comfyDownloadView,
  comfyObjectInfo,
  comfyQueuePrompt,
  comfyUploadFile,
  comfyWaitHistory,
  pickComfyVideoOutput,
  resolveComfyUrl,
  type ComfyHistoryOutputs,
} from "./comfyClient";
import { uiWorkflowToApiPrompt, type UiWorkflow } from "./comfyWorkflowApi";
import { comfyLipsyncPreflight } from "./lipsyncPreflight";
import { CRASH_DIR, MOVIES_ROOT } from "./paths";
import { sortableId } from "./types";

/** Production default — v1b crop settings (NOT v1c). */
const WF_CANDIDATES = [
  path.join(MOVIES_ROOT, "workflow", "lipsync", "WF_lipsync_v1d.json"),
  // MOVIES_ROOT only exists on the PC; a repo copy is what a deploy carries.
  path.join(process.cwd(), "workflow", "lipsync", "WF_lipsync_v1d.json"),
];

const UPLOAD_SUB = "lipsync_test";

export type LipsyncProgressStep =
  | "resolving"
  | "uploading"
  | "converting"
  | "queued"
  | "running"
  | "pulling"
  | "done";

export type LipsyncProgressEvent = {
  step: LipsyncProgressStep;
  message: string;
  promptId?: string;
  elapsedMs?: number;
  comfyUrl?: string;
  comfySource?: string;
};

export type LipsyncSmokeInput = {
  /** LTX (or other) mp4 on disk */
  videoPath: string;
  /** Dialogue mp3 on disk */
  audioPath: string;
  /** Optional speaker slug for output prefix */
  speaker?: string;
  comfyUrl?: string;
  styleId?: string;
  beatId?: string;
  onProgress?: (ev: LipsyncProgressEvent) => void;
};

export type LipsyncBeatResult = {
  styleId: string;
  beatId: string;
  file: string;
  url: string;
  promptId: string;
  at: string;
};

export type LipsyncResultsManifest = {
  byBeat: Record<string, LipsyncBeatResult>;
};

export type LipsyncSmokeResult = {
  ok: true;
  comfyUrl: string;
  comfySource: string;
  convertVia: string;
  promptId: string;
  uploadedVideo: string;
  uploadedAudio: string;
  localMp4: string;
  localMp4Relative: string;
  url: string;
};

function loadLipsyncUi(): UiWorkflow {
  for (const p of WF_CANDIDATES) {
    if (p && fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, "utf8")) as UiWorkflow;
    }
  }
  throw new Error(
    "Lipsync WF not found. Expected MY MOVIES\\workflow\\lipsync\\WF_lipsync_v1d.json",
  );
}

function lipsyncOutDir(): string {
  const d = path.join(CRASH_DIR, "lipsync");
  fs.mkdirSync(d, { recursive: true });
  return d;
}

function lipsyncUploadDir(): string {
  const d = path.join(lipsyncOutDir(), "_upload");
  fs.mkdirSync(d, { recursive: true });
  return d;
}

function lipsyncResultsPath(): string {
  return path.join(lipsyncOutDir(), "results.json");
}

export function readLipsyncResults(): LipsyncResultsManifest {
  try {
    const p = lipsyncResultsPath();
    if (!fs.existsSync(p)) return { byBeat: {} };
    const raw = JSON.parse(fs.readFileSync(p, "utf8")) as LipsyncResultsManifest;
    return { byBeat: raw.byBeat || {} };
  } catch {
    return { byBeat: {} };
  }
}

export function writeLipsyncBeatResult(entry: LipsyncBeatResult): void {
  const cur = readLipsyncResults();
  cur.byBeat[`${entry.styleId}::${entry.beatId}`] = entry;
  fs.writeFileSync(lipsyncResultsPath(), JSON.stringify(cur, null, 2), "utf8");
}

export function listLipsyncResultsForStyle(styleId: string): LipsyncBeatResult[] {
  const all = readLipsyncResults();
  return Object.values(all.byBeat).filter((r) => r.styleId === styleId);
}

function lipsyncClearedDir(): string {
  const d = path.join(lipsyncOutDir(), "_cleared");
  fs.mkdirSync(d, { recursive: true });
  return d;
}

function quarantineLipsyncFile(file: string): string | null {
  if (!file || file.includes("..") || file.includes("/") || file.includes("\\")) {
    return null;
  }
  const src = path.join(lipsyncOutDir(), file);
  if (!fs.existsSync(src)) return null;
  const destDir = lipsyncClearedDir();
  let dest = path.join(destDir, file);
  if (fs.existsSync(dest)) {
    dest = path.join(destDir, `${Date.now()}_${file}`);
  }
  fs.renameSync(src, dest);
  return path.basename(dest);
}

/**
 * Clear Animate lipsync results for a show (or one beat).
 * Moves mp4s to data/crash/lipsync/_cleared/ — never deletes.
 */
export function clearLipsyncResultsForStyle(
  styleId: string,
  beatId?: string,
): { cleared: number; moved: string[] } {
  const cur = readLipsyncResults();
  const moved: string[] = [];
  let cleared = 0;
  for (const [key, entry] of Object.entries(cur.byBeat)) {
    if (entry.styleId !== styleId) continue;
    if (beatId && entry.beatId !== beatId) continue;
    const parked = quarantineLipsyncFile(entry.file);
    if (parked) moved.push(parked);
    delete cur.byBeat[key];
    cleared++;
  }
  fs.writeFileSync(lipsyncResultsPath(), JSON.stringify(cur, null, 2), "utf8");
  return { cleared, moved };
}

export function lipsyncFilePath(name: string): string | null {
  if (!name || name.includes("..") || name.includes("/") || name.includes("\\")) {
    return null;
  }
  const p = path.join(lipsyncOutDir(), name);
  if (!fs.existsSync(p)) return null;
  return p;
}

function safeSpeakerSlug(speaker?: string): string {
  const s = (speaker || "beat")
    .replace(/[^\w]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);
  return s || "beat";
}

function patchFromUiObject(
  prompt: Record<string, unknown>,
  uiById: Map<number, { type?: string; widgets_values?: unknown }>,
  nodeId: string,
  fields: string[],
) {
  const node = prompt[nodeId] as
    | { class_type?: string; inputs?: Record<string, unknown> }
    | undefined;
  const ui = uiById.get(Number(nodeId));
  const wv = ui?.widgets_values;
  if (!node?.inputs || !wv || Array.isArray(wv) || typeof wv !== "object") {
    return;
  }
  const obj = wv as Record<string, unknown>;
  for (const f of fields) {
    if (obj[f] !== undefined) node.inputs[f] = obj[f];
  }
}

/**
 * Proven MuseTalk-KJ patches from scripts/tmp_queue_lipsync_v1d.ts
 * (VHS object widgets, ImageResize+, DW face, AUDIO dict into sampler).
 */
function patchLipsyncApiPrompt(opts: {
  prompt: Record<string, unknown>;
  ui: UiWorkflow;
  videoRel: string;
  audioRel: string;
  filenamePrefix: string;
}): void {
  const { prompt } = opts;
  const uiById = new Map<number, { type?: string; widgets_values?: unknown }>();
  for (const n of (opts.ui.nodes || []) as Array<{
    id: number;
    type?: string;
    widgets_values?: unknown;
  }>) {
    uiById.set(n.id, n);
  }

  // Object widgets_values (VHS) often missed by convert
  patchFromUiObject(prompt, uiById, "28", [
    "audio_file",
    "seek_seconds",
    "duration",
  ]);
  patchFromUiObject(prompt, uiById, "89", [
    "video",
    "force_rate",
    "custom_width",
    "custom_height",
    "skip_first_frames",
    "select_every_nth",
  ]);
  {
    const n89 = prompt["89"] as { inputs?: Record<string, unknown> } | undefined;
    const ui = uiById.get(89)?.widgets_values as Record<string, unknown> | undefined;
    if (n89?.inputs && ui?.video) n89.inputs.video = ui.video;
    if (
      n89?.inputs &&
      !Array.isArray(n89.inputs.frame_load_cap) &&
      typeof ui?.frame_load_cap === "number"
    ) {
      n89.inputs.frame_load_cap = ui.frame_load_cap;
    }
  }
  for (const id of ["30", "96", "98", "99", "100"]) {
    patchFromUiObject(prompt, uiById, id, [
      "frame_rate",
      "loop_count",
      "filename_prefix",
      "format",
      "pix_fmt",
      "crf",
      "save_metadata",
      "pingpong",
      "save_output",
    ]);
  }

  // Force uploaded paths (VHS_LoadAudio wants input/…; LoadVideo wants sub/file)
  {
    const n28 = prompt["28"] as { inputs?: Record<string, unknown> } | undefined;
    if (n28?.inputs) {
      n28.inputs.audio_file = `input/${opts.audioRel}`;
    }
  }
  {
    const n89 = prompt["89"] as { inputs?: Record<string, unknown> } | undefined;
    if (n89?.inputs) n89.inputs.video = opts.videoRel;
  }

  // ImageResize+ from UI array
  for (const id of ["31", "47"]) {
    const n = prompt[id] as { inputs?: Record<string, unknown> } | undefined;
    const ui = uiById.get(Number(id));
    const w = Array.isArray(ui?.widgets_values)
      ? (ui!.widgets_values as unknown[])
      : null;
    if (!n?.inputs || !w || w.length < 6) continue;
    n.inputs.width = w[0];
    n.inputs.height = w[1];
    n.inputs.interpolation = w[2];
    const methodRaw = w[3];
    n.inputs.method =
      methodRaw === true
        ? "keep proportion"
        : methodRaw === false
          ? "stretch"
          : methodRaw;
    n.inputs.condition = w[4];
    n.inputs.multiple_of = w[5];
  }

  // DWPreprocessor — face only
  {
    const n72 = prompt["72"] as { inputs?: Record<string, unknown> } | undefined;
    const ui = uiById.get(72);
    const w = Array.isArray(ui?.widgets_values)
      ? (ui!.widgets_values as unknown[])
      : null;
    if (n72?.inputs && w && w.length >= 6) {
      n72.inputs.detect_hand = "disable";
      n72.inputs.detect_body = "disable";
      n72.inputs.detect_face = "enable";
      if (!Array.isArray(n72.inputs.resolution)) {
        n72.inputs.resolution = typeof w[3] === "number" ? w[3] : 512;
      }
      n72.inputs.bbox_detector =
        typeof w[4] === "string" ? w[4] : "yolox_l.torchscript.pt";
      n72.inputs.pose_estimator =
        typeof w[5] === "string"
          ? w[5]
          : "dw-ll_ucoco_384_bs5.torchscript.pt";
      n72.inputs.scale_stick_for_xinsr_cn = "disable";
    }
  }

  // MuseTalk-KJ takes Comfy AUDIO (waveform dict) from LoadAudio — not VHS_AUDIO
  {
    const n27 = prompt["27"] as { inputs?: Record<string, unknown> } | undefined;
    if (n27?.inputs) n27.inputs.vhs_audio = ["28", 0];
  }
  if (prompt["200"]) delete prompt["200"];
  for (const id of ["30", "96"]) {
    const n = prompt[id] as { inputs?: Record<string, unknown> } | undefined;
    if (n?.inputs) n.inputs.audio = ["28", 0];
  }
  {
    const n96 = prompt["96"] as { inputs?: Record<string, unknown> } | undefined;
    if (n96?.inputs) n96.inputs.filename_prefix = opts.filenamePrefix;
  }

  // Strip non-executable leftovers
  for (const id of Object.keys(prompt)) {
    const n = prompt[id] as { class_type?: string };
    if (
      n.class_type &&
      ["Display Any (rgthree)", "SetNode", "GetNode"].includes(n.class_type)
    ) {
      delete prompt[id];
    }
  }
}

type OutFile = { filename: string; subfolder: string; type: string };

function collectLipsyncOutputs(
  outputs: Record<string, ComfyHistoryOutputs>,
  prefix: string,
): OutFile[] {
  const wanted: OutFile[] = [];
  const seen = new Set<string>();
  const pref = prefix.replace(/[^\w.-]+/g, "_");
  for (const nodeOut of Object.values(outputs)) {
    if (!nodeOut || typeof nodeOut !== "object") continue;
    for (const val of Object.values(nodeOut)) {
      if (!Array.isArray(val)) continue;
      for (const raw of val) {
        const f = raw as {
          filename?: string;
          subfolder?: string;
          type?: string;
        };
        if (!f.filename || !/\.(mp4|webm)$/i.test(f.filename)) continue;
        if (
          !new RegExp(pref, "i").test(f.filename) &&
          !/lipsync_v1d|MuseTalkCrop/i.test(f.filename)
        ) {
          continue;
        }
        const key = `${f.type || "output"}|${f.subfolder || ""}|${f.filename}`;
        if (seen.has(key)) continue;
        seen.add(key);
        wanted.push({
          filename: f.filename,
          subfolder: f.subfolder || "",
          type: f.type || "output",
        });
      }
    }
  }
  return wanted;
}

function pickMainLipsync(files: OutFile[], prefix: string): OutFile | null {
  const pref = prefix.toLowerCase();
  const main = files.find(
    (f) =>
      f.filename.toLowerCase().includes(pref) ||
      /lipsync_v1d/i.test(f.filename),
  );
  if (main) return main;
  return files[0] || null;
}

/**
 * Upload LTX mp4 + mp3 → patch WF_lipsync_v1d → queue → poll → pull to data/crash/lipsync/
 */
export async function runLipsyncSmoke(
  input: LipsyncSmokeInput,
): Promise<LipsyncSmokeResult> {
  const progress = (ev: LipsyncProgressEvent) => {
    try {
      input.onProgress?.(ev);
    } catch {
      /* UI callback must not break the job */
    }
  };

  if (!input.videoPath || !fs.existsSync(input.videoPath)) {
    throw new Error("Lipsync needs an LTX mp4 — Send to LTX first");
  }
  if (!input.audioPath || !fs.existsSync(input.audioPath)) {
    throw new Error("Lipsync needs the beat mp3 on disk");
  }

  progress({ step: "resolving", message: "Finding Comfy…" });
  const resolved = await resolveComfyUrl(input.comfyUrl);
  if (!resolved.ok) throw new Error(resolved.error);
  const baseUrl = resolved.url;
  const hostShort = baseUrl.replace(/^https?:\/\//, "").slice(0, 48);

  const pre = await comfyLipsyncPreflight(baseUrl);
  if (!pre.reachable) {
    throw new Error(
      `Comfy not answering at ${hostShort} (${resolved.source}): ${
        pre.error || pre.hint
      }`,
    );
  }
  if (!pre.ok) {
    const miss = pre.missing.slice(0, 8).join(", ");
    throw new Error(
      `MuseTalk nodes missing (${miss}${pre.missing.length > 8 ? "…" : ""}). ${pre.hint}`,
    );
  }
  progress({
    step: "resolving",
    message: `MuseTalk ready · ${hostShort} (${resolved.source})`,
    comfyUrl: baseUrl,
    comfySource: resolved.source,
  });

  // Soft VAE check (warn via progress, hard-fail only if prompt needs it and list empty)
  try {
    const info = await comfyObjectInfo(baseUrl);
    const vaeLoader = info["VAELoader"] as
      | { input?: { required?: { vae_name?: [string[]] } } }
      | undefined;
    const vaeList =
      (vaeLoader?.input?.required?.vae_name?.[0] as string[] | undefined) || [];
    const vaeHit = vaeList.find((v) => /vae-ft-mse/i.test(v));
    if (!vaeHit) {
      progress({
        step: "resolving",
        message:
          "VAE vae-ft-mse… not listed — job may fail; check INSTALL_MUSETALK.md",
        comfyUrl: baseUrl,
        comfySource: resolved.source,
      });
    }
  } catch {
    /* object_info optional here — preflight already passed nodes */
  }

  const audioSafeName = `${safeSpeakerSlug(input.speaker)}_${sortableId("a")}.mp3`;
  const audioSafeLocal = path.join(lipsyncUploadDir(), audioSafeName);
  fs.copyFileSync(input.audioPath, audioSafeLocal);

  progress({
    step: "uploading",
    message: `Uploading video + mp3 → ${hostShort}`,
    comfyUrl: baseUrl,
    comfySource: resolved.source,
  });
  const videoUp = await comfyUploadFile({
    baseUrl,
    filePath: input.videoPath,
    subfolder: UPLOAD_SUB,
    overwrite: true,
  });
  const audioUp = await comfyUploadFile({
    baseUrl,
    filePath: audioSafeLocal,
    subfolder: UPLOAD_SUB,
    overwrite: true,
  });
  const videoRel = videoUp.subfolder
    ? `${videoUp.subfolder}/${videoUp.name}`
    : videoUp.name;
  const audioRel = audioUp.subfolder
    ? `${audioUp.subfolder}/${audioUp.name}`
    : audioUp.name;

  const filenamePrefix = `lipsync_v1d_${safeSpeakerSlug(input.speaker)}`;

  progress({
    step: "converting",
    message: "Building MuseTalk prompt (WF_lipsync_v1d)…",
    comfyUrl: baseUrl,
    comfySource: resolved.source,
  });
  const workflow = loadLipsyncUi();
  const { prompt, via } = await uiWorkflowToApiPrompt(baseUrl, workflow);
  patchLipsyncApiPrompt({
    prompt,
    ui: workflow,
    videoRel,
    audioRel,
    filenamePrefix,
  });

  // Debug dump — never wipe prior
  try {
    fs.writeFileSync(
      path.join(lipsyncOutDir(), "_last_prompt_v1d.json"),
      JSON.stringify(prompt, null, 2),
      "utf8",
    );
  } catch {
    /* ignore */
  }

  progress({
    step: "converting",
    message: `Queueing MuseTalk (${via})…`,
    comfyUrl: baseUrl,
    comfySource: resolved.source,
  });
  const { promptId } = await comfyQueuePrompt({ baseUrl, prompt });
  progress({
    step: "queued",
    message: `Queued on ${hostShort} · ${promptId.slice(0, 8)}…`,
    promptId,
    comfyUrl: baseUrl,
    comfySource: resolved.source,
  });

  // First weight download can be long — 45 min like proven scratch
  const { outputs } = await comfyWaitHistory({
    baseUrl,
    promptId,
    timeoutMs: 45 * 60_000,
    pollMs: 3000,
    onPoll: ({ phase, elapsedMs }) => {
      progress({
        step: phase === "queued" ? "queued" : "running",
        message:
          phase === "queued"
            ? `Queued (${promptId.slice(0, 8)}…) · ${Math.round(elapsedMs / 1000)}s`
            : `Running MuseTalk… ${Math.round(elapsedMs / 1000)}s — leave it`,
        promptId,
        elapsedMs,
      });
    },
  });

  let wanted = collectLipsyncOutputs(outputs, filenamePrefix);
  if (!wanted.length) {
    const fallback = pickComfyVideoOutput(outputs);
    if (fallback) wanted = [fallback];
  }
  if (!wanted.length) {
    throw new Error(
      `Job ${promptId.slice(0, 8)}… finished but no lipsync mp4 (prefix ${filenamePrefix})`,
    );
  }

  const main = pickMainLipsync(wanted, filenamePrefix);
  if (!main) {
    throw new Error("No lipsync video to pull");
  }

  progress({
    step: "pulling",
    message: `Pulling ${main.subfolder ? `${main.subfolder}/` : ""}${main.filename}…`,
    promptId,
  });

  let localMp4 = "";
  // Pull main + MuseTalkCrop intermediates (never delete old takes)
  for (const file of wanted) {
    const buf = await comfyDownloadView({
      baseUrl,
      filename: file.filename,
      subfolder: file.subfolder,
      type: file.type,
    });
    const isMain = file.filename === main.filename && file.subfolder === main.subfolder;
    const outName = isMain
      ? `${sortableId("lipsync")}_${file.filename.replace(/[^\w.-]+/g, "_")}`
      : file.filename.replace(/[^\w.-]+/g, "_");
    let dest = path.join(
      lipsyncOutDir(),
      outName.endsWith(".mp4") || outName.endsWith(".webm")
        ? outName
        : `${outName}.mp4`,
    );
    if (!isMain && fs.existsSync(dest)) {
      dest = path.join(lipsyncOutDir(), `${Date.now()}_${path.basename(dest)}`);
    }
    fs.writeFileSync(dest, buf);
    if (isMain) localMp4 = dest;
  }

  if (!localMp4) {
    throw new Error("Pulled outputs but main lipsync file missing");
  }

  const relative = path
    .relative(path.join(process.cwd()), localMp4)
    .split(path.sep)
    .join("\\");
  const url = `/api/crash/comfy/lipsync/file?name=${encodeURIComponent(path.basename(localMp4))}`;

  if (input.styleId && input.beatId) {
    writeLipsyncBeatResult({
      styleId: input.styleId,
      beatId: input.beatId,
      file: path.basename(localMp4),
      url,
      promptId,
      at: new Date().toISOString(),
    });
  }

  progress({ step: "done", message: "Done", promptId });
  return {
    ok: true,
    comfyUrl: baseUrl,
    comfySource: resolved.source,
    convertVia: via,
    promptId,
    uploadedVideo: videoRel,
    uploadedAudio: audioRel,
    localMp4,
    localMp4Relative: relative,
    url,
  };
}
