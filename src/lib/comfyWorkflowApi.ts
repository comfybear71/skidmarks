/**
 * Convert a Comfy UI-format workflow (nodes/links) into an API /prompt graph.
 *
 * LTXDirector widgets_values order ≠ object_info / /workflow/convert order
 * (global_prompt is force_input and shifts every later field). Always map
 * LTXDirector by Hotfix widget NAME, never by naive index into object_info.
 */

import {
  comfyObjectInfo,
  comfyTryWorkflowConvert,
  type ObjectInfo,
} from "./comfyClient";

export type UiWorkflow = {
  nodes?: Array<{
    id: number;
    type: string;
    mode?: number;
    inputs?: Array<{
      name: string;
      type?: string;
      link?: number | null;
      widget?: { name?: string };
    }>;
    outputs?: Array<{ name?: string; links?: number[] | null }>;
    widgets_values?: unknown;
  }>;
  links?: Array<
    | [number, number, number, number, number, string]
    | { id: number; origin_id: number; origin_slot: number; target_id: number; target_slot: number }
  >;
};

const SKIP_TYPES = new Set([
  "MarkdownNote",
  "Note",
  "Reroute",
  "PrimitiveNode",
]);

/** Linked-only Comfy types — no widgets_values slot. */
const LINK_ONLY_TYPES = new Set([
  "MODEL",
  "CLIP",
  "VAE",
  "CONDITIONING",
  "LATENT",
  "IMAGE",
  "MASK",
  "AUDIO",
  "VIDEO",
  "GUIDE_DATA",
  "MOTION_GUIDE_DATA",
  "LATENT_UPSCALE_MODEL",
  "NOISE",
  "GUIDER",
  "SAMPLER",
  "SIGMAS",
]);

function linkMap(workflow: UiWorkflow): Map<
  number,
  { fromId: number; fromSlot: number }
> {
  const map = new Map<number, { fromId: number; fromSlot: number }>();
  for (const raw of workflow.links || []) {
    if (Array.isArray(raw)) {
      map.set(raw[0], { fromId: raw[1], fromSlot: raw[2] });
    } else if (raw && typeof raw === "object") {
      map.set(raw.id, {
        fromId: raw.origin_id,
        fromSlot: raw.origin_slot,
      });
    }
  }
  return map;
}

function isForceInput(spec: unknown): boolean {
  if (!Array.isArray(spec) || spec.length < 2) return false;
  const conf = spec[1];
  return (
    !!conf &&
    typeof conf === "object" &&
    !Array.isArray(conf) &&
    (conf as { forceInput?: boolean }).forceInput === true
  );
}

function widgetNameOrder(info: ObjectInfo, classType: string): string[] {
  const node = info[classType];
  if (!node?.input) return [];
  const names: string[] = [];
  for (const key of ["required", "optional"] as const) {
    const block = node.input[key];
    if (!block) continue;
    for (const [name, spec] of Object.entries(block)) {
      if (!Array.isArray(spec)) continue;
      const typeName = String(spec[0] || "");
      if (LINK_ONLY_TYPES.has(typeName)) continue;
      // forceInput sockets are NOT in widgets_values
      if (isForceInput(spec)) continue;
      names.push(name);
    }
  }
  return names;
}

/**
 * Hotfix LTXDirector widgets_values order (Desktop Hotfix JSON node 131).
 * global_prompt is a force_input STRING socket — NOT in this list.
 * Index 22 in the file is an empty trailing slot — ignore.
 */
export const LTX_DIRECTOR_WIDGET_NAMES = [
  "start_second",
  "end_second",
  "duration_seconds",
  "start_frame",
  "end_frame",
  "duration_frames",
  "timeline_data",
  "local_prompts",
  "segment_lengths",
  "epsilon",
  "guide_strength",
  "use_custom_audio",
  "use_custom_motion",
  "inpaint_audio",
  "frame_rate",
  "display_mode",
  "custom_width",
  "custom_height",
  "resize_method",
  "divisible_by",
  "img_compression",
  "override_audio",
] as const;

