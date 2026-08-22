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
  stableClipTakeLabel,
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

assert.equal(
  stableClipTakeLabel({
    fileName: "slice_at_60.mp4",
    songCuts: [
      { clipFile: "slice_at_0.mp4", startSec: 0 },
      { clipFile: "slice_at_60.mp4", startSec: 60 },
    ],
  }),
  "1:00.0",
);
assert.equal(
  stableClipTakeLabel({
    fileName: "slice_at_60.mp4",
    songCuts: [{ clipFile: "slice_at_0.mp4", startSec: 0 }],
  }),
  "60",
);
const beforeDel = stableClipTakeLabel({
  fileName: "keep_me.mp4",
  songCuts: [
    { clipFile: "gone.mp4", startSec: 45 },
    { clipFile: "keep_me.mp4", startSec: 75 },
  ],
});
const afterDel = stableClipTakeLabel({
  fileName: "keep_me.mp4",
  songCuts: [{ clipFile: "keep_me.mp4", startSec: 75 }],
});
assert.equal(beforeDel, "1:15.0");
assert.equal(afterDel, "1:15.0");
assert.equal(beforeDel, afterDel);

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

const thumbs = fs.readFileSync(new URL("../src/components/mobile/PlateClipThumbs.tsx", import.meta.url), "utf8");
assert.match(thumbs, /createPortal/);
assert.match(thumbs, /scratch-clip-overlay/);
assert.match(thumbs, /stableClipTakeLabel/);
assert.doesNotMatch(thumbs, /\$\{n \+ 1\}\/\$\{stacked\.length\}/);
assert.doesNotMatch(thumbs, /zIndex: 70/);

const editor = fs.readFileSync(new URL("../src/components/mobile/PlateReviewEditor.tsx", import.meta.url), "utf8");
assert.match(editor, /m-plate-clip-rail/);
assert.match(editor, /layout="strip"/);

const css = fs.readFileSync(new URL("../src/app/(mobile)/m/mobile.css", import.meta.url), "utf8");
assert.match(css, /\.m-plate-clip-rail/);
assert.match(css, /touch-action: pan-x pan-y/);

console.log("check-mobile-plate-clips: ok");
