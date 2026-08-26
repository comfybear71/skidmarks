/** Run: npx tsx scripts/check_arsenal_effects.mjs */
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import {
  ARSENAL_EFFECT_IDS,
  arsenalFilterGraph,
  arsenalOutputName,
  canApplyArsenalEffect,
  escapeDrawtext,
  parseArsenalEffectId,
  applyArsenalEffectFile,
} from "../src/lib/arsenalEffects.ts";
import { resolveFfmpeg } from "../src/lib/mobileStitch.ts";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(parseArsenalEffectId("Zoom punch") === null, "spaces are not a raw id");
assert(parseArsenalEffectId("zoom") === "zoom", "zoom id");
assert(parseArsenalEffectId("FADE_TEXT") === "fade_text", "fade_text id");
assert(parseArsenalEffectId("nope") === null, "unknown id");
assert(ARSENAL_EFFECT_IDS.length === 5, "five effects");

assert(
  canApplyArsenalEffect({ styleId: "skidmarks", shot: { footageRole: "support" }, clipFile: "a.mp4" })
    .ok === false,
  "blocks cartoon jobs",
);
assert(
  canApplyArsenalEffect({ styleId: "music_video", shot: { footageRole: "hero" }, clipFile: "a.mp4" })
    .ok === false,
  "blocks hero",
);
assert(
  canApplyArsenalEffect({ styleId: "music_video", shot: { footageRole: "support" }, clipFile: "" }).ok ===
    false,
  "needs a hung clip",
);
assert(
  canApplyArsenalEffect({
    styleId: "music_video",
    shot: { footageRole: "support" },
    clipFile: "06_stock_Timber.mp4",
  }).ok === true,
  "music-video support with a file is allowed",
);

assert(
  arsenalOutputName("06_stock_Timber.mp4", "shake") === "06_stock_Timber_shake.mp4",
  "names the new take",
);
assert(escapeDrawtext("A:B").includes("\\:"), "escapes colon");

const zoom = arsenalFilterGraph("zoom", { durationSec: 5 });
assert(zoom.includes("scale=iw*1.18"), "zoom scales");
const shimmer = arsenalFilterGraph("shimmer", { durationSec: 3 });
assert(shimmer.includes("blend=all_mode=screen"), "shimmer glows");
const split = arsenalFilterGraph("split", { durationSec: 3 });
assert(split.includes("hstack"), "split stacks panes");

const { bin } = resolveFfmpeg();
if (!bin) {
  console.log("arsenal effects checks passed (ffmpeg missing — encode skipped)");
  process.exit(0);
}

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "arsenal-"));
const src = path.join(dir, "src.mp4");
execFileSync(
  bin,
  [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "testsrc=size=320x180:rate=12:duration=1",
    "-pix_fmt",
    "yuv420p",
    "-an",
    src,
  ],
  { timeout: 20_000 },
);

for (const id of ARSENAL_EFFECT_IDS) {
  const dest = path.join(dir, `${id}.mp4`);
  applyArsenalEffectFile({ srcPath: src, destPath: dest, effectId: id, text: "RIVER" });
  assert(fs.existsSync(dest) && fs.statSync(dest).size > 200, `${id} wrote a clip`);
}

console.log("arsenal effects checks passed");
