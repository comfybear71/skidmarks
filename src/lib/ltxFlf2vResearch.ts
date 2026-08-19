/**
 * Verified from the official Comfy Hub JSON for
 * https://comfy.org/workflows/d78377cf53f4-d78377cf53f4/
 * downloaded this session as d78377cf53f4.json (130588 bytes).
 *
 * Knowledge only — /m speech stays on LTX-2.3 IA2V + our mp3.
 */

export const LTX_25_FLF2V_HUB_HASH = "d78377cf53f4";
export const LTX_25_FLF2V_HUB_URL =
  "https://comfy.org/workflows/d78377cf53f4-d78377cf53f4/";
export const LTX_25_FLF2V_SUBGRAPH_ID = "cf70afc4-5a03-47ce-8210-734b1de6c6bc";
export const LTX_25_FLF2V_SUBGRAPH_NAME = "First & Last Frame to Video (LTX-2.5)";

/** Distilled FLF2V template defaults (subgraph widgets). */
export const LTX_25_FLF2V_DEFAULTS = {
  durationSec: 5,
  width: 1280,
  height: 720,
  fps: 24,
  promptEnhance: true,
  firstGuideFrameIdx: 0,
  lastGuideFrameIdx: -1,
  guideStrength: 0.7,
  preprocessCrf: 18,
  videoCfg: 1,
  audioCfg: 1,
  /** Distilled 8-step recipe; the widget lists 9 sigma values (start through 0). */
  sigmaValues: 9,
  sigmaSteps: 8,
} as const;

/** LTX latent length: seconds × fps + 1 (8n+1). Same expression as our IA2V template. */
export function ltxFlf2vFrameCount(durationSec: number, fps: number): number {
  return durationSec * fps + 1;
}

export const LTX_25_FLF2V_MODELS = {
  unet: "ltx-2.5-22b-distilled-transformer-comfy-int8-convrot.safetensors",
  videoVae: "ltx-2.5-video-vae-bf16.safetensors",
  audioVae: "ltx-2.5-audio-vae-bf16.safetensors",
  clip: "gemma4-12b-with-proj-ltx-2.5-comfy-int8-convrot.safetensors",
  promptEnhance: "gemma4_e2b_it_bf16.safetensors",
} as const;

/** Official demo lock — start AND end. /m gold only locks the start. */
export const LTX_25_FLF2V_PROMPT_LOCK =
  "Use the provided start image as the first frame and the provided end image as the final frame anchor.";

export const LTX_25_FLF2V_SIGMAS =
  "1.0, 0.99375, 0.9875, 0.98125, 0.975, 0.909375, 0.725, 0.421875, 0.0";
