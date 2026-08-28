import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  clearClipRowTakes,
  clipFileBasename,
  dropClipTakeFromRow,
  clipHangStartMs,
  clipRailLabels,
  gatherClipsForStillsRail,
  keepClipsAfterUnhang,
  uniqueClipsByFile,
  rememberClipTake,
  stackedClipFiles,
  stableClipTakeLabel,
} from "../src/lib/mobilePlateClips.ts";
import { extraTakeHangPlateId } from "../src/lib/musicVideoTrack.ts";
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
    shotId: "shot-60",
    songCuts: [
      { clipFile: "slice_at_0.mp4", shotId: "shot-0" },
      { clipFile: "slice_at_60.mp4", shotId: "shot-60" },
    ],
    plateTimings: [
      { plateId: "shot-0", startMs: 0, endMs: 15000, sortIndex: 0 },
      { plateId: "shot-60", startMs: 60000, endMs: 75000, sortIndex: 1 },
    ],
  }),
  "1:00 · 15s",
);
assert.equal(
  stableClipTakeLabel({
    fileName: "slice_at_60.mp4",
    songCuts: [{ clipFile: "slice_at_0.mp4", startSec: 0 }],
  }),
  "off",
  "no hang → off, never a filename tail (that was kI0)",
);
assert.equal(
  stableClipTakeLabel({
    fileName: "01_Babe_kI0.mp4",
    songCuts: [{ clipFile: "01_Babe_kI0.mp4", startSec: 0 }],
  }),
  "off",
  "startSec 0 on an unhung cook is not 0:00 and not kI0",
);
const beforeDel = stableClipTakeLabel({
  fileName: "keep_me.mp4",
  shotId: "keep",
  plateTimings: [{ plateId: "keep", startMs: 75000, endMs: 90000, sortIndex: 0 }],
});
const afterDel = stableClipTakeLabel({
  fileName: "keep_me.mp4",
  shotId: "keep",
  plateTimings: [{ plateId: "keep", startMs: 75000, endMs: 90000, sortIndex: 0 }],
});
assert.equal(beforeDel, "1:15 · 15s");
assert.equal(afterDel, "1:15 · 15s");
assert.equal(beforeDel, afterDel);
assert.equal(
  stableClipTakeLabel({
    fileName: "five_at_15.mp4",
    shotId: "p2",
    durationSec: 5,
    plateTimings: [{ plateId: "p2", startMs: 15000, endMs: 30000, sortIndex: 0 }],
  }),
  "0:15 · 5s",
  "5s file hung at 0:15 must stamp 5s, not look like 15s",
);
assert.notEqual(
  stableClipTakeLabel({
    fileName: "five_at_15.mp4",
    shotId: "p2",
    durationSec: 5,
    plateTimings: [{ plateId: "p2", startMs: 15000, endMs: 30000, sortIndex: 0 }],
  }),
  "0:15",
);
assert.equal(
  stableClipTakeLabel({
    fileName: "01_Babe_dzd.mp4",
    songCuts: [{ clipFile: "01_Babe_dzd.mp4", startSec: 0 }],
  }),
  "off",
  "filename tail dzd must not come back",
);

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

const twoPlates = gatherClipsForStillsRail(
  {
    clips: [
      { ...clip, beatId: "beat-1", shotId: "shot-1", clipFile: "p1.mp4", priorClipFiles: [] },
      { ...clip, beatId: "beat-2", shotId: "shot-2", clipFile: "p2.mp4", priorClipFiles: [] },
    ],
    shots: [
      { shotId: "shot-1", sceneId: "scene-1" },
      { shotId: "shot-2", sceneId: "scene-1" },
    ],
  },
  [{ shotId: "shot-1" }, { shotId: "shot-2" }],
);
assert.equal(twoPlates.length, 2);
assert.deepEqual(
  twoPlates.flatMap((c) => stackedClipFiles(c)),
  ["p1.mp4", "p2.mp4"],
);
assert.deepEqual(clipRailLabels(3), ["clip 1", "clip 2", "clip 3"]);
assert.doesNotMatch(clipRailLabels(9).join(" "), /plate /);

