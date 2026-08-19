import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  clearClipRowTakes,
  clipFileBasename,
  dropClipTakeFromRow,
  rememberClipTake,
  stackedClipFiles,
} from "../src/lib/mobilePlateClips.ts";
import { parkMobileClipFile } from "../src/lib/mobileClipPark.ts";

const clip = {
  beatId: "beat-1",
  shotId: "shot-1",
  sceneId: "scene-1",
  clipFile: "clip_c.mp4",
  priorClipFiles: ["clip_a.mp4", "clip_b.mp4"],
  clipStatus: "done",
  error: "",
  speaker: "LADDER ONE",
  line: "hello",
  voiceFile: "voice_a.mp3",
  imageMotion: "",
};

assert.deepEqual(stackedClipFiles(clip), ["clip_a.mp4", "clip_b.mp4", "clip_c.mp4"]);

const dropped = dropClipTakeFromRow(clip, "clip_b.mp4");
assert.deepEqual(stackedClipFiles(dropped), ["clip_a.mp4", "clip_c.mp4"]);
assert.equal(dropped.clipFile, "clip_c.mp4");
assert.equal(dropped.clipStatus, "done");

const emptied = dropClipTakeFromRow(dropped, "clip_c.mp4");
const emptied2 = dropClipTakeFromRow(emptied, "clip_a.mp4");
assert.equal(emptied2.clipFile, "");
assert.deepEqual(emptied2.priorClipFiles, []);
assert.equal(emptied2.clipStatus, "pending");

const remembered = rememberClipTake(clearClipRowTakes(clip), "clip_new.mp4");
assert.equal(remembered.clipFile, "clip_new.mp4");
assert.deepEqual(remembered.priorClipFiles, []);

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "plate-clips-"));
process.env.DATA_DIR = dir;
const { CRASH_DIR } = await import("../src/lib/paths.ts");
const ltxDir = path.join(CRASH_DIR, "ltx");
fs.mkdirSync(ltxDir, { recursive: true });
const sample = path.join(ltxDir, "park_me.mp4");
fs.writeFileSync(sample, "fake mp4");
const parked = parkMobileClipFile("park_me.mp4");
assert.ok(parked?.endsWith("park_me.mp4"));
assert.ok(!fs.existsSync(sample));
const clearedDir = path.join(CRASH_DIR, "ltx", "_cleared");
assert.ok(fs.readdirSync(clearedDir).some((name) => name.endsWith("park_me.mp4")));
assert.equal(clipFileBasename("/tmp/foo/bar.mp4"), "bar.mp4");

console.log("check-mobile-plate-clips: ok");