const LTX_RESIZE_METHODS = new Set([
  "maintain aspect ratio",
  "stretch to fit",
  "pad",
  "pad green",
  "crop",
]);

const LTX_DISPLAY_MODES = new Set(["seconds", "frames"]);

function asFiniteNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function applyLtxDirectorWidgetMap(
  inputs: Record<string, unknown>,
  widgets: unknown[],
): void {
  for (let i = 0; i < LTX_DIRECTOR_WIDGET_NAMES.length && i < widgets.length; i++) {
    const key = LTX_DIRECTOR_WIDGET_NAMES[i]!;
    // Keep linked sockets — only fill widget fields
    if (Array.isArray(inputs[key])) continue;
    inputs[key] = widgets[i];
  }
  const td = widgets[6];
  if (typeof td === "string" && td.startsWith("{")) {
    inputs.timeline_data = td;
  }
  coerceLtxDirectorInputs(inputs);
}

/**
 * Fix combo / int mixups from /workflow/convert or bad object_info walks.
 * Classic index-shift symptoms:
 *   resize_method ← 32 (divisible_by)
 *   frame_rate ← "seconds" (display_mode)
 *   display_mode ← 0 (custom_width)
 *   custom_height ← "maintain aspect ratio" (resize_method)
 */
export function coerceLtxDirectorInputs(inputs: Record<string, unknown>): void {
  // --- resize_method (combo string) ---
  const rm = inputs.resize_method;
  if (typeof rm !== "string" || !LTX_RESIZE_METHODS.has(rm)) {
    if (typeof rm === "number" && Number.isFinite(rm)) {
      if (asFiniteNumber(inputs.divisible_by) == null) {
        inputs.divisible_by = rm;
      }
    }
    // Recover if custom_height stole the string
    const ch = inputs.custom_height;
    if (typeof ch === "string" && LTX_RESIZE_METHODS.has(ch)) {
      inputs.resize_method = ch;
    } else {
      inputs.resize_method = "maintain aspect ratio";
    }
  }

  // --- display_mode (combo string) ---
  const dm = inputs.display_mode;
  if (typeof dm !== "string" || !LTX_DISPLAY_MODES.has(dm)) {
    // Recover if frame_rate stole "seconds"/"frames"
    const fr = inputs.frame_rate;
    if (typeof fr === "string" && LTX_DISPLAY_MODES.has(fr)) {
      inputs.display_mode = fr;
    } else {
      inputs.display_mode = "seconds";
    }
  }

  // --- frame_rate (number) ---
  let frameRate = asFiniteNumber(inputs.frame_rate);
  if (frameRate == null || frameRate <= 0 || frameRate > 120) {
    frameRate = 24;
  }
  inputs.frame_rate = frameRate;

  // --- custom_width / custom_height (ints; 0 = auto in Hotfix defaults) ---
  let cw = asFiniteNumber(inputs.custom_width);
  let ch = asFiniteNumber(inputs.custom_height);
  if (cw == null || cw < 0) cw = 768;
  if (ch == null || ch < 0) ch = 512;
  // Studio gold lot is 768×512 — if both still 0 (Hotfix defaults), set them
  if (cw === 0 && ch === 0) {
    cw = 768;
    ch = 512;
  }
  inputs.custom_width = Math.round(cw);
  inputs.custom_height = Math.round(ch);

  // --- divisible_by / img_compression ---
  let div = asFiniteNumber(inputs.divisible_by);
  if (div == null || div <= 0) div = 32;
  inputs.divisible_by = Math.round(div);

  let comp = asFiniteNumber(inputs.img_compression);
  if (comp == null || comp < 0) comp = 18;
  inputs.img_compression = Math.round(comp);

  // --- booleans that sometimes arrive as 0/1/strings ---
  for (const key of [
    "use_custom_audio",
    "use_custom_motion",
    "inpaint_audio",
    "override_audio",
  ] as const) {
    const v = inputs[key];
    if (typeof v === "boolean") continue;
    if (v === 1 || v === "1" || v === "true" || v === "True") inputs[key] = true;
    else if (v === 0 || v === "0" || v === "false" || v === "False") inputs[key] = false;
  }
}

