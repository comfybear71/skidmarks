import { isSupportShot } from "./stockFootage";
import { isMusicVideoSongJob } from "./musicVideoSong";
import type { CrashStoryShot } from "./crashStoryTypes";

export const ARSENAL_EFFECT_IDS = [
  "shimmer",
  "split",
  "fade_text",
  "zoom",
  "shake",
] as const;

export type ArsenalEffectId = (typeof ARSENAL_EFFECT_IDS)[number];

export const ARSENAL_EFFECTS: {
  id: ArsenalEffectId;
  label: string;
  blurb: string;
}[] = [
  { id: "shimmer", label: "Shimmer", blurb: "Glow crawl on the picture" },
  { id: "split", label: "Split screen", blurb: "Two panes of the same clip" },
  { id: "fade_text", label: "Fade text", blurb: "Shot title fades over the clip" },
  { id: "zoom", label: "Zoom punch", blurb: "Slow push into the frame" },
  { id: "shake", label: "Shake", blurb: "Handheld jitter" },
];

export function isArsenalEffectId(raw: string): raw is ArsenalEffectId {
  return (ARSENAL_EFFECT_IDS as readonly string[]).includes(raw);
}

export function parseArsenalEffectId(raw: unknown): ArsenalEffectId | null {
  const id = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  return isArsenalEffectId(id) ? id : null;
}

function clipBase(clipFile: string): string {
  const raw = (clipFile || "").trim();
  if (!raw) return "";
  return raw.split(/[\\/]/).pop() || raw;
}

export function canApplyArsenalEffect(opts: {
  styleId?: string;
  shot?: Pick<CrashStoryShot, "footageRole"> | null;
  clipFile?: string;
}): { ok: true } | { ok: false; error: string } {
  if (!isMusicVideoSongJob({ styleId: opts.styleId })) {
    return { ok: false, error: "Arsenal of effects is music-video stock only." };
  }
  if (!isSupportShot(opts.shot)) {
    return { ok: false, error: "Arsenal of effects is Support stock only. Hero stays on LTX." };
  }
  if (!clipBase(opts.clipFile || "")) {
    return { ok: false, error: "Hang a stock clip first, then tap an effect." };
  }
  return { ok: true };
}

export function arsenalOutputName(srcFile: string, effectId: ArsenalEffectId): string {
  const base = clipBase(srcFile).replace(/\.mp4$/i, "");
  const stem = base || "stock";
  const tag = `_${effectId}`;
  const already = stem.endsWith(tag) ? stem : `${stem}${tag}`;
  return `${already}.mp4`;
}

export function escapeDrawtext(text: string): string {
  return (text || "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\u2019")
    .replace(/:/g, "\\:")
    .replace(/%/g, "\\%")
    .slice(0, 48);
}

export function arsenalFilterGraph(
  effectId: ArsenalEffectId,
  opts: { durationSec: number; text?: string; fontFile?: string },
): string {
  const dur = Math.max(0.4, Number(opts.durationSec) || 4);
  if (effectId === "shimmer") {
    return [
      "[0:v]split[base][glowsrc]",
      "[glowsrc]eq=brightness=0.06:saturation=1.2,gblur=sigma=9[glow]",
      "[base][glow]blend=all_mode=screen,eq=contrast=1.04,format=yuv420p",
    ].join(";");
  }
  if (effectId === "split") {
    return [
      "[0:v]split[l][r]",
      "[l]scale=iw/2:ih[l2]",
      "[r]scale=iw/2:ih[r2]",
      "[l2][r2]hstack=inputs=2,format=yuv420p",
    ].join(";");
  }
  if (effectId === "fade_text") {
    const font = (opts.fontFile || "").replace(/\\/g, "/").replace(/:/g, "\\:");
    const text = escapeDrawtext(opts.text || "STOCK");
    const fade = Math.min(0.8, dur / 3);
    const fontbit = font ? `fontfile=${font}:` : "";
    return (
      `drawtext=${fontbit}text='${text}':fontsize=h/14:fontcolor=white:` +
      `borderw=2:bordercolor=black:x=(w-text_w)/2:y=h*0.78:` +
      `alpha='if(lt(t,${fade}),t/${fade},if(gt(t,${dur}-${fade}),(${dur}-t)/${fade},1))'`
    );
  }
  if (effectId === "zoom") {
    return (
      `scale=iw*1.18:ih*1.18,` +
      `crop=iw/1.18:ih/1.18:x='(in_w-out_w)*min(t/${dur}\\,1)':y='(in_h-out_h)*min(t/${dur}\\,1)/2',` +
      `format=yuv420p`
    );
  }
  return (
    `crop=in_w-36:in_h-36:x='18+16*sin(14*t)':y='18+16*cos(17*t)',` +
    `scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p`
  );
}
