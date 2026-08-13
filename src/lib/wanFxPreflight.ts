import {
  comfyGetJson,
  comfyObjectInfo,
  resolveComfyUrl,
  type ObjectInfo,
} from "./comfyClient";

/**
 * WanVideoWrapper + VHS nodes required by WF_explosion_v1
 * (ClipVision + ImageToVideo Encode graph).
 */
export const WAN_FX_REQUIRED_NODES = [
  "LoadImage",
  "CLIPVisionLoader",
  "WanVideoClipVisionEncode",
  "WanVideoImageToVideoEncode",
  "WanVideoModelLoader",
  "WanVideoLoraSelect",
  "LoadWanVideoT5TextEncoder",
  "WanVideoTextEncode",
  "WanVideoVAELoader",
  "WanVideoSampler",
  "WanVideoDecode",
  "WanVideoBlockSwap",
  "VHS_VideoCombine",
] as const;

export type WanFxPreflightResult = {
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
      " — Start the pod, then Recheck (see workflow\\wan_fx\\INSTALL_WAN_FX.md). Do not expect Queue while cold."
    );
  }
  if (!missing.length) return "";

  const set = new Set(missing);
  const parts: string[] = [];
  if (
    [...set].some((n) => n.startsWith("WanVideo") || n === "LoadWanVideoT5TextEncoder")
  ) {
    parts.push(
      "Wan nodes missing → Start pod, paste pod_install_wan_fx.sh + boot_hotfix",
    );
  }
  if (set.has("VHS_VideoCombine")) {
    parts.push("VideoHelperSuite missing on pod");
  }
  if (set.has("CLIPVisionLoader")) {
    parts.push("CLIP vision loader missing");
  }
  parts.push(
    "See MY MOVIES\\workflow\\wan_fx\\INSTALL_WAN_FX.md · hard refresh Comfy",
  );
  return parts.join(" · ");
}

function missingFromObjectInfo(info: ObjectInfo): string[] {
  return WAN_FX_REQUIRED_NODES.filter((name) => !(name in info));
}

/**
 * Probe Comfy: reachable + Wan FX nodes present for WF_explosion_v1.
 * Never starts the pod.
 */
export async function comfyWanFxPreflight(
  comfyUrlOverride?: string,
): Promise<WanFxPreflightResult> {
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
    const found = await Promise.all(
      WAN_FX_REQUIRED_NODES.map(async (name) => {
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
    missing = WAN_FX_REQUIRED_NODES.filter((_, i) => !found[i]);
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
