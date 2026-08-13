import {
  comfyGetJson,
  comfyObjectInfo,
  resolveComfyUrl,
  type ObjectInfo,
} from "./comfyClient";

/**
 * MuseTalk WF_lipsync_v1d class_types that must exist before Crash Lab Lipsync queues.
 * Patches: MuseTalk-KJ custom_operations + VHS AUDIO dict — see workflow/lipsync/INSTALL_MUSETALK.md
 */
export const LIPSYNC_REQUIRED_NODES = [
  "VHS_LoadVideo",
  "VHS_LoadAudio",
  "VHS_VideoCombine",
  "VHS_AudioToVHSAudio",
  "muse_talk_sampler",
  "UNETLoader_MuseTalk",
  "DWPreprocessor",
  "BatchCropFromMask",
  "GrowMaskWithBlur",
  "ImageResize+",
  "vhs_audio_to_audio_tensor",
  "whisper_to_features",
] as const;

export type LipsyncPreflightResult = {
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
      " — start the pod / set COMFY_URL, then Recheck (see workflow\\lipsync\\INSTALL_MUSETALK.md)"
    );
  }
  if (!missing.length) return "";

  const set = new Set(missing);
  const parts: string[] = [];

  if (
    set.has("muse_talk_sampler") ||
    set.has("UNETLoader_MuseTalk") ||
    set.has("whisper_to_features")
  ) {
    parts.push(
      "MuseTalk nodes → paste pod_install_musetalk.sh + boot_hotfix (INSTALL_MUSETALK.md)",
    );
  }
  if (
    set.has("VHS_LoadVideo") ||
    set.has("VHS_LoadAudio") ||
    set.has("VHS_VideoCombine")
  ) {
    parts.push("VideoHelperSuite missing on pod");
  }
  if (set.has("DWPreprocessor")) {
    parts.push("controlnet_aux (DWPreprocessor) missing");
  }
  if (set.has("ImageResize+") || set.has("BatchCropFromMask")) {
    parts.push("essentials / crop nodes missing");
  }

  parts.push(
    "Run MuseTalk install on CrashLabs pod · hard refresh Comfy · see MY MOVIES\\workflow\\lipsync\\INSTALL_MUSETALK.md",
  );
  return parts.join(" · ");
}

function missingFromObjectInfo(info: ObjectInfo): string[] {
  return LIPSYNC_REQUIRED_NODES.filter((name) => !(name in info));
}

/**
 * Probe Comfy: reachable + MuseTalk / VHS nodes present for WF_lipsync_v1d.
 */
export async function comfyLipsyncPreflight(
  comfyUrlOverride?: string,
): Promise<LipsyncPreflightResult> {
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
      LIPSYNC_REQUIRED_NODES.map(async (name) => {
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
    missing = LIPSYNC_REQUIRED_NODES.filter((_, i) => !found[i]);
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