const jackDup = gatherClipsForStillsRail(
  {
    clips: [
      {
        ...clip,
        beatId: "beat-crouch",
        shotId: "plate-crouch",
        clipFile: "01_JACK_GHOST.mp4",
        priorClipFiles: [],
      },
    ],
    shots: [
      { shotId: "plate-crouch", sceneId: "scene-1" },
      { shotId: "plate-car", sceneId: "scene-1" },
    ],
    scratchSong: {
      cuts: [
        { id: "c1", shotId: "plate-crouch", clipFile: "", status: "pending", startSec: 0 },
        { id: "c2", shotId: "plate-crouch", clipFile: "", status: "pending", startSec: 15 },
        { id: "c3", shotId: "plate-crouch", clipFile: "", status: "pending", startSec: 30 },
        {
          id: "c4",
          shotId: "plate-car",
          clipFile: "01_JACK_GHOST.mp4",
          status: "done",
          startSec: 45,
        },
      ],
    },
  },
  [
    { shotId: "plate-crouch", beatIds: ["beat-crouch"] },
    { shotId: "plate-car" },
  ],
);
assert.equal(jackDup.length, 1, "one cook is one CLIPS thumb");
assert.equal(jackDup[0].shotId, "plate-car", "keep the hung plate, not the leftover still");
assert.deepEqual(stackedClipFiles(jackDup[0]), ["01_JACK_GHOST.mp4"]);

const sharedBeat = gatherClipsForStillsRail(
  {
    clips: [
      {
        ...clip,
        beatId: "shared",
        shotId: "shot-2",
        clipFile: "jack.mp4",
        priorClipFiles: [],
      },
    ],
    shots: [
      { shotId: "shot-1", sceneId: "scene-1" },
      { shotId: "shot-2", sceneId: "scene-1" },
    ],
    scratchSong: {
      cuts: [{ id: "cut-2", shotId: "shot-2", clipFile: "jack.mp4", status: "done", startSec: 45 }],
    },
  },
  [
    { shotId: "shot-1", beatIds: ["shared"] },
    { shotId: "shot-2", beatIds: ["shared"] },
  ],
);
assert.equal(sharedBeat.length, 1, "shared beatIds do not paint the same mp4 twice");
assert.equal(sharedBeat[0].shotId, "shot-2");


