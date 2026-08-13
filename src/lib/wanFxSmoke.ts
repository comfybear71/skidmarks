import fs from "fs";
import path from "path";
import {
  comfyDownloadView,
  comfyQueuePrompt,
  comfyUploadFile,
  comfyWaitHistory,
  pickComfyVideoOutput,
  resolveComfyUrl,
  type ComfyHistoryOutputs,
} from "./comfyClient";
import {
  findApiNodesByClass,
  patchApiNodeInputs,
  uiWorkflowToApiPrompt,
  type UiWorkflow,
} from "./comfyWorkflowApi";
import { sortableId } from "./types";
import { comfyWanFxPreflight } from "./wanFxPreflight";
import {
  WAN_FX_WF_PATH,
  wanFxCrashDir,
  wanFxPlatePath,
  wanFxUploadDir,
} from "./wanFxPaths";

const UPLOAD_SUB = "wan_fx";

/** Default explode trigger — positive only */
export const WAN_FX_DEFAULT_PROMPT =
  "3xp105ion huge explosion, debris and fireball, stylised 3D animated feature render";

export type WanFxDuration = "short" | "normal";
export type WanFxBoomSize = "small" | "normal" | "big";

/** Short default (~2s @ 16fps). Never default to 81. */
export const WAN_FX_FRAMES: Record<WanFxDuration, number> = {
  short: 33,
  normal: 49,
};

export const WAN_FX_LORA_STRENGTH: Record<WanFxBoomSize, number> = {
  small: 0.75,
  normal: 1.0,
  big: 1.15,
};

export const WAN_FX_MODEL =
  "Wan2_1-I2V-14B-480P_fp8_e4m3fn.safetensors";
export const WAN_FX_LORA = "explode_30_epochs.safetensors";
/** Comfy-Org Wan 2.1 clip vision — valid for CLIPVisionLoader (not _visual_fp16). */
export const WAN_FX_CLIP_VISION = "clip_vision_h.safetensors";
export const WAN_FX_ATTENTION = "sdpa";

export type WanFxProgressStep =
  | "resolving"
  | "uploading"
  | "converting"
  | "queued"
  | "running"
  | "pulling"
  | "done";

export type WanFxProgressEvent = {
  step: WanFxProgressStep;
  message: string;
  promptId?: string;
  elapsedMs?: number;
  comfyUrl?: string;
  comfySource?: string;
};

export type WanFxSmokeInput = {
  plateName: string;
  /** Optional short positive add-on */
  prompt?: string;
  duration?: WanFxDuration;
  boom?: WanFxBoomSize;
  comfyUrl?: string;
  onProgress?: (ev: WanFxProgressEvent) => void;
};

export type WanFxSmokeResult = {
  ok: true;
  comfyUrl: string;
  comfySource: string;
  convertVia: string;
  promptId: string;
  uploadedImage: string;
  localMp4: string;
  localMp4Relative: string;
  url: string;
  frames: number;
  boom: WanFxBoomSize;
  duration: WanFxDuration;
};

function loadWanFxUi(): UiWorkflow {
  if (!fs.existsSync(WAN_FX_WF_PATH)) {
    throw new Error(
      "Wan FX workflow missing. Expected MY MOVIES\\workflow\\wan_fx\\WF_explosion_v1.json",
    );
  }
  return JSON.parse(fs.readFileSync(WAN_FX_WF_PATH, "utf8")) as UiWorkflow;
}

function buildPositivePrompt(extra?: string): string {
  const add = (extra || "").trim();
  if (!add) return WAN_FX_DEFAULT_PROMPT;
  if (/3xp105ion/i.test(add)) return add;
  return `${WAN_FX_DEFAULT_PROMPT}. ${add}`;
}

type OutFile = { filename: string; subfolder: string; type: string };

