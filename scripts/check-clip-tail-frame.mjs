/** Run: npx tsx scripts/check-clip-tail-frame.mjs */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { extractClipTailFrame } from "../src/lib/clipTailFrame.ts";
import { resolveFfmpeg } from "../src/lib/mobileStitch.ts";

const { bin } = resolveFfmpeg();
const ffmpeg = bin || "ffmpeg";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ltx-tail-"));
const mp4 = path.join(dir, "clip.mp4");

execFileSync(
  ffmpeg,
  [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "color=c=red:s=64x64:d=0.4:r=8",
    "-f",
    "lavfi",
    "-i",
    "color=c=blue:s=64x64:d=0.4:r=8",
    "-filter_complex",
    "[0:v][1:v]concat=n=2:v=1:a=0",
    "-pix_fmt",
    "yuv420p",
    mp4,
  ],
  { timeout: 30_000, stdio: "pipe" },
);
assert.ok(fs.existsSync(mp4) && fs.statSync(mp4).size > 0);

const still = extractClipTailFrame(mp4);
assert.ok(fs.existsSync(still) && fs.statSync(still).size > 0);
assert.match(still, /\.jpg$/);

fs.rmSync(still, { force: true });
fs.rmSync(dir, { recursive: true, force: true });
console.log("check-clip-tail-frame: ok");