const thumbs = fs.readFileSync(new URL("../src/components/mobile/PlateClipThumbs.tsx", import.meta.url), "utf8");
assert.match(thumbs, /createPortal/);
assert.match(thumbs, /scratch-clip-overlay/);
assert.match(thumbs, /formatClipTakeStamp/);
assert.match(thumbs, /clipTakeDurationSec/);
assert.doesNotMatch(thumbs, /formatSongClock/);
assert.match(thumbs, /`clip \$\{i \+ 1\}`/);
assert.match(thumbs, /m-plate-clip-plate/);
assert.match(thumbs, /onHangClip/);
assert.match(thumbs, /m-plate-clip-hang/);
assert.doesNotMatch(thumbs, /plateLabelByShotId/);
assert.doesNotMatch(thumbs, /plate \$\{/);
assert.doesNotMatch(thumbs, /pickEngine/, "LTX / H3 do not sit on CLIPS thumbs");
assert.doesNotMatch(thumbs, /m-plate-clip-engine/, "LTX / H3 do not sit on CLIPS thumbs");
assert.doesNotMatch(thumbs, /How long/);
assert.doesNotMatch(thumbs, /\$\{n \+ 1\}\/\$\{stacked\.length\}/);
assert.doesNotMatch(thumbs, /zIndex: 70/);

const editor = fs.readFileSync(new URL("../src/components/mobile/PlateReviewEditor.tsx", import.meta.url), "utf8");
assert.match(editor, /m-plate-clips-bleed/);
assert.match(editor, /m-plate-clip-rail/);
assert.match(editor, /layout="strip"/);
assert.match(editor, /gatherClipsForStillsRail/);
assert.doesNotMatch(editor, /plateLabelByShotId/);
assert.doesNotMatch(editor, /plateRailLabels/);
assert.doesNotMatch(editor, /shots\.filter\(\(s\) => s\.shotId === focus\)/);
assert.doesNotMatch(editor, /focusLabel/);
assert.doesNotMatch(editor, /pickEngine/, "LTX / H3 do not sit on CLIPS thumbs");
assert.doesNotMatch(editor, /width: `\$\{PLATE_TILE_PX\}px`[\s\S]{0,200}Clips/);
assert.match(editor, /requestSongCookStop/);
assert.match(editor, /action: "remove-clip"/);
assert.match(editor, /action: "hang-clip"/);
assert.match(editor, /onHangClip/);
const clipRoute = fs.readFileSync(new URL("../src/app/api/crash/mobile/clip/route.ts", import.meta.url), "utf8");
assert.match(clipRoute, /planParkDeskClipTake/);
assert.match(clipRoute, /scratchSong/);

const songRoute = fs.readFileSync(
  new URL("../src/app/api/crash/mobile/song/route.ts", import.meta.url),
  "utf8",
);
assert.match(songRoute, /clipOwnsHangPlate/, "clip-poll must not hang a cook onto the next still");
assert.match(songRoute, /action === "hang-clip"/);
assert.deepEqual(
  uniqueClipsByFile(
    [
      { ...clip, beatId: "a", shotId: "p1", clipFile: "same.mp4", priorClipFiles: [] },
      { ...clip, beatId: "b", shotId: "p2", clipFile: "same.mp4", priorClipFiles: [] },
    ],
    { cuts: [{ shotId: "p2", clipFile: "same.mp4", status: "done" }] },
  ).map((c) => c.shotId),
  ["p2"],
);

/** His CLIPS 3: stills plate 1 / 8 / 9, cooks all startSec 0, hung at 0 / 15 / 30. */
const stuiesThree = gatherClipsForStillsRail(
  {
    clips: [
      { ...clip, beatId: "b1", shotId: "plate-1", clipFile: "01_Babe.mp4", priorClipFiles: [] },
      { ...clip, beatId: "b8", shotId: "plate-8", clipFile: "02_Car.mp4", priorClipFiles: [] },
      { ...clip, beatId: "b9", shotId: "plate-9", clipFile: "03_Jack.mp4", priorClipFiles: [] },
    ],
    shots: [
      { shotId: "plate-1", sceneId: "scene-1" },
      { shotId: "plate-8", sceneId: "scene-1" },
      { shotId: "plate-9", sceneId: "scene-1" },
    ],
    scratchSong: {
      cuts: [
        { id: "c1", shotId: "plate-1", clipFile: "01_Babe.mp4", status: "done", startSec: 0 },
        { id: "c8", shotId: "plate-8", clipFile: "02_Car.mp4", status: "done", startSec: 0 },
        { id: "c9", shotId: "plate-9", clipFile: "03_Jack.mp4", status: "done", startSec: 0 },
      ],
      plateTimings: [
        { plateId: "plate-8", startMs: 15000, endMs: 30000, sortIndex: 1 },
        { plateId: "plate-1", startMs: 0, endMs: 15000, sortIndex: 0 },
        { plateId: "plate-9", startMs: 30000, endMs: 45000, sortIndex: 2 },
      ],
    },
  },
  [{ shotId: "plate-8" }, { shotId: "plate-1" }, { shotId: "plate-9" }],
);
assert.deepEqual(
  stuiesThree.map((c) => c.shotId),
  ["plate-1", "plate-8", "plate-9"],
  "hang clock order, not leftover stills walk",
);
assert.deepEqual(
  stuiesThree.map((c) =>
    stableClipTakeLabel({
      fileName: c.clipFile,
      shotId: c.shotId,
      plateTimings: [
        { plateId: "plate-8", startMs: 15000, endMs: 30000, sortIndex: 1 },
        { plateId: "plate-1", startMs: 0, endMs: 15000, sortIndex: 0 },
        { plateId: "plate-9", startMs: 30000, endMs: 45000, sortIndex: 2 },
      ],
    }),
  ),
  ["0:00 · 15s", "0:15 · 15s", "0:30 · 15s"],
);
assert.deepEqual(clipRailLabels(stuiesThree.length), ["clip 1", "clip 2", "clip 3"]);
assert.equal(clipHangStartMs(stuiesThree[1], {
  plateTimings: [{ plateId: "plate-8", startMs: 15000, endMs: 30000, sortIndex: 1 }],
}), 15000);

const leftoverClock = clipHangStartMs(
  { shotId: "jack3", clipFile: "04_Jack_stand.mp4", priorClipFiles: [] },
  {
    cuts: [
      { shotId: "jack3", clipFile: "03_Jack_5.mp4" },
      { shotId: extraTakeHangPlateId("jack3", "04_Jack_stand.mp4"), clipFile: "04_Jack_stand.mp4" },
    ],
    plateTimings: [
      { plateId: "jack3", startMs: 20000, endMs: 25000, sortIndex: 0 },
      {
        plateId: extraTakeHangPlateId("jack3", "04_Jack_stand.mp4"),
        startMs: 25000,
        endMs: 33000,
        sortIndex: 1,
      },
    ],
  },
);
assert.equal(leftoverClock, 25000, "leftover take uses its own bar — not the 0:20 first take");

/** Two different mp4s on the same still (both used to say plate 9). */
const twoOnNine = gatherClipsForStillsRail(
  {
    clips: [
      { ...clip, beatId: "n1", shotId: "plate-9", clipFile: "09_first.mp4", priorClipFiles: [] },
      { ...clip, beatId: "n2", shotId: "plate-9", clipFile: "09_second.mp4", priorClipFiles: [] },
    ],
    shots: [{ shotId: "plate-9", sceneId: "scene-1" }],
    scratchSong: {
      cuts: [
        { id: "d1", shotId: "plate-9", clipFile: "09_first.mp4", status: "done", startSec: 0 },
        { id: "d2", shotId: "plate-9", clipFile: "09_second.mp4", status: "done", startSec: 0 },
      ],
      plateTimings: [{ plateId: "plate-9", startMs: 30000, endMs: 45000, sortIndex: 0 }],
    },
  },
  [{ shotId: "plate-9" }],
);
assert.equal(twoOnNine.length, 2, "two files on one still are two thumbs");
assert.deepEqual(
  twoOnNine.map((c) => c.clipFile),
  ["09_first.mp4", "09_second.mp4"],
);
assert.deepEqual(clipRailLabels(twoOnNine.length), ["clip 1", "clip 2"]);
assert.notEqual(twoOnNine[0].clipFile, twoOnNine[1].clipFile);

{
  const extraId = extraTakeHangPlateId("car", "02_car.mp4");
  const cutOnlyCar = gatherClipsForStillsRail(
    {
      clips: [],
      shots: [
        { shotId: "jack1", sceneId: "scene-1" },
        { shotId: "car", sceneId: "scene-1" },
        { shotId: "jack", sceneId: "scene-1" },
      ],
      scratchSong: {
        cuts: [{ id: "c2e", shotId: extraId, clipFile: "02_car.mp4", status: "done" }],
      },
    },
    [{ shotId: "jack1" }, { shotId: "car" }, { shotId: "jack" }],
  );
  assert.ok(
    cutOnlyCar.some((c) => c.clipFile === "02_car.mp4"),
    "CLIPS must still show previous clip 2 after leftover hang uses shotId~tail",
  );
}

/** Screenshot after #398: start stamps 0:00 / 0:15 / 0:20 / 0:20. Files are 16s, 5s, 5s, 5s. */
const stuiesLengths = [
  {
    fileName: "01_first.mp4",
    shotId: "p1",
    durationSec: 16,
    plateTimings: [{ plateId: "p1", startMs: 0, endMs: 15000, sortIndex: 0 }],
  },
  {
    fileName: "02_second.mp4",
    shotId: "p2",
    durationSec: 5,
    plateTimings: [{ plateId: "p2", startMs: 15000, endMs: 20000, sortIndex: 1 }],
  },
  {
    fileName: "03_third.mp4",
    shotId: "p3",
    durationSec: 5,
    plateTimings: [{ plateId: "p3", startMs: 20000, endMs: 25000, sortIndex: 2 }],
  },
  {
    fileName: "04_fourth.mp4",
    shotId: "p4",
    durationSec: 5,
    plateTimings: [{ plateId: "p4", startMs: 20000, endMs: 25000, sortIndex: 3 }],
  },
].map((row) => stableClipTakeLabel(row));
assert.deepEqual(stuiesLengths, ["0:00 · 16s", "0:15 · 5s", "0:20 · 5s", "0:20 · 5s"]);
assert.ok(stuiesLengths.every((label) => !/^0:\d{2}$/.test(label)), "start-only stamp is a lie");
assert.ok(!stuiesLengths.some((label) => /kI0|dzd/i.test(label)));

/** Screenshots: clip 3 + clip 4 both say 0:20 until the leftover owns its own bar. */
const jackCuts = [
  { clipFile: "01_jack.mp4", shotId: "jack1" },
  { clipFile: "02_car.mp4", shotId: "car" },
  { clipFile: "03_stand.mp4", shotId: "jack" },
];
const jackTimings = [
  { plateId: "jack1", startMs: 0, endMs: 15000, sortIndex: 0 },
  { plateId: "car", startMs: 15000, endMs: 20000, sortIndex: 1 },
  { plateId: "jack", startMs: 20000, endMs: 25000, sortIndex: 2 },
];
assert.equal(
  stableClipTakeLabel({
    fileName: "03_stand.mp4",
    shotId: "jack",
    durationSec: 5,
    songCuts: jackCuts,
    plateTimings: jackTimings,
  }),
  "0:20 · 5s",
);
assert.equal(
  stableClipTakeLabel({
    fileName: "04_crouch.mp4",
    shotId: "jack",
    durationSec: 5,
    songCuts: jackCuts,
    plateTimings: jackTimings,
  }),
  "off",
  "leftover take must not steal the 3rd bar's 0:20",
);
const afterHangCuts = [
  ...jackCuts,
  { clipFile: "04_crouch.mp4", shotId: "jack~04crouch" },
];
const afterHangTimings = [
  ...jackTimings,
  { plateId: "jack~04crouch", startMs: 25000, endMs: 30000, sortIndex: 3 },
];
assert.equal(
  stableClipTakeLabel({
    fileName: "03_stand.mp4",
    shotId: "jack",
    durationSec: 5,
    songCuts: afterHangCuts,
    plateTimings: afterHangTimings,
  }),
  "0:20 · 5s",
);
assert.equal(
  stableClipTakeLabel({
    fileName: "04_crouch.mp4",
    shotId: "jack",
    durationSec: 5,
    songCuts: afterHangCuts,
    plateTimings: afterHangTimings,
  }),
  "0:25 · 5s",
  "hung leftover stamps 0:25 · 5s, not another 0:20",
);
assert.equal(
  clipHangStartMs(twoOnNine[0], {
    cuts: [
      { id: "d1", shotId: "plate-9", clipFile: "09_first.mp4" },
      { id: "d2", shotId: "plate-9", clipFile: "09_second.mp4" },
    ],
    plateTimings: [{ plateId: "plate-9", startMs: 30000, endMs: 45000, sortIndex: 0 }],
  }),
  30000,
  "first take owns the still's clock",
);
assert.equal(
  clipHangStartMs(twoOnNine[1], {
    cuts: [
      { id: "d1", shotId: "plate-9", clipFile: "09_first.mp4" },
      { id: "d2", shotId: "plate-9", clipFile: "09_second.mp4" },
    ],
    plateTimings: [{ plateId: "plate-9", startMs: 30000, endMs: 45000, sortIndex: 0 }],
  }),
  null,
  "second take is off until Hang — same still, own clock",
);

const css = fs.readFileSync(new URL("../src/app/(mobile)/m/mobile.css", import.meta.url), "utf8");
assert.match(css, /\.m-plate-clips-bleed/);
assert.match(css, /\.m-plate-clip-rail/);
assert.match(css, /\.m-plate-clip-rail\s*\{[^}]*overflow-x:\s*auto/s);
assert.match(css, /\.m-plate-clip-rail\s*\{[^}]*touch-action:\s*pan-x pan-y/s);
assert.match(css, /\.m-plate-clip-rail\s*\{[^}]*flex-wrap:\s*nowrap/s);
assert.match(css, /\.m-plate-clip-thumb/);
assert.match(css, /\.m-plate-clip-hang/);
assert.match(css, /touch-action: pan-x pan-y/);
assert.match(css, /width: calc\(100% \+ 32px\)/);
assert.doesNotMatch(css, /\.m-plate-clip-engines/, "no engine chrome on the CLIPS thumb");

{
  const extraId = extraTakeHangPlateId("car", "04_Gothic_town.mp4");
  const already = keepClipsAfterUnhang({
    clips: [
      { ...clip, beatId: "b4", shotId: "car", clipFile: "04_Gothic_town.mp4", priorClipFiles: [] },
    ],
    removedCuts: [{ id: "c4", shotId: extraId, clipFile: "04_Gothic_town.mp4", durationSec: 4 }],
  });
  assert.equal(already.length, 1, "file already on job.clips stays one row");
  assert.equal(already[0].clipFile, "04_Gothic_town.mp4");
  const onlyOnCut = keepClipsAfterUnhang({
    clips: [],
    removedCuts: [{ id: "c4", shotId: extraId, clipFile: "04_Gothic_town.mp4", durationSec: 4 }],
    shots: [{ shotId: "car", sceneId: "s" }],
  });
  assert.equal(onlyOnCut.length, 1, "cut-only take lands on CLIPS after unhang");
  assert.equal(onlyOnCut[0].clipFile, "04_Gothic_town.mp4");
  assert.equal(onlyOnCut[0].shotId, "car");
  assert.equal(onlyOnCut[0].durationSec, 4);
}

assert.match(thumbs, /onRemoveTake/, "CLIPS X still parks the mp4");
assert.match(thumbs, /File parks in _cleared\//);
assert.match(editor, /action: "remove-clip"/);
assert.match(clipRoute, /planParkDeskClipTake/);
const trackUi = fs.readFileSync(
  new URL("../src/components/mobile/MusicVideoTrack.tsx", import.meta.url),
  "utf8",
);
assert.match(trackUi, /dropPlateFromWave/);
assert.match(
  trackUi,
  /aria-label="Take off the song"[\s\S]{0,220}dropPlateFromWave/,
  "TRACK X unhangs and keeps the clip",
);
assert.doesNotMatch(
  trackUi,
  /aria-label="Take off the song"[\s\S]{0,220}redoPlate/,
);

console.log("check-mobile-plate-clips: ok");