function collectWanOutputs(
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
          !/wan_fx|WanVideo|explosion/i.test(f.filename)
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

function pickMainWan(files: OutFile[], prefix: string): OutFile | null {
  const pref = prefix.toLowerCase();
  const main = files.find((f) => f.filename.toLowerCase().includes(pref));
  if (main) return main;
  return files[0] || null;
}

function patchFromUiObject(
  prompt: Record<string, unknown>,
  uiById: Map<number, { type?: string; widgets_values?: unknown }>,
  nodeId: string,
  fields: string[],
): void {
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

function isComfySeedControl(v: unknown): boolean {
  if (typeof v !== "string") return false;
  return /^(randomize|fixed|increment|decrement)$/i.test(v.trim());
}

function isLinkRef(v: unknown): v is [string, number] {
  return (
    Array.isArray(v) &&
    v.length === 2 &&
    (typeof v[0] === "string" || typeof v[0] === "number") &&
    typeof v[1] === "number"
  );
}

/** WF_explosion_v1 node 27 — short boom clip defaults */
const WAN_SAMPLER_DEFAULTS = {
  steps: 30,
  cfg: 6,
  shift: 5,
  seed: 0,
  force_offload: true,
  scheduler: "dpm++",
  riflex_freq_index: 0,
  denoise_strength: 1,
  start_step: 0,
  end_step: -1,
  add_noise_to_samples: false,
} as const;

/** Kijai WanVideoSampler.process + get_scheduler — None on any of these → None > int */
const WAN_SAMPLER_NUMERIC_KEYS = [
  "steps",
  "cfg",
  "shift",
  "seed",
  "riflex_freq_index",
  "denoise_strength",
  "start_step",
  "end_step",
] as const;

/** WF_explosion_v1 node 17 — short boom clip defaults */
const WAN_I2V_ENCODE_DEFAULTS = {
  width: 720,
  height: 720,
  num_frames: WAN_FX_FRAMES.short,
  noise_aug_strength: 0,
  start_latent_strength: 1,
  end_latent_strength: 1,
  force_offload: true,
  fun_or_fl2v_model: false,
  tiled_vae: false,
} as const;

function asWanNum(v: unknown, fallback: number): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function asWanBool(v: unknown, fallback: boolean): boolean {
  if (typeof v === "boolean") return v;
  if (v === 1 || v === "1" || v === "true" || v === "True") return true;
  if (v === 0 || v === "0" || v === "false" || v === "False") return false;
  return fallback;
}

/** /workflow/convert injects explicit nulls — Comfy treats those as None, not defaults. */
function deleteNullInputs(inputs: Record<string, unknown>): void {
  for (const k of Object.keys(inputs)) {
    if (inputs[k] === null || inputs[k] === undefined) delete inputs[k];
  }
}

/** Strip null/undefined from every node — convert leaves None-kwargs all over the graph. */
function deleteNullInputsDeep(prompt: Record<string, unknown>): void {
  for (const raw of Object.values(prompt)) {
    const node = raw as { inputs?: Record<string, unknown> };
    if (node?.inputs && typeof node.inputs === "object") {
      deleteNullInputs(node.inputs);
    }
  }
}

function flattenWanCfg(inputs: Record<string, unknown>): void {
  if (!Array.isArray(inputs.cfg)) return;
  const n = inputs.cfg.find((x) => typeof x === "number" && Number.isFinite(x));
  inputs.cfg = typeof n === "number" ? n : WAN_SAMPLER_DEFAULTS.cfg;
}

/** Map WF_explosion_v1 node 27 widgets_values → named sampler inputs (seed control slot aware). */
function remapWanSamplerFromUiWidgets(
  inputs: Record<string, unknown>,
  widgets: unknown[] | null,
): void {
  if (!widgets || widgets.length < 4) return;
  let i = 0;
  inputs.steps = widgets[i++];
  inputs.cfg = widgets[i++];
  inputs.shift = widgets[i++];
  inputs.seed = widgets[i++];
  if (i < widgets.length && isComfySeedControl(widgets[i])) i++;
  if (i < widgets.length) inputs.force_offload = widgets[i++];
  if (i < widgets.length) inputs.scheduler = widgets[i++];
  if (i < widgets.length) inputs.riflex_freq_index = widgets[i++];
  if (i < widgets.length && typeof widgets[i] === "number") {
    inputs.denoise_strength = widgets[i++];
  }
  // Newer Kijai builds append optional start/end/add_noise widgets after denoise_strength.
  if (i < widgets.length && typeof widgets[i] === "number") {
    inputs.start_step = widgets[i++];
  }
  if (i < widgets.length && typeof widgets[i] === "number") {
    inputs.end_step = widgets[i++];
  }
  if (i < widgets.length && typeof widgets[i] === "boolean") {
    inputs.add_noise_to_samples = widgets[i++];
  }
}

function coerceWanSamplerInputs(inputs: Record<string, unknown>): void {
  deleteNullInputs(inputs);
  flattenWanCfg(inputs);

  for (const key of WAN_SAMPLER_NUMERIC_KEYS) {
    const fallback = WAN_SAMPLER_DEFAULTS[key];
    inputs[key] = asWanNum(inputs[key], fallback);
  }

  inputs.force_offload = asWanBool(
    inputs.force_offload,
    WAN_SAMPLER_DEFAULTS.force_offload,
  );
  inputs.add_noise_to_samples = asWanBool(
    inputs.add_noise_to_samples,
    WAN_SAMPLER_DEFAULTS.add_noise_to_samples,
  );

  if (typeof inputs.scheduler !== "string" || !inputs.scheduler.trim()) {
    inputs.scheduler = WAN_SAMPLER_DEFAULTS.scheduler;
  }

  // Never queue cfg as a list — WanVideoSampler.process does `steps > len(cfg)`.
  if (Array.isArray(inputs.cfg)) {
    flattenWanCfg(inputs);
    inputs.cfg = asWanNum(inputs.cfg, WAN_SAMPLER_DEFAULTS.cfg);
  }

  if (!isLinkRef(inputs.feta_args)) delete inputs.feta_args;
  if (!isLinkRef(inputs.samples)) delete inputs.samples;
}

/** Throw before queue if convert left a sampler numeric as null/non-finite. */
export function assertWanVideoSamplerInputs(
  nodeId: string,
  inputs: Record<string, unknown>,
): void {
  const bad: string[] = [];
  for (const key of WAN_SAMPLER_NUMERIC_KEYS) {
    const v = inputs[key];
    if (v === null || v === undefined) {
      bad.push(`${key}=null`);
      continue;
    }
    if (typeof v !== "number" || !Number.isFinite(v)) {
      bad.push(`${key}=${JSON.stringify(v)}`);
    }
  }
  if (Array.isArray(inputs.cfg)) {
    bad.push(`cfg=array(${inputs.cfg.length})`);
  }
  if (bad.length) {
    throw new Error(
      `WanVideoSampler #${nodeId} bad inputs after sanitize (${bad.join(", ")}). Not queueing.`,
    );
  }
}

/**
 * Final pass after convert + UI remap + API patch.
 * /workflow/convert nulls optional sampler fields (start_step, end_step, denoise_strength…)
 * → Comfy None > int in get_scheduler / process.
 */
export function sanitizeWanFxApiPrompt(
  prompt: Record<string, unknown>,
  workflow?: UiWorkflow,
): void {
  const uiById = new Map<number, { widgets_values?: unknown }>();
  if (workflow?.nodes) {
    for (const n of workflow.nodes as Array<{
      id: number;
      type?: string;
      widgets_values?: unknown;
    }>) {
      if (n.type === "WanVideoSampler") uiById.set(n.id, n);
    }
  }

  deleteNullInputsDeep(prompt);

  for (const id of findApiNodesByClass(prompt, "WanVideoSampler")) {
    const node = prompt[id] as { inputs?: Record<string, unknown> } | undefined;
    if (!node?.inputs) continue;
    const ui = uiById.get(Number(id));
    const w = Array.isArray(ui?.widgets_values)
      ? (ui!.widgets_values as unknown[])
      : null;
    remapWanSamplerFromUiWidgets(node.inputs, w);
    coerceWanSamplerInputs(node.inputs);
    assertWanVideoSamplerInputs(id, node.inputs);
  }

  for (const id of findApiNodesByClass(prompt, "WanVideoImageToVideoEncode")) {
    const node = prompt[id] as { inputs?: Record<string, unknown> } | undefined;
    if (node?.inputs) coerceWanI2VEncodeInputs(node.inputs);
  }
}

function coerceWanI2VEncodeInputs(inputs: Record<string, unknown>): void {
  deleteNullInputs(inputs);

  inputs.width = asWanNum(inputs.width, WAN_I2V_ENCODE_DEFAULTS.width);
  inputs.height = asWanNum(inputs.height, WAN_I2V_ENCODE_DEFAULTS.height);
  inputs.num_frames = asWanNum(
    inputs.num_frames,
    WAN_I2V_ENCODE_DEFAULTS.num_frames,
  );
  inputs.noise_aug_strength = asWanNum(
    inputs.noise_aug_strength,
    WAN_I2V_ENCODE_DEFAULTS.noise_aug_strength,
  );
  inputs.start_latent_strength = asWanNum(
    inputs.start_latent_strength,
    WAN_I2V_ENCODE_DEFAULTS.start_latent_strength,
  );
  inputs.end_latent_strength = asWanNum(
    inputs.end_latent_strength,
    WAN_I2V_ENCODE_DEFAULTS.end_latent_strength,
  );
  inputs.force_offload = asWanBool(
    inputs.force_offload,
    WAN_I2V_ENCODE_DEFAULTS.force_offload,
  );
  inputs.fun_or_fl2v_model = asWanBool(
    inputs.fun_or_fl2v_model,
    WAN_I2V_ENCODE_DEFAULTS.fun_or_fl2v_model,
  );
  inputs.tiled_vae = asWanBool(
    inputs.tiled_vae,
    WAN_I2V_ENCODE_DEFAULTS.tiled_vae,
  );

  for (const k of Object.keys(inputs)) {
    if (/^frames$|^length$/i.test(k)) {
      inputs[k] = asWanNum(inputs[k], WAN_I2V_ENCODE_DEFAULTS.num_frames);
    }
  }
}

/**
 * /workflow/convert and object_info walks drift after Wan/VHS updates:
 * seed control slot shifts sampler widgets; VHS object widgets miss loop_count;
 * TextEncode optional toggles become [false,true] arrays; BlockSwap gains emb offloads;
 * ImageToVideoEncode object_info walk treats control_embeds as a widget → bool crash;
 * WanVideoSampler optional start_step/end_step/denoise_strength arrive as null → None > int.
 */
export function patchWanFxConvertFromUi(
  prompt: Record<string, unknown>,
  workflow: UiWorkflow,
): void {
  const uiById = new Map<number, { type?: string; widgets_values?: unknown }>();
  for (const n of (workflow.nodes || []) as Array<{
    id: number;
    type?: string;
    widgets_values?: unknown;
  }>) {
    uiById.set(n.id, n);
  }

  for (const id of findApiNodesByClass(prompt, "VHS_VideoCombine")) {
    patchFromUiObject(prompt, uiById, id, [
      "frame_rate",
      "loop_count",
      "filename_prefix",
      "format",
      "pix_fmt",
      "crf",
      "save_metadata",
      "trim_to_audio",
      "pingpong",
      "save_output",
    ]);
    const node = prompt[id] as { inputs?: Record<string, unknown> } | undefined;
    if (!node?.inputs) continue;
    if (node.inputs.loop_count === undefined) node.inputs.loop_count = 0;
    if (node.inputs.pingpong === undefined) node.inputs.pingpong = false;
  }

  for (const id of findApiNodesByClass(prompt, "WanVideoSampler")) {
    const node = prompt[id] as { inputs?: Record<string, unknown> } | undefined;
    const ui = uiById.get(Number(id));
    const w = Array.isArray(ui?.widgets_values)
      ? (ui!.widgets_values as unknown[])
      : null;
    if (node?.inputs) {
      remapWanSamplerFromUiWidgets(node.inputs, w);
      coerceWanSamplerInputs(node.inputs);
    }
  }

  for (const id of findApiNodesByClass(prompt, "WanVideoBlockSwap")) {
    const node = prompt[id] as { inputs?: Record<string, unknown> } | undefined;
    const ui = uiById.get(Number(id));
    const w = Array.isArray(ui?.widgets_values)
      ? (ui!.widgets_values as unknown[])
      : null;
    if (!node?.inputs) continue;
    node.inputs.blocks_to_swap =
      typeof w?.[0] === "number" ? w[0] : node.inputs.blocks_to_swap ?? 10;
    node.inputs.offload_img_emb =
      typeof w?.[1] === "boolean" ? w[1] : false;
    node.inputs.offload_txt_emb =
      typeof w?.[2] === "boolean" ? w[2] : false;
  }

  for (const id of findApiNodesByClass(prompt, "WanVideoTextEncode")) {
    const node = prompt[id] as { inputs?: Record<string, unknown> } | undefined;
    const ui = uiById.get(Number(id));
    const w = Array.isArray(ui?.widgets_values)
      ? (ui!.widgets_values as unknown[])
      : null;
    if (!node?.inputs || !w) continue;
    if (typeof w[0] === "string") node.inputs.positive_prompt = w[0];
    if (typeof w[1] === "string") node.inputs.negative_prompt = w[1];
    if (typeof w[2] === "boolean") node.inputs.force_offload = w[2];
    for (const k of Object.keys(node.inputs)) {
      const v = node.inputs[k];
      if (isLinkRef(v)) continue;
      if (Array.isArray(v)) delete node.inputs[k];
    }
    node.inputs.use_disk_cache =
      typeof w[4] === "boolean" ? w[4] : false;
    if ("model_to_offload" in node.inputs && !isLinkRef(node.inputs.model_to_offload)) {
      delete node.inputs.model_to_offload;
    }
  }

  for (const id of findApiNodesByClass(prompt, "WanVideoImageToVideoEncode")) {
    const node = prompt[id] as { inputs?: Record<string, unknown> } | undefined;
    const ui = uiById.get(Number(id));
    const w = Array.isArray(ui?.widgets_values)
      ? (ui!.widgets_values as unknown[])
      : null;
    if (node?.inputs && w && w.length >= 7) {
      let i = 0;
      node.inputs.width = w[i++];
      node.inputs.height = w[i++];
      node.inputs.num_frames = w[i++];
      node.inputs.noise_aug_strength = w[i++];
      node.inputs.start_latent_strength = w[i++];
      node.inputs.end_latent_strength = w[i++];
      node.inputs.force_offload = w[i++];
      if (i < w.length && typeof w[i] === "boolean") {
        node.inputs.fun_or_fl2v_model = w[i++];
      }
      if (i < w.length && typeof w[i] === "boolean") {
        node.inputs.tiled_vae = w[i++];
      }
      if (i < w.length && typeof w[i] === "number") {
        node.inputs.augment_empty_frames = w[i++];
      }

      // /workflow/convert assigns widget booleans to optional tensor sockets.
      for (const k of Object.keys(node.inputs)) {
        const v = node.inputs[k];
        if (isLinkRef(v)) continue;
        if (
          typeof v === "boolean" &&
          k !== "force_offload" &&
          k !== "fun_or_fl2v_model" &&
          k !== "tiled_vae"
        ) {
          delete node.inputs[k];
        }
      }
    }
    if (node?.inputs) coerceWanI2VEncodeInputs(node.inputs);
  }
}

/**
 * Patch API prompt for baby FX defaults:
 * plate image, short frames, sdpa, Explode LoRA, model, prompt, prefix.
 */
export function patchWanFxApiPrompt(opts: {
  prompt: Record<string, unknown>;
  imageRel: string;
  positive: string;
  frames: number;
  loraStrength: number;
  filenamePrefix: string;
}): void {
  const { prompt } = opts;

  for (const id of findApiNodesByClass(prompt, "LoadImage")) {
    patchApiNodeInputs(prompt, id, { image: opts.imageRel });
  }

  for (const id of findApiNodesByClass(prompt, "CLIPVisionLoader")) {
    patchApiNodeInputs(prompt, id, { clip_name: WAN_FX_CLIP_VISION });
  }

  for (const id of findApiNodesByClass(prompt, "WanVideoModelLoader")) {
    patchApiNodeInputs(prompt, id, {
      model: WAN_FX_MODEL,
      attention_mode: WAN_FX_ATTENTION,
    });
    // Some builds use different widget names
    const node = prompt[id] as { inputs?: Record<string, unknown> } | undefined;
    if (node?.inputs) {
      if ("model" in node.inputs) node.inputs.model = WAN_FX_MODEL;
      if ("attention_mode" in node.inputs) {
        node.inputs.attention_mode = WAN_FX_ATTENTION;
      } else if ("attention" in node.inputs) {
        node.inputs.attention = WAN_FX_ATTENTION;
      }
      // Common Kijai field
      for (const k of Object.keys(node.inputs)) {
        if (/attn|attention/i.test(k) && typeof node.inputs[k] === "string") {
          node.inputs[k] = WAN_FX_ATTENTION;
        }
      }
    }
  }

  for (const id of findApiNodesByClass(prompt, "WanVideoLoraSelect")) {
    patchApiNodeInputs(prompt, id, {
      lora: WAN_FX_LORA,
      strength: opts.loraStrength,
    });
    const node = prompt[id] as { inputs?: Record<string, unknown> } | undefined;
    if (node?.inputs) {
      if ("lora" in node.inputs) node.inputs.lora = WAN_FX_LORA;
      if ("strength" in node.inputs) node.inputs.strength = opts.loraStrength;
    }
  }

  for (const id of findApiNodesByClass(prompt, "WanVideoTextEncode")) {
    const node = prompt[id] as { inputs?: Record<string, unknown> } | undefined;
    if (!node?.inputs) continue;
    // Force positive; leave negative alone (WF keeps "cartoon" as Remade default)
    node.inputs.positive_prompt = opts.positive;
    if ("positive" in node.inputs) node.inputs.positive = opts.positive;
    for (const k of Object.keys(node.inputs)) {
      if (/neg/i.test(k)) continue;
      if (/positive|prompt/i.test(k) && typeof node.inputs[k] === "string") {
        node.inputs[k] = opts.positive;
      }
    }
  }

  for (const id of findApiNodesByClass(prompt, "WanVideoImageToVideoEncode")) {
    const node = prompt[id] as { inputs?: Record<string, unknown> } | undefined;
    if (!node?.inputs) continue;
    node.inputs.num_frames = opts.frames;
    if ("frames" in node.inputs) node.inputs.frames = opts.frames;
    if ("length" in node.inputs) node.inputs.length = opts.frames;
    for (const k of Object.keys(node.inputs)) {
      if (/frame/i.test(k) && typeof node.inputs[k] === "number") {
        node.inputs[k] = opts.frames;
      }
    }
  }

  for (const id of findApiNodesByClass(prompt, "VHS_VideoCombine")) {
    patchApiNodeInputs(prompt, id, {
      filename_prefix: opts.filenamePrefix,
      frame_rate: 16,
      format: "video/h264-mp4",
      loop_count: 0,
      pingpong: false,
      save_output: true,
    });
  }
}

/**
 * Upload plate → patch WF_explosion_v1 → queue → poll → pull to data/crash/wan_fx/
 * Does not Start the pod. Preflight must already be ok (or we re-check).
 */
export async function runWanFxSmoke(
  input: WanFxSmokeInput,
): Promise<WanFxSmokeResult> {
  const progress = (ev: WanFxProgressEvent) => {
    try {
      input.onProgress?.(ev);
    } catch {
      /* UI callback must not break the job */
    }
  };

  const plateAbs = wanFxPlatePath(input.plateName);
  if (!plateAbs) {
    throw new Error(
      `Pick a picture from _XX_SPX\\_PLATES — not found: ${input.plateName || "(none)"}`,
    );
  }

  const duration: WanFxDuration = input.duration === "normal" ? "normal" : "short";
  const boom: WanFxBoomSize =
    input.boom === "small" || input.boom === "big" ? input.boom : "normal";
  const frames = WAN_FX_FRAMES[duration];
  const loraStrength = WAN_FX_LORA_STRENGTH[boom];
  const positive = buildPositivePrompt(input.prompt);

  progress({ step: "resolving", message: "Finding Comfy…" });
  const resolved = await resolveComfyUrl(input.comfyUrl);
  if (!resolved.ok) throw new Error(resolved.error);
  const baseUrl = resolved.url;
  const hostShort = baseUrl.replace(/^https?:\/\//, "").slice(0, 48);

  const pre = await comfyWanFxPreflight(baseUrl);
  if (!pre.reachable) {
    throw new Error(
      `Comfy not answering at ${hostShort}. Start the pod, then Go. (${pre.error || pre.hint})`,
    );
  }
  if (!pre.ok) {
    const miss = pre.missing.slice(0, 8).join(", ");
    throw new Error(
      `Wan FX nodes missing (${miss}${pre.missing.length > 8 ? "…" : ""}). ${pre.hint}`,
    );
  }
  progress({
    step: "resolving",
    message: `Wan ready · ${hostShort} (${resolved.source})`,
    comfyUrl: baseUrl,
    comfySource: resolved.source,
  });

  // Safe-named copy for upload (spaces/odd chars break some pods)
  const safeBase = `${sortableId("plate")}_${path
    .basename(plateAbs)
    .replace(/[^\w.-]+/g, "_")}`;
  const safeLocal = path.join(wanFxUploadDir(), safeBase);
  fs.copyFileSync(plateAbs, safeLocal);

  progress({
    step: "uploading",
    message: `Uploading plate → ${hostShort}`,
    comfyUrl: baseUrl,
    comfySource: resolved.source,
  });
  const up = await comfyUploadFile({
    baseUrl,
    filePath: safeLocal,
    subfolder: UPLOAD_SUB,
    overwrite: true,
  });
  const imageRel = up.subfolder ? `${up.subfolder}/${up.name}` : up.name;

  const filenamePrefix = `wan_fx_explosion_${sortableId("b").slice(-8)}`;

  progress({
    step: "converting",
    message: "Building boom prompt (WF_explosion_v1)…",
    comfyUrl: baseUrl,
    comfySource: resolved.source,
  });
  const workflow = loadWanFxUi();
  const { prompt, via } = await uiWorkflowToApiPrompt(baseUrl, workflow);
  patchWanFxConvertFromUi(prompt, workflow);
  patchWanFxApiPrompt({
    prompt,
    imageRel,
    positive,
    frames,
    loraStrength,
    filenamePrefix,
  });
  sanitizeWanFxApiPrompt(prompt, workflow);

  try {
    fs.writeFileSync(
      path.join(wanFxCrashDir(), "_last_prompt.json"),
      JSON.stringify(prompt, null, 2),
      "utf8",
    );
  } catch {
    /* ignore */
  }

  progress({
    step: "converting",
    message: `Queueing boom (${via}) · ${frames} frames · ${WAN_FX_ATTENTION}…`,
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
            : `Boom running… ${Math.round(elapsedMs / 1000)}s — leave it`,
        promptId,
        elapsedMs,
      });
    },
  });

  let wanted = collectWanOutputs(outputs, filenamePrefix);
  if (!wanted.length) {
    const fallback = pickComfyVideoOutput(outputs);
    if (fallback) wanted = [fallback];
  }
  if (!wanted.length) {
    throw new Error(
      `Job ${promptId.slice(0, 8)}… finished but no boom mp4 (prefix ${filenamePrefix})`,
    );
  }

  const main = pickMainWan(wanted, filenamePrefix);
  if (!main) throw new Error("No boom video to pull");

  progress({
    step: "pulling",
    message: `Pulling ${main.subfolder ? `${main.subfolder}/` : ""}${main.filename}…`,
    promptId,
  });

  const buf = await comfyDownloadView({
    baseUrl,
    filename: main.filename,
    subfolder: main.subfolder,
    type: main.type,
  });
  const outName = `${sortableId("wanfx")}_${main.filename.replace(/[^\w.-]+/g, "_")}`;
  const localMp4 = path.join(
    wanFxCrashDir(),
    outName.endsWith(".mp4") || outName.endsWith(".webm")
      ? outName
      : `${outName}.mp4`,
  );
  fs.writeFileSync(localMp4, buf);

  const relative = path
    .relative(path.join(process.cwd()), localMp4)
    .split(path.sep)
    .join("\\");
  const url = `/api/crash/wan/file?name=${encodeURIComponent(path.basename(localMp4))}`;

  progress({ step: "done", message: "Done", promptId });
  return {
    ok: true,
    comfyUrl: baseUrl,
    comfySource: resolved.source,
    convertVia: via,
    promptId,
    uploadedImage: imageRel,
    localMp4,
    localMp4Relative: relative,
    url,
    frames,
    boom,
    duration,
  };
}
