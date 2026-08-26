import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { resolveFfmpeg } from "./mobileStitch";
import { arsenalFilterGraph, type ArsenalEffectId } from "./arsenalEffectsCatalog";

export {
  ARSENAL_EFFECT_IDS,
  ARSENAL_EFFECTS,
  arsenalFilterGraph,
  arsenalOutputName,
  canApplyArsenalEffect,
  escapeDrawtext,
  isArsenalEffectId,
  parseArsenalEffectId,
  type ArsenalEffectId,
} from "./arsenalEffectsCatalog";

function escapeAssText(text: string): string {
  return (text || "STOCK")
    .replace(/\\/g, "\\\\")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .slice(0, 48);
}

function assTimestamp(sec: number): string {
  const s = Math.max(0.2, Number(sec) || 4);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rem = s % 60;
  const whole = Math.floor(rem);
  const cs = Math.round((rem - whole) * 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(whole).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

/** ffmpeg-static has `ass` but not `drawtext`. */
export function writeArsenalAss(opts: { destPath: string; text: string; durationSec: number }): string {
  const fadeMs = Math.round(Math.min(800, Math.max(200, (opts.durationSec || 4) * 250)));
  const body = `[Script Info]
ScriptType: v4.00+
PlayResX: 1280
PlayResY: 720

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,DejaVu Sans,52,&H00FFFFFF,&H000000FF,&H00000000,&H64000000,1,0,0,0,100,100,0,0,1,3,0,2,40,40,56,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,${assTimestamp(opts.durationSec)},Default,,0,0,0,,{\\fad(${fadeMs},${fadeMs})}${escapeAssText(opts.text)}
`;
  fs.writeFileSync(opts.destPath, body);
  return opts.destPath;
}

function probeDurationWithFfmpeg(bin: string, filePath: string): number {
  try {
    execFileSync(bin, ["-i", filePath], { encoding: "utf8", timeout: 12_000 });
  } catch (e) {
    const err = e as { stderr?: string; stdout?: string };
    const blob = `${err.stderr || ""} ${err.stdout || ""}`;
    const m = blob.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
    if (m) {
      const sec = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
      if (Number.isFinite(sec) && sec > 0) return sec;
    }
  }
  return 4;
}

/** Re-encode one silent stock clip. Does not invent a TRACK clock. */
export function applyArsenalEffectFile(opts: {
  srcPath: string;
  destPath: string;
  effectId: ArsenalEffectId;
  text?: string;
}): void {
  const { bin } = resolveFfmpeg();
  if (!bin) throw new Error("No ffmpeg on this machine — cannot apply Arsenal of effects.");
  if (!fs.existsSync(opts.srcPath)) throw new Error("Stock clip file is missing.");
  const durationSec = probeDurationWithFfmpeg(bin, opts.srcPath);
  fs.mkdirSync(path.dirname(opts.destPath), { recursive: true });
  const args = ["-y", "-i", opts.srcPath];
  if (opts.effectId === "fade_text") {
    const assPath = `${opts.destPath}.ass`;
    writeArsenalAss({
      destPath: assPath,
      text: opts.text || "STOCK",
      durationSec,
    });
    args.push("-vf", `ass=${assPath.replace(/\\/g, "/").replace(/:/g, "\\:")}`);
  } else {
    args.push(
      "-filter_complex",
      arsenalFilterGraph(opts.effectId, { durationSec, text: opts.text }),
    );
  }
  args.push(
    "-an",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    opts.destPath,
  );
  execFileSync(bin, args, { timeout: 90_000, windowsHide: true });
  if (!fs.existsSync(opts.destPath) || fs.statSync(opts.destPath).size < 200) {
    throw new Error("Arsenal of effects did not write a clip.");
  }
}
