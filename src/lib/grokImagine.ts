/**
 * /m GROK Imagine desk — in-house grok.com/imagine.
 * Image is grok-imagine-image-2.0. Video is still grok-imagine-video-1.5
 * (no video 2.0 on the API). Client-safe. Does not cook.
 */

export const GROK_IMAGINE_ENGINE = "grok" as const;

export const GROK_IMAGINE_IMAGE_MODEL = "grok-imagine-image-2.0";
export const GROK_IMAGINE_VIDEO_MODEL = "grok-imagine-video-1.5";

export type GrokImagineMode = "image" | "video";
export type GrokImagineImageRes = "1k" | "2k";
export type GrokImagineVideoRes = "480p" | "720p" | "1080p";
export type GrokImagineAspect = "16:9" | "1:1" | "9:16";

export const GROK_IMAGINE_VIDEO_SECS = [6, 10, 15] as const;
export const GROK_IMAGINE_VIDEO_RES = ["480p", "720p", "1080p"] as const;
export const GROK_IMAGINE_ASPECTS = ["16:9", "1:1", "9:16"] as const;

export type GrokImagineSettings = {
  mode: GrokImagineMode;
  prompt: string;
  plateFile: string;
  imageRes: GrokImagineImageRes;
  videoRes: GrokImagineVideoRes;
  durationSec: number;
  aspect: GrokImagineAspect;
  keepAudio: boolean;
};

export const GROK_IMAGINE_DEFAULTS: GrokImagineSettings = {
  mode: "video",
  prompt: "",
  plateFile: "",
  imageRes: "1k",
  videoRes: "720p",
  durationSec: 15,
  aspect: "16:9",
  keepAudio: false,
};

export function parseGrokImagineMode(value: string | null | undefined): GrokImagineMode {
  return value === "image" ? "image" : "video";
}

export function parseGrokImagineImageRes(value: string | null | undefined): GrokImagineImageRes {
  return value === "2k" ? "2k" : "1k";
}

export function parseGrokImagineVideoRes(value: string | null | undefined): GrokImagineVideoRes {
  if (value === "480p" || value === "1080p") return value;
  return "720p";
}

export function parseGrokImagineAspect(value: string | null | undefined): GrokImagineAspect {
  if (value === "1:1" || value === "9:16") return value;
  return "16:9";
}

export function snapGrokImagineDurationSec(sec: number): number {
  if (!Number.isFinite(sec) || sec <= 0) return 15;
  return Math.max(1, Math.min(15, Math.round(sec)));
}

export function normalizeGrokImagineSettings(
  raw?: Partial<GrokImagineSettings> | null,
): GrokImagineSettings {
  return {
    mode: parseGrokImagineMode(raw?.mode),
    prompt: (raw?.prompt || "").trim(),
    plateFile: (raw?.plateFile || "").trim(),
    imageRes: parseGrokImagineImageRes(raw?.imageRes),
    videoRes: parseGrokImagineVideoRes(raw?.videoRes),
    durationSec: snapGrokImagineDurationSec(Number(raw?.durationSec ?? 15)),
    aspect: parseGrokImagineAspect(raw?.aspect),
    keepAudio: raw?.keepAudio === true,
  };
}

function grokImagineKey(jobId: string, shotId: string): string {
  return `skidmarks.grokImagine.${(jobId || "").trim()}.${(shotId || "").trim()}`;
}

export function readGrokImagineSettings(jobId: string, shotId: string): GrokImagineSettings {
  if (typeof window === "undefined") return { ...GROK_IMAGINE_DEFAULTS };
  try {
    const raw = window.sessionStorage.getItem(grokImagineKey(jobId, shotId));
    if (!raw) return { ...GROK_IMAGINE_DEFAULTS };
    return normalizeGrokImagineSettings(JSON.parse(raw) as Partial<GrokImagineSettings>);
  } catch {
    return { ...GROK_IMAGINE_DEFAULTS };
  }
}

export function writeGrokImagineSettings(
  jobId: string,
  shotId: string,
  settings: GrokImagineSettings,
): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      grokImagineKey(jobId, shotId),
      JSON.stringify(normalizeGrokImagineSettings(settings)),
    );
  } catch {
    /* private mode */
  }
}

export function grokImagineFoldSummary(): string {
  return "GROK Imagine 2.0 · plate + prompt · in house · not LTX";
}

export function grokImagineFoldLines(): string[] {
  return [
    "Type to imagine. + attaches this plate (or another take). No leaving for grok.com.",
    "Image uses grok-imagine-image-2.0 (1k / 2k). Video uses grok-imagine-video-1.5 (1–15s). There is no video 2.0 yet.",
    "Video Send hangs on the existing TRACK clock. Image Send writes a new plate take — it does not cook LTX.",
    "Music-video clips strip Grok's invented sound unless you tap the speaker on.",
  ];
}

export function composeGrokImagineMotion(settings: GrokImagineSettings): string {
  const s = normalizeGrokImagineSettings(settings);
  if (s.mode === "image") {
    return `GROK Imagine 2.0 still · ${s.aspect} · ${s.imageRes}\n${s.prompt}`.trim();
  }
  return `GROK Imagine video · ${s.videoRes} · ${s.durationSec}s\n${s.prompt}`.trim();
}

export function grokImagineMotionLooksLike(text: string): boolean {
  return /^GROK Imagine/i.test((text || "").trim());
}

export type GrokImaginePlate = { fileName: string; label: string };

/**
 * Plates the GROK hole can send. Always include the still on this card
 * (plateFile) — H3 last-stills skip it, which left the hole empty while
 * the Buddha / place picture was already on screen.
 */
export function grokPlatesForShot(
  shot?: {
    plateFile?: string;
    plateTakes?: { fileName?: string }[];
    title?: string;
  } | null,
  extras?: { fileName?: string; title?: string; label?: string }[],
): GrokImaginePlate[] {
  const out: GrokImaginePlate[] = [];
  const seen = new Set<string>();
  const add = (file?: string, label?: string) => {
    const name = (file || "").trim();
    if (!name || name === "__error__" || seen.has(name)) return;
    seen.add(name);
    out.push({ fileName: name, label: (label || "").trim() || "Plate" });
  };
  add(shot?.plateFile, shot?.title || "This plate");
  for (const take of shot?.plateTakes || []) add(take.fileName, "Take");
  for (const extra of extras || []) {
    add(extra.fileName, extra.label || extra.title || "Still");
  }
  return out;
}
