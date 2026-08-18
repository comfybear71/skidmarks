/**
 * Scratch Generate — Siray i2v spicy models.
 * Client-safe (no env / fs). Same key, only the model string changes.
 * 2.0 is the cheap first pass; 2.5 / Wan are later swaps.
 */

export type SirayI2vId = "seedance-20" | "seedance-25" | "wan-27" | "wan-30";

export type SirayI2vSpec = {
  id: SirayI2vId;
  model: string;
  label: string;
  shortLabel: string;
  hint: string;
  minSec: number;
  maxSec: number;
  size: "720p";
  /** Seedance + Wan 3.0 require this. Wan 2.7 does not accept it. */
  aspectRatio?: "adaptive";
};

export const SIRAY_I2V_DEFAULT: SirayI2vId = "seedance-20";

export const SIRAY_I2V_MODELS: readonly SirayI2vSpec[] = [
  {
    id: "seedance-20",
    model: "bytedance/seedance-2.0-i2v-spicy",
    label: "Seedance 2.0 Spicy",
    shortLabel: "2.0",
    hint: "Cheap first pass. 4–15s from the mp3.",
    minSec: 4,
    maxSec: 15,
    size: "720p",
    aspectRatio: "adaptive",
  },
  {
    id: "seedance-25",
    model: "bytedance/seedance-2.5-i2v-spicy",
    label: "Seedance 2.5 Spicy",
    shortLabel: "2.5",
    hint: "Dearer. Follows the mp3 up to 30s.",
    minSec: 4,
    maxSec: 30,
    size: "720p",
    aspectRatio: "adaptive",
  },
  {
    id: "wan-27",
    model: "alibaba/wan-2.7-i2v-spicy",
    label: "Wan 2.7 Spicy",
    shortLabel: "Wan 2.7",
    hint: "2–15s from the mp3.",
    minSec: 2,
    maxSec: 15,
    size: "720p",
  },
  {
    id: "wan-30",
    model: "alibaba/wan-3.0-i2v-spicy",
    label: "Wan 3.0 Spicy",
    shortLabel: "Wan 3.0",
    hint: "Follows the mp3 up to 30s.",
    minSec: 2,
    maxSec: 30,
    size: "720p",
    aspectRatio: "adaptive",
  },
];

export function isSirayI2vId(value: string): value is SirayI2vId {
  return SIRAY_I2V_MODELS.some((row) => row.id === value);
}

export function sirayI2vSpec(id: string | undefined): SirayI2vSpec {
  return SIRAY_I2V_MODELS.find((row) => row.id === id) || SIRAY_I2V_MODELS[0];
}

/** `siray` / `siray-spicy` stay the cheap 2.0 first pass. */
export function parseScratchClipEngine(raw: string | undefined): "ltx" | SirayI2vId {
  const value = (raw || "ltx").trim().toLowerCase();
  if (!value || value === "ltx") return "ltx";
  if (value === "siray" || value === "siray-spicy" || value === "siray-i2v") return SIRAY_I2V_DEFAULT;
  if (isSirayI2vId(value)) return value;
  throw new Error(`Unknown clip engine: ${raw}`);
}

export function clampSirayI2vDurationSec(
  sec: number,
  minSec = SIRAY_I2V_MODELS[0].minSec,
  maxSec = SIRAY_I2V_MODELS[0].maxSec,
): number {
  const fallback = Math.min(maxSec, Math.max(minSec, 5));
  if (!Number.isFinite(sec) || sec <= 0) return fallback;
  return Math.max(minSec, Math.min(maxSec, Math.round(sec)));
}
