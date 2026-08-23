/** Run: npx tsx scripts/check-music-video-track.mjs */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  formatTrackClock,
  formatTrackClockPrecise,
  hitPlateEdge,
  msToSec,
  orderedDoneCutsForStitch,
  secToMs,
  sliceBoundsForPlate,
  sortPlateTimings,
  stretchPlateEdge,
} from "../src/lib/musicVideoTrack.ts";

const here = dirname(fileURLToPath(import.meta.url));
const tree = readFileSync(join(here, "../src/components/mobile/StudioTree.tsx"), "utf8");
const trackUi = readFileSync(join(here, "../src/components/mobile/MusicVideoTrack.tsx"), "utf8");
const trackRoute = readFileSync(join(here, "../src/app/api/crash/mobile/track/route.ts"), "utf8");
const songRoute = readFileSync(join(here, "../src/app/api/crash/mobile/song/route.ts"), "utf8");
const mobileCss = readFileSync(join(here, "../src/app/(mobile)/m/mobile.css"), "utf8");
const attach = readFileSync(join(here, "../src/lib/scratchSongAttach.ts"), "utf8");

assert.equal(secToMs(4.5), 4500);
assert.equal(msToSec(4500), 4.5);
assert.equal(formatTrackClock(267000), "4:27");

const sorted = sortPlateTimings([
  { plateId: "b", startMs: 30000, endMs: 45000, sortIndex: 1 },
  { plateId: "a", startMs: 0, endMs: 15000, sortIndex: 0 },
]);
assert.equal(sorted[0].plateId, "a");

const bounds = sliceBoundsForPlate({
  song: {
    fileName: "song.mp3",
    durationSec: 180,
    sliceStartSec: 0,
    sliceDurationSec: 15,
    plateTimings: [{ plateId: "shot_a", startMs: 60000, endMs: 75000, sortIndex: 0 }],
  },
  shotId: "shot_a",
});
assert.equal(bounds.startSec, 60);
assert.equal(bounds.durationSec, 15);

const stitched = orderedDoneCutsForStitch({
  fileName: "song.mp3",
  durationSec: 180,
  sliceStartSec: 0,
  sliceDurationSec: 15,
  plateTimings: [
    { plateId: "b", startMs: 15000, endMs: 30000, sortIndex: 1 },
    { plateId: "a", startMs: 0, endMs: 15000, sortIndex: 0 },
  ],
  cuts: [
    { id: "1", plateFile: "p.png", shotId: "a", startSec: 0, durationSec: 15, status: "done", clipFile: "a.mp4" },
    { id: "2", plateFile: "q.png", shotId: "b", startSec: 15, durationSec: 15, status: "done", clipFile: "b.mp4" },
  ],
});
assert.deepEqual(stitched.map((c) => c.shotId), ["a", "b"]);

// Three sections only: CAST is the band, LOCATIONS is wherever, and PLATES is
// the whole song desk — song, marks, plates, renders. There is no Track branch.
assert.doesNotMatch(tree, /label="Track"/, "the Track section was folded into Plates");
assert.match(tree, /MusicVideoTrack/);
assert.match(
  tree.slice(tree.indexOf('label="Plates"') - 400),
  /MusicVideoTrack/,
  "the track renders inside the Plates branch",
);
// Collapsed Plates still shows the wave and the player.
assert.match(tree, /compact=\{!platesOpen\}/);
assert.match(trackUi, /WaveformCanvas/);
assert.match(trackUi, /Add section/);
assert.match(trackRoute, /set-plate-timing/);
assert.match(songRoute, /sliceBoundsForPlate/);
assert.match(songRoute, /orderedDoneCutsForStitch/);
assert.match(attach, /trackDraft/);
assert.match(mobileCss, /\.m-track-wave/);
assert.match(mobileCss, /\.m-track-stretch-hint/);
assert.match(trackUi, /stretchPlateEdge/);
assert.match(trackUi, /onStretchCommit/);
assert.match(trackRoute, /set-plate-timings/);

assert.equal(formatTrackClockPrecise(247500), "4:07.5");
assert.equal(formatTrackClockPrecise(0), "0:00.0");

const boxes = [
  { plateId: "a", startMs: 0, endMs: 15000, sortIndex: 0 },
  { plateId: "b", startMs: 15000, endMs: 30000, sortIndex: 1 },
  { plateId: "c", startMs: 30000, endMs: 45000, sortIndex: 2 },
];
const pulled = stretchPlateEdge(boxes, "b", "start", 10000, 45000);
assert.equal(pulled.find((t) => t.plateId === "a")?.endMs, 10000);
assert.equal(pulled.find((t) => t.plateId === "b")?.startMs, 10000);
assert.equal(pulled.find((t) => t.plateId === "b")?.endMs, 30000);
const pushed = stretchPlateEdge(boxes, "b", "end", 40000, 45000);
assert.equal(pushed.find((t) => t.plateId === "b")?.endMs, 40000);
assert.equal(pushed.find((t) => t.plateId === "c")?.startMs, 40000);
const clamped = stretchPlateEdge(boxes, "b", "end", 100000, 45000);
assert.equal(clamped.find((t) => t.plateId === "b")?.endMs, 44500);
assert.equal(clamped.find((t) => t.plateId === "c")?.startMs, 44500);
const tooSmall = stretchPlateEdge(boxes, "a", "end", 100, 45000);
assert.equal(tooSmall.find((t) => t.plateId === "a")?.endMs, 500);

const hit = hitPlateEdge({
  timings: boxes,
  durationMs: 45000,
  width: 450,
  height: 78,
  x: 150,
  y: 70,
});
assert.ok(hit);
assert.ok(
  (hit.plateId === "a" && hit.edge === "end") || (hit.plateId === "b" && hit.edge === "start"),
);
const miss = hitPlateEdge({
  timings: boxes,
  durationMs: 45000,
  width: 450,
  height: 78,
  x: 150,
  y: 20,
});
assert.equal(miss, null);

console.log("check-music-video-track: ok");
