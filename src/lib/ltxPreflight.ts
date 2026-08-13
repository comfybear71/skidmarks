import {
  comfyGetJson,
  comfyObjectInfo,
  resolveComfyUrl,
  type ObjectInfo,
} from "./comfyClient";

/**
 * Hotfix class_types that must exist in Comfy `/object_info`
 * before Studio queues Send to LTX.
 */
export const LTX_HOTFIX_REQUIRED_NODES = [
  "CreateVideo",
  "SaveVideo",
  "LTXDirector",
  "LTXDirectorGuide",
  "LTXDirectorCropGuides",
  "VAELoaderKJ",
  "ModelPreviewOverrideKJ",
  "LTXVConcatAVLatent",
  "LTXVSeparateAVLatent",
  "LTXVAudioVAEDecode",
  "LTXVConditioning",
  "LTXVLatentUpsampler",
  "LatentUpscaleModelLoader",
] as const;

export type LtxPreflightResult = {
  ok: boolean;
  missing: string[];
  comfyUrl: string;
  source: string;
  reachable: boolean;
  hint: string;
  error?: string;
};

function buildHint(missing: string[], unreachable?: string): string {
  if (unreachable) {
    return (
      unreachable +
      " — start the pod / set COMFY_URL, then run bash /workspace/boot_hotfix.sh (POD_COMFY_BOOT.md)"
    );
  }
  if (!missing.length) return "";

  const set = new Set(missing);
  const parts: string[] = [];

  if (set.has("CreateVideo") || set.has("SaveVideo")) {
    parts.push(
      "CreateVideo/SaveVideo = Comfy core too old — see POD_COMFY_BOOT.md → CreateVideo check",
    );
  }

  const director = [
    "LTXDirector",
    "LTXDirectorGuide",
    "LTXDirectorCropGuides",
  ].filter((n) => set.has(n));
  if (director.length) {
    parts.push("Director nodes → WhatDreamsCost via boot_hotfix");
  }

  const kj = ["VAELoaderKJ", "ModelPreviewOverrideKJ"].filter((n) =>
    set.has(n),
  );
  if (kj.length) {
    parts.push("KJ nodes → ComfyUI-KJNodes via boot_hotfix");
  }

  const ltx = [
    "LTXVConcatAVLatent",
    "LTXVSeparateAVLatent",
    "LTXVAudioVAEDecode",
    "LTXVConditioning",
    "LTXVLatentUpsampler",
    "LatentUpscaleModelLoader",
  ].filter((n) => set.has(n));
  if (ltx.length) {
    parts.push("LTXV* → ComfyUI-LTXVideo via boot_hotfix");
  }

  parts.push(
    "Run bash /workspace/boot_hotfix.sh · hard refresh Comfy · see MY MOVIES\\workflow\\POD_COMFY_BOOT.md",
  );
  return parts.join(" · ");
}

function missingFromObjectInfo(info: ObjectInfo): string[] {
  return LTX_HOTFIX_REQUIRED_NODES.filter((name) => !(name in info));
}

/**
 * Probe Comfy: reachable + required Hotfix class_types present.
 * Prefers one `/object_info` GET; falls back to per-node probes if that fails.
 * If Comfy Cloud API key is set, preflight passes (Send All uses Cloud IA2V).
 */
export async function comfyLtxPreflight(
  comfyUrlOverride?: string,
): Promise<LtxPreflightResult> {
  const { preferComfyCloudLtx } = await import("./ltxCloudIa2v");
  const { COMFY_CLOUD_BASE } = await import("./comfyCloudClient");
  if (preferComfyCloudLtx()) {
    return {
      ok: true,
      missing: [],
      comfyUrl: COMFY_CLOUD_BASE,
      source: "cloud",
      reachable: true,
      hint: "Comfy Cloud ready · LTX-2.3 IA2V (no pod needed)",
    };
  }

  const resolved = await resolveComfyUrl(comfyUrlOverride);
  if (!resolved.ok) {
    return {
      ok: false,
      missing: [],
      comfyUrl: "",
      source: "",
      reachable: false,
      hint: buildHint([], resolved.error),
      error: resolved.error,
    };
  }

  const baseUrl = resolved.url;
  const hostShort = baseUrl.replace(/^https?:\/\//, "").slice(0, 48);

  try {
    await comfyGetJson(baseUrl, "/system_stats", { timeoutMs: 20_000 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      missing: [],
      comfyUrl: baseUrl,
      source: resolved.source,
      reachable: false,
      hint: buildHint([], `Comfy not answering at ${hostShort}`),
      error: msg,
    };
  }

  let missing: string[] = [];
  try {
    const info = await comfyObjectInfo(baseUrl);
    missing = missingFromObjectInfo(info);
  } catch {
    // Full object_info can fail/timeout on some proxies — probe key nodes
    const found = await Promise.all(
      LTX_HOTFIX_REQUIRED_NODES.map(async (name) => {
        try {
          const one = (await comfyGetJson(baseUrl, `/object_info/${name}`, {
            timeoutMs: 15_000,
          })) as ObjectInfo;
          return name in one || Object.keys(one).length > 0;
        } catch {
          return false;
        }
      }),
    );
    missing = LTX_HOTFIX_REQUIRED_NODES.filter((_, i) => !found[i]);
  }

  const hint = buildHint(missing);
  return {
    ok: missing.length === 0,
    missing,
    comfyUrl: baseUrl,
    source: resolved.source,
    reachable: true,
    hint,
    error: missing.length
      ? `Missing nodes: ${missing.slice(0, 6).join(", ")}${
          missing.length > 6 ? "…" : ""
        }`
      : undefined,
  };
}
