/** Run: npx tsx scripts/check-ltx-cloud-letterbox.mjs */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  LTX_CLOUD_FRAME_HEIGHT,
  LTX_CLOUD_FRAME_WIDTH,
  letterboxPlateForCloudIa2v,
} from "../src/lib/ltxCloudPlate.ts";

assert.equal(LTX_CLOUD_FRAME_WIDTH, 1280);
assert.equal(LTX_CLOUD_FRAME_HEIGHT, 720);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ltx-letterbox-"));
const square = path.join(tmp, "square.png");
const wide = path.join(tmp, "wide.png");

const sharp = (await import("sharp")).default;
await sharp({
  create: {
    width: 1024,
    height: 1024,
    channels: 3,
    background: { r: 200, g: 100, b: 50 },
  },
}).png().toFile(square);
await sharp({
  create: {
    width: 768,
    height: 512,
    channels: 3,
    background: { r: 50, g: 100, b: 200 },
  },
}).png().toFile(wide);

const sq = await letterboxPlateForCloudIa2v(square);
assert.equal(sq.letterboxed, true);
const sqMeta = await sharp(sq.path).metadata();
assert.equal(sqMeta.width, 1280);
assert.equal(sqMeta.height, 720);

const wd = await letterboxPlateForCloudIa2v(wide);
assert.equal(wd.letterboxed, false);
assert.equal(wd.path, wide);

const exact = path.join(tmp, "exact.jpg");
await sharp({
  create: {
    width: 1280,
    height: 720,
    channels: 3,
    background: { r: 0, g: 0, b: 0 },
  },
}).jpeg().toFile(exact);
const ex = await letterboxPlateForCloudIa2v(exact);
assert.equal(ex.letterboxed, false);
assert.equal(ex.path, exact);

const cloudSrc = fs.readFileSync(
  path.join(path.dirname(new URL(import.meta.url).pathname), "../src/lib/ltxCloudIa2v.ts"),
  "utf8",
);
assert.match(cloudSrc, /letterboxPlateForCloudIa2v/);
assert.match(cloudSrc, /probeDurationSeconds/);
assert.match(cloudSrc, /mp3DurationForLtxSec/);
assert.match(cloudSrc, /ltxFollowsMp3DurationSec\(mp3DurationForLtxSec/);

const { mp3DurationForLtxSec } = await import("../src/lib/ltxCloudIa2v.ts");
const { probeDurationSeconds } = await import("../src/lib/mediaDuration.ts");
const proofMp3 = "/home/ubuntu/.cursor/projects/workspace/uploads/JACK_ASH_-_NOTHING_BUT_PROOF_8d78.mp3";
if (fs.existsSync(proofMp3)) {
  const probed = probeDurationSeconds(proofMp3);
  assert.ok(probed && probed > 210 && probed < 230, `Proof mp3 probe ~219s, got ${probed}`);
  const guess = (fs.statSync(proofMp3).size * 8) / 128_000;
  assert.ok(guess > 280, "bitrate guess on this file is not the real clock");
  const slice = path.join(tmp, "slice18.mp3");
  const { execFileSync } = await import("node:child_process");
  execFileSync(
    "ffmpeg",
    ["-y", "-i", proofMp3, "-ss", "0", "-t", "18", "-acodec", "libmp3lame", "-ar", "44100", "-ac", "1", "-b:a", "128k", slice],
    { stdio: "ignore" },
  );
  const sliced = mp3DurationForLtxSec(slice);
  assert.ok(sliced > 17 && sliced < 20, `18s slice must stay ~18s, got ${sliced}`);
}

console.log("check-ltx-cloud-letterbox: ok");