/** Walk API prompt and coerce every LTXDirector / tiny_vae node. */
export function sanitizeApiPromptCombos(prompt: Record<string, unknown>): void {
  for (const raw of Object.values(prompt)) {
    const n = raw as { class_type?: string; inputs?: Record<string, unknown> };
    if (n.class_type === "LTXDirector" && n.inputs) {
      coerceLtxDirectorInputs(n.inputs);
    }
    if (n.class_type === "ModelPreviewOverrideKJ" && n.inputs) {
      if (n.inputs.tiny_vae === "" || n.inputs.tiny_vae == null) {
        n.inputs.tiny_vae = "none";
      }
    }
  }
}

/**
 * After any convert path: rebuild LTXDirector widget fields from the UI
 * workflow by NAME (Hotfix order). Linked tensors stay; convert's shifted
 * combos are overwritten.
 */
export function rematerializeLtxDirectorFromUi(
  prompt: Record<string, unknown>,
  workflow: UiWorkflow,
): void {
  for (const node of workflow.nodes || []) {
    if (node.type !== "LTXDirector") continue;
    if (!Array.isArray(node.widgets_values)) continue;
    const key = String(node.id);
    const api = prompt[key] as
      | { class_type?: string; inputs?: Record<string, unknown> }
      | undefined;
    if (!api?.inputs) continue;
    applyLtxDirectorWidgetMap(api.inputs, node.widgets_values);
  }
  // Also coerce any LTXDirector whose id didn't match (rare rename)
  sanitizeApiPromptCombos(prompt);
}

function workflowHasClass(workflow: UiWorkflow, classType: string): boolean {
  return (workflow.nodes || []).some((n) => n.type === classType);
}

function convertWithObjectInfo(
  workflow: UiWorkflow,
  info: ObjectInfo,
): Record<string, unknown> {
  const links = linkMap(workflow);
  const prompt: Record<string, unknown> = {};

  for (const node of workflow.nodes || []) {
    if (SKIP_TYPES.has(node.type)) continue;
    // mode 2 = mute, 4 = never
    if (node.mode === 2 || node.mode === 4) continue;

    const inputs: Record<string, unknown> = {};
    const widgets = Array.isArray(node.widgets_values)
      ? [...node.widgets_values]
      : [];
    let wIdx = 0;

    // Wire linked inputs first (model/clip/vae/…)
    for (const inp of node.inputs || []) {
      if (inp.link != null) {
        const L = links.get(inp.link);
        if (L) {
          inputs[inp.name] = [String(L.fromId), L.fromSlot];
        }
        // Linked widget inputs still consume a widgets_values slot in some graphs
        if (inp.widget && wIdx < widgets.length) {
          wIdx += 1;
        }
      }
    }

    if (node.type === "LTXDirector" && Array.isArray(node.widgets_values)) {
      // Never walk object_info order for Director — global_prompt shifts everything
      applyLtxDirectorWidgetMap(inputs, node.widgets_values);
    } else {
      // Unlinked widget sockets from the node definition
      for (const inp of node.inputs || []) {
        if (inp.link != null) continue;
        if (!inp.widget) continue;
        if (wIdx < widgets.length) {
          inputs[inp.name] = widgets[wIdx++];
        }
      }
      // Remaining widgets mapped by object_info order for names not yet set
      const order = widgetNameOrder(info, node.type);
      for (const name of order) {
        if (name in inputs) continue;
        if (wIdx >= widgets.length) break;
        inputs[name] = widgets[wIdx++];
      }
    }

    if (node.type === "ModelPreviewOverrideKJ" && Array.isArray(node.widgets_values)) {
      const wv = node.widgets_values;
      if (wv.length >= 6 && (wv[5] === "" || wv[5] == null)) {
        inputs.tiny_vae = "none";
      }
    }

    prompt[String(node.id)] = {
      class_type: node.type,
      inputs,
    };
  }

  return prompt;
}

