import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  MATH_PATTERN_DISSOLVE,
  MATH_PATTERN_OUTBREAK,
  MATH_PATTERN_SHIFT,
  composeMathPatternMotion,
  mathPatternMotionLooksLike,
  mathPatternPhaseId,
  mathPatternPhaseValue,
  mathPatternSeed,
  muteMvMathFoldLines,
  muteMvMathFoldSummary,
  normalizeMathPatternSettings,
  parseMathPatternEmotion,
} from "../src/lib/mathPatternMotion.ts";
import { cookDurationFromHungBar } from "../src/lib/musicVideoTrack.ts";
import { parseMuteMvEngine, resolveMvSendEngine } from "../src/lib/mobileImageMotion.ts";
import { MATH_PATTERN_MODE_LABELS, MATH_PATTERN_PALETTE_LABELS } from "../src/lib/mathPatternShader.ts";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(parseMuteMvEngine("math") === "math", "parse math");
assert(parseMuteMvEngine("h3") === "h3", "parse h3 still works");
assert(parseMuteMvEngine("ltx") === "ltx", "parse ltx");
assert(parseMuteMvEngine("nope") === "ltx", "junk is ltx");
assert(parseMathPatternEmotion("excited") === "excited", "excited");
assert(parseMathPatternEmotion("calm") === "calm", "calm");

assert(
  resolveMvSendEngine({ jobId: "j", picked: "math" }) === "math",
  "picked math wins",
);

assert(MATH_PATTERN_OUTBREAK.includes("kaleidoscopic"), "outbreak gold");
assert(MATH_PATTERN_SHIFT.includes("crystallization"), "shift gold");
assert(MATH_PATTERN_DISSOLVE.includes("gaseous diffusion"), "dissolve gold");

const composed = composeMathPatternMotion({
  emotion: "calm",
  outbreak: MATH_PATTERN_OUTBREAK,
  shift: MATH_PATTERN_SHIFT,
  dissolve: MATH_PATTERN_DISSOLVE,
});
assert(mathPatternMotionLooksLike(composed), "composed looks like MATH");
assert(!/lip-sync|Use the provided start image/i.test(composed), "not an LTX lock");
assert(composed.includes("Frame 0:"), "frame 0");
assert(composed.includes("Frame 40:"), "frame 40");
assert(composed.includes("Frame 80:"), "frame 80");

const empty = normalizeMathPatternSettings({});
assert(empty.outbreak === MATH_PATTERN_OUTBREAK, "empty falls back to gold");
assert(mathPatternSeed("abc") !== mathPatternSeed("xyz"), "words change the seed");
assert(mathPatternPhaseId(0.2) === "outbreak", "phase outbreak");
assert(mathPatternPhaseId(1.0) === "shift", "phase shift");
assert(mathPatternPhaseId(1.8) === "dissolve", "phase dissolve");
assert(mathPatternPhaseValue(0, 10) === 0, "phase at start");
assert(mathPatternPhaseValue(10, 10) === 0, "phase wraps");

const fold = muteMvMathFoldSummary();
assert(/not LTX/i.test(fold), "fold says not LTX");
assert(
  muteMvMathFoldLines().some((l) => /No Comfy generate/i.test(l)),
  "fold says no Comfy until go",
);

const ten = cookDurationFromHungBar({ startMs: 0, endMs: 10000 }, "math");
assert(!("error" in ten) && ten.durationSec === 10, "MATH uses the hung 10s clock");
const fortyFour = cookDurationFromHungBar({ startMs: 0, endMs: 44000 }, "math");
assert(!("error" in fortyFour) && fortyFour.durationSec === 44, "MATH 44 stays 44");
const missing = cookDurationFromHungBar(null, "math");
assert("error" in missing, "MATH needs a hang");

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const engineSrc = readFileSync(join(root, "src/lib/mathPatternEngine.ts"), "utf8");
assert(!/uPrev/.test(engineSrc), "single-pass shader has no feedback sampler");
assert(!/ping.?pong|framebufferTexture2D/i.test(engineSrc), "no ping-pong accumulation buffer");
assert(/webgl2/.test(engineSrc), "engine requests a webgl2 context");
assert(/resizeMathPatternCanvas/.test(engineSrc), "engine sizes the canvas backing store from DPR");
assert(!/clipEngine:\s*"ltx"/.test(engineSrc), "engine file does not send LTX");

const shaderSrc = readFileSync(join(root, "src/lib/mathPatternShader.ts"), "utf8");
assert(/#version 300 es/.test(shaderSrc), "shader is GLSL ES 3.00");
assert(!/uPrev|sampler2D/.test(shaderSrc), "shader has no feedback texture");
assert(/uHardEdges/.test(shaderSrc), "shader has a hard-edges/posterize uniform");
assert(Object.keys(MATH_PATTERN_MODE_LABELS).length === 7, "seven modes");
assert(Object.keys(MATH_PATTERN_PALETTE_LABELS).length === 5, "five palettes");

const buttons = readFileSync(join(root, "src/components/mobile/PlateReviewEditor.tsx"), "utf8");
const h3At = buttons.indexOf("onClick={() => pick(\"h3\")}");
const mathAt = buttons.indexOf("onClick={() => pick(\"math\")}");
const grokAt = buttons.indexOf("onClick={() => pick(\"grok\")}");
assert(h3At >= 0 && mathAt > h3At, "MATH button sits after H3");
assert(grokAt > mathAt, "GROK button sits after MATH");
assert(buttons.includes("MathPatternHole"), "plate card mounts MATH hole");
assert(buttons.includes("GrokImagineHole"), "plate card mounts GROK hole");

const track = readFileSync(join(root, "src/components/mobile/MusicVideoTrack.tsx"), "utf8");
assert(track.includes("sendMathPattern"), "Send has a MATH path");
assert(track.includes('form.set("source", "math")'), "MATH upload source");
assert(/if \(useMath\)/.test(track), "MATH Send does not fall into LTX");
assert(!/clipEngine:\s*"ltx"[\s\S]{0,80}sendMathPattern/.test(track), "MATH is not an LTX cook");

const upload = readFileSync(join(root, "src/app/api/crash/mobile/clip/upload/route.ts"), "utf8");
assert(upload.includes('source === "math"'), "upload accepts math");
assert(upload.includes("transcodeToSilentMp4"), "math transcodes to silent mp4");

console.log("check_math_pattern: ok");