/**
 * Throw if LTXDirector still has shifted combo types — never queue garbage.
 */
export function assertLtxDirectorInputsSane(
  prompt: Record<string, unknown>,
): void {
  for (const [id, raw] of Object.entries(prompt)) {
    const n = raw as { class_type?: string; inputs?: Record<string, unknown> };
    if (n.class_type !== "LTXDirector" || !n.inputs) continue;
    const i = n.inputs;
    const problems: string[] = [];
    if (typeof i.resize_method !== "string" || !LTX_RESIZE_METHODS.has(i.resize_method)) {
      problems.push(`resize_method=${JSON.stringify(i.resize_method)}`);
    }
    if (typeof i.display_mode !== "string" || !LTX_DISPLAY_MODES.has(i.display_mode)) {
      problems.push(`display_mode=${JSON.stringify(i.display_mode)}`);
    }
    if (asFiniteNumber(i.frame_rate) == null) {
      problems.push(`frame_rate=${JSON.stringify(i.frame_rate)}`);
    }
    if (asFiniteNumber(i.custom_height) == null) {
      problems.push(`custom_height=${JSON.stringify(i.custom_height)}`);
    }
    if (asFiniteNumber(i.divisible_by) == null) {
      problems.push(`divisible_by=${JSON.stringify(i.divisible_by)}`);
    }
    if (problems.length) {
      throw new Error(
        `LTXDirector #${id} still has bad inputs after convert (${problems.join(", ")}). Not queueing.`,
      );
    }
  }
}

export async function uiWorkflowToApiPrompt(
  baseUrl: string,
  workflow: UiWorkflow,
): Promise<{ prompt: Record<string, unknown>; via: string }> {
  const hasLtx = workflowHasClass(workflow, "LTXDirector");

  // /workflow/convert on the pod naively walks widgets and shifts LTXDirector
  // combos (resize_method=32, frame_rate="seconds", …). Skip it when Director
  // is present — our name map is the source of truth.
  let prompt: Record<string, unknown> | null = null;
  let via = "object_info";

  if (!hasLtx) {
    const converted = await comfyTryWorkflowConvert(baseUrl, workflow);
    if (converted && Object.keys(converted).length > 0) {
      prompt = converted;
      via = "workflow/convert";
    }
  }

  if (!prompt) {
    const info = await comfyObjectInfo(baseUrl);
    prompt = convertWithObjectInfo(workflow, info);
    via = "object_info";
  }

  if (!Object.keys(prompt).length) {
    throw new Error("UI→API convert produced empty prompt");
  }

  // Belt: always re-apply Hotfix widgets by NAME onto any LTXDirector nodes
  rematerializeLtxDirectorFromUi(prompt, workflow);
  sanitizeApiPromptCombos(prompt);
  assertLtxDirectorInputsSane(prompt);

  return { prompt, via };
}

/** Patch API prompt node inputs after conversion. */
export function patchApiNodeInputs(
  prompt: Record<string, unknown>,
  nodeId: string | number,
  patch: Record<string, unknown>,
): void {
  const key = String(nodeId);
  const node = prompt[key] as { inputs?: Record<string, unknown> } | undefined;
  if (!node?.inputs) return;
  Object.assign(node.inputs, patch);
}

export function findApiNodesByClass(
  prompt: Record<string, unknown>,
  classType: string,
): string[] {
  const ids: string[] = [];
  for (const [id, raw] of Object.entries(prompt)) {
    const n = raw as { class_type?: string };
    if (n.class_type === classType) ids.push(id);
  }
  return ids;
}
