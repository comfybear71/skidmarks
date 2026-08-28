/** Run: npx tsx scripts/check-music-video-track.mjs */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  evenPlateTimings,
  formatTrackClock,
  formatTrackClockPrecise,
  addPlateFileFirstHang,
  extraTakeHangPlateId,
  hangClipDurationMs,
  hangMissingPlateTimings,
  hangOneClipOnWave,
  hangPlateShotId,
  isLeftoverPlateHang,
  isRealPlateHang,
  clipFileOnWave,
  hitPlateEdge,
  nextPlateHangWindow,
  resolvePlateTimings,
  stretchPlateEdge,
  swapNeighborPlateTimings,
  withPlateDuration,
  withPlateWindow,
  msToSec,
  orderedDoneCutsForStitch,
  plateRailBox,
  plateSlicePx,
  secToMs,
  sliceBoundsForPlate,
  sortPlateTimings,
  trackWaveCssWidth,
  cutForHungPlate,
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

const spit = evenPlateTimings(63.168, ["shot_a", "shot_b"]);
assert.equal(spit.length, 2);
assert.equal(spit[0].startMs, 0);
assert.equal(spit[0].endMs, 31584);
assert.equal(spit[1].startMs, 31584);
assert.equal(spit[1].endMs, 63168);
const half = sliceBoundsForPlate({
  song: {
    fileName: "spit_roast.mp3",
    durationSec: 63.168,
    sliceStartSec: 0,
    sliceDurationSec: 15,
    plateTimings: spit,
  },
  shotId: "shot_a",
});
assert.equal(half.startSec, 0);
assert.equal(half.durationSec, 31.6);

const cutWinsTrack = sliceBoundsForPlate({
  song: {
    fileName: "song.mp3",
    durationSec: 180,
    sliceStartSec: 0,
    sliceDurationSec: 15,
    plateTimings: [{ plateId: "shot_a", startMs: 60000, endMs: 75000, sortIndex: 0 }],
  },
  shotId: "shot_a",
  cut: {
    id: "c",
    plateFile: "a.png",
    shotId: "shot_a",
    startSec: 110,
    durationSec: 9,
  },
});
assert.equal(cutWinsTrack.startSec, 110);
assert.equal(cutWinsTrack.durationSec, 9);

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
assert.match(trackUi, /Put stills on the song/);
assert.doesNotMatch(trackUi, /Starts at/, "Starts at is not on the TRACK pick");
assert.doesNotMatch(trackUi, /How long/, "How long is not on the TRACK pick");
assert.doesNotMatch(trackUi, /m-track-motion/, "IMAGE MOTION essay is not on the TRACK pick");
assert.match(trackUi, /startSec/);
assert.doesNotMatch(trackUi, /Send all/);
assert.doesNotMatch(trackUi, /Sending…/, "TRACK pick has no Send — Send sits on the plate row");
assert.doesNotMatch(trackUi, /void sendPlate\(picked\.shotId\)/, "TRACK does not run Send");
assert.match(trackUi, /Park this clip/);
assert.match(trackUi, /requestSongCookStop/);
assert.match(trackUi, /m-track-film/);
assert.doesNotMatch(trackUi, /Use range/);
assert.doesNotMatch(trackUi, />Earlier</);
assert.doesNotMatch(trackUi, />Later</);
assert.doesNotMatch(trackUi, /Hang stills on the wave/);
assert.doesNotMatch(trackUi, /Plates on the track/);
assert.doesNotMatch(trackUi, /!compact && picked/);
assert.doesNotMatch(trackUi, /label="Free look"/, "Free look is not on TRACK — it sits under Song list");
assert.doesNotMatch(trackUi, /set-stock-look/, "TRACK does not save the free look");
assert.match(mobileCss, /\.m-track-film-cell/);
assert.match(mobileCss, /\.m-track-pick-len/);
assert.match(trackRoute, /set-plate-timing/);
assert.match(songRoute, /sliceBoundsForPlate/);
assert.match(songRoute, /cutFromPlateTiming/);
assert.match(attach, /trackDraft/);
assert.match(attach, /evenPlateTimings/);
assert.match(mobileCss, /\.m-track-wave/);

assert.match(trackUi, /Move left/);
assert.match(trackUi, /Move right/);
assert.match(trackUi, /move-plate/);
assert.match(trackUi, /Stop send/);
assert.match(trackUi, /Put stills on the song/);
assert.match(trackUi, /set-plate-duration/);
assert.match(trackUi, /setHungPlateLength/);
assert.match(trackUi, /HANG_LENGTH_CHIPS_SEC/);
assert.match(trackUi, /m-track-len-chip/);
assert.match(trackUi, /MINIMAX_H3_OVER_MAX_NOTE/);
assert.match(trackUi, /refuseMinimaxH3OverMax/);
assert.match(
  readFileSync(join(here, "../src/lib/minimaxH3.ts"), "utf8"),
  /H3 max 15/,
);
assert.match(mobileCss, /\.m-track-len-chip/);
assert.doesNotMatch(trackUi, /m-track-pick-len input/);
assert.match(
  readFileSync(join(here, "../src/app/api/crash/mobile/song/route.ts"), "utf8"),
  /refuseMinimaxH3OverMax/,
);
assert.match(
  readFileSync(join(here, "../src/lib/scratchSongWindow.ts"), "utf8"),
  /HANG_LENGTH_CHIPS_SEC = \[5, 15, 25\]/,
);
assert.match(
  readFileSync(join(here, "../src/app/api/crash/mobile/track/route.ts"), "utf8"),
  /action === "move-plate"/,
);
{
  const moved = swapNeighborPlateTimings(
    [
      { plateId: "a", startMs: 0, endMs: 15000, sortIndex: 0 },
      { plateId: "b", startMs: 15000, endMs: 30000, sortIndex: 1 },
    ],
    "b",
    -1,
  );
  assert.equal(moved?.[0].plateId, "b");
  assert.equal(moved?.[0].startMs, 0);
  assert.equal(moved?.[1].plateId, "a");
  assert.equal(moved?.[1].startMs, 15000);
  assert.equal(
    swapNeighborPlateTimings(
      [{ plateId: "a", startMs: 0, endMs: 15000, sortIndex: 0 }],
      "a",
      -1,
    ),
    null,
  );
}

// Floor A: hang first, pull a handle, then Send. No typed How long box.
assert.match(trackUi, /stretchPlateEdge/);
assert.match(trackUi, /onStretchCommit/);
assert.match(trackUi, /hitPlateEdge/);
assert.match(trackUi, /Pull a handle on the bar/);
assert.match(trackUi, /selectedPlateId/);
assert.match(mobileCss, /\.m-track-stretch-hint/);
assert.match(trackRoute, /set-plate-timings/);
assert.match(trackUi, /saveStretchedBoxes/);
assert.match(trackUi, /pickedOnSong/);
assert.match(trackUi, /Already on the song/);
assert.doesNotMatch(trackUi, /await songPost\("add-plate"/);
assert.doesNotMatch(trackUi, /Pictures stay put/);

assert.match(mobileCss, /\.m-track-film/);
assert.match(
  readFileSync(join(here, "../src/app/api/crash/mobile/track/route.ts"), "utf8"),
  /action === "set-plate-duration"/,
);
assert.match(
  readFileSync(join(here, "../src/app/api/crash/mobile/track/route.ts"), "utf8"),
  /withPlateWindow/,
);
assert.match(
  readFileSync(join(here, "../src/app/api/crash/mobile/track/route.ts"), "utf8"),
  /startSec\?: number/,
);

const first = plateRailBox(0, 15000, 60000);
assert.equal(first.leftPct, 0);
assert.equal(first.widthPct, 25);
const late = plateRailBox(232000, 247500, 267500);
assert.ok(Math.abs(late.leftPct - (232000 / 267500) * 100) < 0.0001);
assert.ok(Math.abs(late.widthPct - (15500 / 267500) * 100) < 0.0001);

// Visual scale: 15s on a 5:27 song is 420px at 28px/s — not a 92px / ~3s cell.
{
  const songMs = 327_000;
  const viewW = 390;
  const waveW = trackWaveCssWidth(songMs, viewW);
  assert.equal(waveW, 327 * 28, "5:27 at 28px/s is 9156px, not the phone width");
  assert.equal(plateSlicePx(0, 15_000, songMs, waveW), 420);
  const box = plateRailBox(0, 15_000, songMs);
  assert.ok(Math.abs((box.widthPct / 100) * waveW - 420) < 0.51);
  assert.equal(plateSlicePx(0, 3_000, songMs, waveW), 84, "3s is 84px; do not fake 15s as that");
  assert.match(trackUi, /plateRailBox\(/, "hung pictures use the same clock box as the teal bar");
  assert.match(trackUi, /m-track-rail-align/, "hung pictures sit on the wave inner, not a 92px strip");
  assert.match(mobileCss, /\.m-track-scroll \{[\s\S]*?min-width: 0/, "wave scroller can shrink so 28px/s scrolls");
  assert.match(mobileCss, /\.m-track-rail-on-wave/);
}

assert.equal(formatTrackClockPrecise(247500), "4:07.5");
assert.equal(formatTrackClockPrecise(0), "0:00.0");

{
  const hung = hangMissingPlateTimings(
    [{ plateId: "shot_already", startMs: 4000, endMs: 19000, sortIndex: 0 }],
    [
      { shotId: "shot_already", startSec: 0, durationSec: 15 },
      { shotId: "shot_new", startSec: 15, durationSec: 15 },
      { shotId: "shot_new", startSec: 30, durationSec: 15 },
    ],
  );
  assert.equal(hung.length, 2);
  assert.equal(hung[0].plateId, "shot_already");
  assert.equal(hung[0].startMs, 4000, "do not move a clock already on the wave");
  assert.equal(hung[1].plateId, "shot_new");
  assert.equal(hung[1].startMs, 19000, "next gap after the real hang, not a piled 0:00");
  assert.equal(hung[1].endMs, 34000);

  const sevenCuts = [
    "shot_2uhu0p1",
    "shot_a",
    "shot_b",
    "shot_c",
    "shot_d",
    "shot_e",
    "shot_f",
  ].map((shotId, i) => ({ shotId, startSec: i * 15, durationSec: 15 }));
  const rail = hangMissingPlateTimings(
    [{ plateId: "shot_2uhu0p1", startMs: 0, endMs: 15000, sortIndex: 0 }],
    sevenCuts,
  );
  assert.equal(rail.length, 7);
  assert.equal(rail[0].startMs, 0);
  assert.equal(rail[0].endMs, 15000);
  assert.deepEqual(
    rail.slice(1).map((t) => t.plateId),
    ["shot_a", "shot_b", "shot_c", "shot_d", "shot_e", "shot_f"],
  );

  const nextWin = nextPlateHangWindow([
    { plateId: "shot_2uhu0p1", startMs: 0, endMs: 15000, sortIndex: 0 },
  ]);
  assert.equal(nextWin.startMs, 15000);
  assert.equal(nextWin.endMs, 30000);

  const resized = withPlateDuration(
    [
      { plateId: "a", startMs: 0, endMs: 15000, sortIndex: 0 },
      { plateId: "b", startMs: 15000, endMs: 30000, sortIndex: 1 },
    ],
    "a",
    8000,
    180000,
  );
  assert.equal(resized?.[0].endMs, 8000);
  assert.equal(resized?.[1].startMs, 8000);
  assert.equal(resized?.[1].endMs, 23000);
  assert.equal(withPlateDuration([], "missing", 8000, 180000), null);

  const five = withPlateDuration(
    [
      { plateId: "a", startMs: 0, endMs: 15000, sortIndex: 0 },
      { plateId: "b", startMs: 15000, endMs: 30000, sortIndex: 1 },
    ],
    "a",
    5000,
    180000,
  );
  assert.equal(five?.[0].endMs, 5000);
  assert.equal(five?.[1].startMs, 5000);
  const twentyFive = withPlateDuration(
    [{ plateId: "a", startMs: 0, endMs: 15000, sortIndex: 0 }],
    "a",
    25000,
    180000,
  );
  assert.equal(twentyFive?.[0].endMs, 25000);

  const placed = withPlateWindow(
    [
      { plateId: "a", startMs: 0, endMs: 15000, sortIndex: 0 },
      { plateId: "b", startMs: 15000, endMs: 30000, sortIndex: 1 },
    ],
    "b",
    45000,
    8000,
    180000,
  );
  assert.equal(placed?.[0].plateId, "a");
  assert.equal(placed?.[0].startMs, 0);
  assert.equal(placed?.[0].endMs, 15000, "earlier still stays put");
  assert.equal(placed?.[1].plateId, "b");
  assert.equal(placed?.[1].startMs, 45000);
  assert.equal(placed?.[1].endMs, 53000);
  assert.equal(withPlateWindow([], "missing", 1000, 8000, 180000), null);

  const jumped = withPlateWindow(
    [
      { plateId: "a", startMs: 0, endMs: 15000, sortIndex: 0 },
      { plateId: "b", startMs: 15000, endMs: 30000, sortIndex: 1 },
    ],
    "a",
    40000,
    10000,
    180000,
  );
  assert.equal(jumped?.find((t) => t.plateId === "a")?.startMs, 40000);
  assert.equal(jumped?.find((t) => t.plateId === "b")?.startMs, 15000);

  assert.equal(isLeftoverPlateHang({ startMs: 0, endMs: 500 }), true);
  assert.equal(isRealPlateHang({ startMs: 0, endMs: 500 }), false);
  assert.equal(isRealPlateHang({ startMs: 0, endMs: 15000 }), true);
  assert.equal(hangClipDurationMs(0.5), 15000);
  assert.equal(hangClipDurationMs(8.2), 8200);
  assert.equal(hangClipDurationMs(undefined), 15000);

  const piled = hangMissingPlateTimings(
    [
      { plateId: "plate_1", startMs: 0, endMs: 500, sortIndex: 0 },
      { plateId: "plate_8", startMs: 0, endMs: 500, sortIndex: 1 },
      { plateId: "plate_9", startMs: 0, endMs: 500, sortIndex: 2 },
    ],
    [
      { shotId: "plate_1", startSec: 0, durationSec: 0.5 },
      { shotId: "plate_8", startSec: 0, durationSec: 0.5 },
      { shotId: "plate_9", startSec: 0, durationSec: 0.5 },
    ],
  );
  assert.deepEqual(
    piled.map((x) => [x.plateId, x.startMs, x.endMs]),
    [
      ["plate_1", 0, 15000],
      ["plate_8", 15000, 30000],
      ["plate_9", 30000, 45000],
    ],
    "three 0:00 leftovers sequence at 15s each",
  );

  const knownLen = hangMissingPlateTimings(
    [],
    [
      { shotId: "plate_1", startSec: 0, durationSec: 12 },
      { shotId: "plate_8", startSec: 0, durationSec: 8 },
      { shotId: "plate_9", startSec: 0 },
    ],
  );
  assert.deepEqual(
    knownLen.map((x) => [x.plateId, x.startMs, x.endMs]),
    [
      ["plate_1", 0, 12000],
      ["plate_8", 12000, 20000],
      ["plate_9", 20000, 35000],
    ],
    "known mp4 length else 15",
  );

  const twoTakes = hangOneClipOnWave({
    plateTimings: [{ plateId: "plate-9", startMs: 0, endMs: 15000, sortIndex: 0 }],
    cuts: [
      {
        id: "c1",
        shotId: "plate-9",
        plateFile: "9.png",
        startSec: 0,
        durationSec: 15,
        clipFile: "09_kl0.mp4",
        status: "done",
      },
      {
        id: "c2",
        shotId: "plate-9",
        plateFile: "9.png",
        startSec: 0,
        durationSec: 8,
        clipFile: "09_dzd.mp4",
        status: "done",
      },
    ],
    shotId: "plate-9",
    plateFile: "9.png",
    clipFile: "09_dzd.mp4",
    durationSec: 8,
    newCutId: () => "c-new",
  });
  assert.equal(twoTakes?.plateTimings.length, 2, "second take gets its own clock");
  assert.equal(twoTakes?.plateTimings[0]?.plateId, "plate-9");
  assert.equal(twoTakes?.plateTimings[1]?.plateId, extraTakeHangPlateId("plate-9", "09_dzd.mp4"));
  assert.equal(twoTakes?.plateTimings[1]?.startMs, 15000, "next gap — do not pile on 0:00");
  assert.equal(twoTakes?.plateTimings[1]?.endMs, 23000, "real 8s, not a fake 15");
  assert.equal(hangPlateShotId(twoTakes?.plateTimings[1]?.plateId || ""), "plate-9");
  assert.equal(twoTakes?.cuts.length, 2, "do not wipe the first take");
  assert.equal(twoTakes?.cuts[0]?.clipFile, "09_kl0.mp4");
  assert.equal(twoTakes?.cuts[1]?.clipFile, "09_dzd.mp4");
  assert.equal(twoTakes?.cuts[1]?.shotId, extraTakeHangPlateId("plate-9", "09_dzd.mp4"));
  assert.equal(clipFileOnWave(twoTakes, "09_kl0.mp4"), true);
  assert.equal(clipFileOnWave(twoTakes, "09_dzd.mp4"), true);

  /**
   * Stuie 28 Aug: TRACK 3 hung bars end 0:25. CLIPS has 4 done mp4s.
   * Two share still jack3 / clock 0:20. Open → Add must hang the leftover
   * after 0:25, not mint waiting cook 4.
   */
  const waitingCuts = [
    {
      id: "w1",
      shotId: "jack1",
      plateFile: "jack.png",
      startSec: 0,
      durationSec: 15,
      clipFile: "",
      status: "pending",
    },
    {
      id: "w2",
      shotId: "car",
      plateFile: "car.png",
      startSec: 15,
      durationSec: 5,
      clipFile: "",
      status: "pending",
    },
    {
      id: "w3",
      shotId: "jack3",
      plateFile: "jack.png",
      startSec: 20,
      durationSec: 5,
      clipFile: "",
      status: "pending",
    },
  ];
  const hungBars = [
    { plateId: "jack1", startMs: 0, endMs: 15000, sortIndex: 0 },
    { plateId: "car", startMs: 15000, endMs: 20000, sortIndex: 1 },
    { plateId: "jack3", startMs: 20000, endMs: 25000, sortIndex: 2 },
  ];
  const fourClips = [
    { shotId: "jack1", clipFile: "01_Jack_15.mp4", clipStatus: "done", durationSec: 15 },
    { shotId: "car", clipFile: "02_Car_5.mp4", clipStatus: "done", durationSec: 5 },
    { shotId: "jack3", clipFile: "03_Jack_5.mp4", clipStatus: "done", durationSec: 5 },
    { shotId: "jack3", clipFile: "04_Jack_stand.mp4", clipStatus: "done", durationSec: 8 },
  ];
  const beforeTally = tallyPending(waitingCuts);
  assert.equal(beforeTally.parked, 3, "0/3 DONE · 3 WAITING");
  assert.equal(beforeTally.done, 0);

  const addLeftover = addPlateFileFirstHang({
    shotId: "jack3",
    plateFile: "jack.png",
    plateTimings: hungBars,
    cuts: waitingCuts,
    clips: fourClips,
    newCutId: () => "cut-leftover",
  });
  assert.equal(addLeftover.hung, true, "Open→Add hangs the leftover mp4");
  assert.equal(addLeftover.plateTimings.length, 4, "fourth bar after 0:25");
  assert.equal(addLeftover.plateTimings[0]?.startMs, 0);
  assert.equal(addLeftover.plateTimings[1]?.endMs, 20000);
  assert.equal(addLeftover.plateTimings[2]?.endMs, 25000, "three good bars stay");
  assert.equal(addLeftover.plateTimings[3]?.startMs, 25000, "after last hung end — not another 0:20");
  assert.equal(addLeftover.plateTimings[3]?.endMs, 33000, "real 8s clip length");
  assert.equal(
    addLeftover.plateTimings[3]?.plateId,
    extraTakeHangPlateId("jack3", "04_Jack_stand.mp4"),
  );
  const afterTally = tallyPending(addLeftover.cuts);
  assert.equal(afterTally.parked, 3, "waiting must not climb to 4");
  assert.equal(afterTally.done, 1, "leftover hang is done, not a 4th WAITING cook");
  assert.equal(
    addLeftover.cuts.filter((c) => c.status === "pending").length,
    3,
  );

  const addAgain = addPlateFileFirstHang({
    shotId: "jack3",
    plateFile: "jack.png",
    plateTimings: addLeftover.plateTimings,
    cuts: addLeftover.cuts,
    clips: fourClips,
    newCutId: () => "cut-cook-5",
  });
  assert.equal(addAgain.hung, false, "no leftover left — do not cook");
  assert.equal(addAgain.plateTimings.length, 4);
  assert.equal(tallyPending(addAgain.cuts).parked, 3, "second Add is not a 5th cook");

  const noFile = addPlateFileFirstHang({
    shotId: "empty-still",
    plateFile: "empty.png",
    plateTimings: hungBars,
    cuts: waitingCuts,
    clips: fourClips,
    newCutId: () => "cut-empty",
  });
  assert.equal(noFile.hung, false, "still with no mp4 is not a silent hang");
  assert.equal(tallyPending(noFile.cuts).parked, 3);

  function tallyPending(cuts) {
    const tally = { parked: 0, done: 0 };
    for (const c of cuts) {
      if (c.status === "done") tally.done += 1;
      else if (c.status !== "running" && c.status !== "error") tally.parked += 1;
    }
    return tally;
  }

  const stillsStayOff = hangMissingPlateTimings(
    [{ plateId: "plate_1", startMs: 0, endMs: 15000, sortIndex: 0 }],
    [],
    [],
  );
  assert.deepEqual(
    stillsStayOff.map((x) => x.plateId),
    ["plate_1"],
    "hang-plates must not invent 15s for off stills with no mp4",
  );

  const fromShots = hangMissingPlateTimings(
    [{ plateId: "shot_2uhu0p1", startMs: 0, endMs: 15000, sortIndex: 0 }],
    [],
    ["shot_hat", "shot_car"],
  );
  assert.equal(fromShots.length, 3);
  assert.equal(fromShots[1].plateId, "shot_hat");
  assert.equal(fromShots[1].startMs, 15000);
  assert.equal(fromShots[2].plateId, "shot_car");
  assert.equal(fromShots[2].startMs, 30000);

  assert.deepEqual(
    resolvePlateTimings({ plateTimings: [] }, {
      plateTimings: [{ plateId: "ghost", startMs: 0, endMs: 15000, sortIndex: 0 }],
    }).map((t) => t.plateId),
    ["ghost"],
    "empty song array must not hide a draft hang",
  );
  assert.equal(
    resolvePlateTimings({
      plateTimings: [{ plateId: "jack", startMs: 0, endMs: 15000, sortIndex: 0 }],
    }, {
      plateTimings: [{ plateId: "draft", startMs: 0, endMs: 8000, sortIndex: 0 }],
    })[0]?.plateId,
    "jack",
  );

  const boxes = [
    { plateId: "a", startMs: 0, endMs: 15000, sortIndex: 0 },
    { plateId: "b", startMs: 15000, endMs: 30000, sortIndex: 1 },
    { plateId: "c", startMs: 30000, endMs: 45000, sortIndex: 2 },
  ];
  const pulled = stretchPlateEdge(boxes, "b", "start", 10000, 45000);
  assert.equal(pulled.find((t) => t.plateId === "a")?.endMs, 15000, "other plates keep their times");
  assert.equal(pulled.find((t) => t.plateId === "b")?.startMs, 10000);
  assert.equal(pulled.find((t) => t.plateId === "b")?.endMs, 30000);
  const pushed = stretchPlateEdge(boxes, "b", "end", 40000, 45000);
  assert.equal(pushed.find((t) => t.plateId === "b")?.endMs, 40000);
  assert.equal(pushed.find((t) => t.plateId === "c")?.startMs, 30000, "later still stays put");
  const clamped = stretchPlateEdge(boxes, "b", "end", 100000, 45000);
  assert.equal(clamped.find((t) => t.plateId === "b")?.endMs, 45000);
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
}

assert.match(
  readFileSync(join(here, "../src/app/api/crash/mobile/song/route.ts"), "utf8"),
  /hangMissingPlateTimings/,
  "Add on a still must write the TRACK clock, not only a waiting cut",
);
assert.match(
  readFileSync(join(here, "../src/app/api/crash/mobile/song/route.ts"), "utf8"),
  /action === "hang-plates"/,
);
assert.match(trackUi, /hang-plates/);
assert.match(trackUi, /remove-plate-timing/);
assert.match(trackUi, /dropPlateFromWave/);
assert.match(trackUi, /Off song/);
assert.match(trackRoute, /parkMobileClipFile/);
assert.match(trackRoute, /songPlateIds/);
assert.match(trackRoute, /removePlateFromSong/);
assert.match(trackRoute, /durationSec\?: number/);
assert.doesNotMatch(
  trackRoute.slice(trackRoute.indexOf('action === "remove-plate-timing"')),
  /hangMissingPlateTimings|nextPlateHangWindow|add-plate/,
  "Off song must not hang or append a new row",
);
assert.match(songRoute, /hangCuts/);
assert.match(
  songRoute,
  /leftover job\.shots/,
  "hang-plates must not take every leftover shot row",
);
assert.match(songRoute, /needsDoneClipHang/);
assert.match(songRoute, /doneClipRowsForHang/);
assert.match(
  songRoute.slice(songRoute.indexOf('action === "hang-plates"')),
  /hangMissingPlateTimings\(song\.plateTimings, hangCuts, \[\]\)/,
  "hang-plates must not invent 15s for off stills with no mp4",
);
assert.match(songRoute, /addPlateFileFirstHang/, "ADD hangs an existing mp4");
assert.match(
  songRoute.slice(songRoute.indexOf('action === "add-plate"')),
  /fileFirst\.hung/,
  "Open→Add must not fall through to a 4th WAITING cook when the file exists",
);
assert.match(trackUi, /needsDoneClipHang/);
assert.match(trackUi, /hungClipFileForPlate\(job, picked\.shotId\) \? null/);
assert.match(trackUi, /isRealPlateHang/);

console.log("check-music-video-track: ok");

const park = readFileSync(join(here, "../src/lib/parkDeskClip.ts"), "utf8");
const clipRoute = readFileSync(join(here, "../src/app/api/crash/mobile/clip/route.ts"), "utf8");
const motion = readFileSync(join(here, "../src/lib/mobileImageMotion.ts"), "utf8");
const scratchClip = readFileSync(join(here, "../src/lib/mobileScratchClip.ts"), "utf8");
assert.match(park, /planParkDeskClipTake/);
assert.match(park, /_cleared/);
assert.match(clipRoute, /planParkDeskClipTake/);
assert.match(motion, /pickLtxMotionBody/);
assert.match(scratchClip, /That still is not ready/);
assert.match(scratchClip, /Drop the song first/);
assert.match(scratchClip, /pickSongSendMotionBody/);
assert.match(scratchClip, /songSendNeedsRecook/);
assert.match(scratchClip, /planParkDeskClipTake/);
assert.match(trackUi, /cutForHungPlate/);
assert.match(motion, /pickSongSendMotionBody/);
{
  const hung = cutForHungPlate({
    cuts: [
      {
        id: "cut_mtylzdo",
        shotId: "shot_1j8xafx",
        startSec: 0,
        durationSec: 15,
        status: "done",
        clipFile: "01_JACK_GHOST_GIVE_ME_SOMETHING.mp4",
      },
      {
        id: "cut_l27ecte",
        shotId: "shot_1j8xafx",
        startSec: 180,
        durationSec: 15,
        status: "pending",
      },
    ],
    shotId: "shot_1j8xafx",
    timing: { plateId: "shot_1j8xafx", startMs: 0, endMs: 15000, sortIndex: 0 },
  });
  assert.equal(hung?.id, "cut_mtylzdo", "Send this still, not a later leftover row");
}

const editor = readFileSync(join(here, "../src/components/mobile/PlateReviewEditor.tsx"), "utf8");
const panels = readFileSync(join(here, "../src/components/mobile/ShotPromptPanels.tsx"), "utf8");
const thumbs = readFileSync(join(here, "../src/components/mobile/PlateClipThumbs.tsx"), "utf8");
assert.doesNotMatch(trackUi, /m-track-engines/, "engines do not sit on the TRACK pick");
assert.doesNotMatch(trackUi, />\s*Siray\s*</, "Siray is not on the TRACK pick");
assert.doesNotMatch(trackUi, />\s*Free\s*</, "Free is not on the TRACK pick");
assert.doesNotMatch(trackUi, /m-track-motion-slot/, "[ ] motion hole is not on TRACK");
assert.doesNotMatch(trackUi, /MUTE_MV_SLOT_PLACEHOLDER/, "TRACK pick does not edit the motion hole");
assert.match(editor, /MuteMvMotionHole/, "LTX / H3 open the 90% lock + [ ] hole");
assert.match(editor, /setEnginePromptOpen\(true\)/, "tap LTX or H3 opens the motion prompt");
assert.match(editor, /onOpen=\{\(next\) =>/, "LTX / H3 are openers, not a dead highlight");
assert.match(panels, /export function MuteMvMotionHole/, "one hole for LTX and H3");
assert.match(panels, /muteMvMotionLabel\(engine\)/, "hole title follows LTX vs H3");
assert.match(panels, /m-plate-motion-fold/, "folded H3 / LTX line sits under the hole title");
assert.match(panels, /muteMvEngineFoldSummary\(engine\)/, "fold summary follows the picked engine");
assert.match(panels, /muteMvEngineFoldLines\(engine\)/, "one tap opens the engine facts");
assert.doesNotMatch(trackUi, /m-plate-motion-fold/, "engine fold is not a TRACK essay");
assert.doesNotMatch(trackUi, /muteMvEngineFold/, "fold copy does not live on the wave");
assert.doesNotMatch(trackUi, /Cowboy Bebop/, "Cowboy Bebop lock is on the hole, not TRACK");
assert.doesNotMatch(panels, /endPlateFile/, "/m hole has no last-frame picker");
assert.doesNotMatch(editor, /endPlateFile/, "/m plate editor has no last-frame picker");
assert.doesNotMatch(
  panels,
  /m-plate-motion-label">\s*LTX Image motion/,
  "hole title is not a hardcoded LTX IMAGE MOTION",
);
assert.match(panels, /m-plate-motion-slot/, "[ ] hole is the only edit");
assert.match(panels, /MUTE_MV_SLOT_PLACEHOLDER/, "hole placeholder is stand up, car drives off");
assert.match(editor, /writeMvMotionSlot/, "plate [ ] keeps the slot when he switches engine");
assert.match(editor, /function PlateEngineButtons/, "LTX / H3 sit on the plate Add row");
assert.match(editor, /function PlateSendButton/, "Send sits on the plate Add row");
assert.match(editor, /m-plate-add-engines/, "Add | LTX | H3 | Send share one row");
assert.match(editor, />\s*LTX\s*</, "LTX is a real button next to Add");
assert.match(editor, />\s*H3\s*</, "H3 is a real button next to Add");
assert.match(editor, /busy \? "Sending…" : "Send"/, "Send is on the same row as Add / LTX / H3");
assert.match(editor, /onSendStill/, "plate Send uses the one TRACK cook");
assert.match(editor, /Sending…/, "plate Send shows Sending while the cook runs");
assert.match(editor, /sendStillNote/, "plate card can show a cook line under Send");
assert.match(
  editor,
  /sendStillBusy \? "m-song-cook-note" : "m-track-err"/,
  "cook line is dim while Sending, pink if it failed",
);
assert.match(trackUi, /onSendStillNote/, "TRACK paints the plate cook line");
assert.match(
  trackUi,
  /Cooking — mouths shut\. This can take a few minutes\./,
  "No lips Send says mouths shut, not a mute percent bar",
);
assert.match(trackUi, /Cooking — mouths shut\. Still going\./, "No lips Send ticks still going");
assert.match(trackUi, /paintPlateSend/, "Send writes the plate line, not only TRACK setNote");
assert.match(
  tree,
  /onSendStillNote=\{setSendStillNote\}/,
  "tree passes the cook line to the open plate",
);
assert.doesNotMatch(editor, />\s*Siray\s*</, "Siray stays off the plate");
assert.doesNotMatch(editor, />\s*Free\s*</, "Free stays off the plate");
assert.match(editor, /writeMvEngine/, "tap stores the engine for the next Send");
assert.doesNotMatch(editor, /pickEngine/, "do not put LTX / H3 on CLIPS thumbs");
assert.doesNotMatch(thumbs, /pickEngine/, "CLIPS / plate-1 thumb is not the engine row");
assert.doesNotMatch(thumbs, /m-plate-clip-engine/, "CLIPS / plate-1 thumb is not the engine row");
assert.match(trackUi, /resolveMvSendEngine/, "the one Send reads the same LTX / H3 pick as the hole");
assert.match(editor, /resolveMvSendEngine/, "hole title uses the live LTX / H3 pick");
assert.match(editor, /engine=\{mvEngine\}/, "H3 highlight and hole title share one engine");
assert.doesNotMatch(editor, /engine=\{mvEngine \|\| "ltx"\}/, "do not hard-fallback the hole to LTX");
assert.match(trackUi, /onBindSendStill/, "plate row Send is the same cook");
assert.match(trackUi, /clipEngine/, "Send can still run LTX / H3");
assert.doesNotMatch(trackUi, /Seedance/, "do not fake a Seedance button");
assert.match(mobileCss, /\.m-plate-add-engines/, "Add | LTX | H3 stay on one row");
assert.match(mobileCss, /\.m-plate-motion-hole/, "opened prompt is lock + [ ] on the plate");
assert.match(mobileCss, /\.m-plate-motion-fold/, "folded H3 / LTX line is under the hole title");
assert.match(mobileCss, /\.m-plate-motion-lock/, "90% lock sits around the [ ] hole");
assert.doesNotMatch(mobileCss, /\.m-plate-clip-engines/, "no engine chrome on the CLIPS thumb");
assert.match(
  readFileSync(join(here, "../src/app/api/crash/mobile/song/route.ts"), "utf8"),
  /action === "clip-poll"/,
  "H3 / Siray poll on the song route",
);
assert.match(
  readFileSync(join(here, "../src/lib/mobileImageMotion.ts"), "utf8"),
  /buildMuteMvMotionLock/,
);
assert.match(editor, /styleId === "music_video"/, "music_video plate shows LTX / H3 instead of + another line");
assert.match(editor, /AnotherLineButton/, "+ another line stays for non music_video");
assert.match(editor, />\s*No lips\s*</, "No lips sits next to H3");
assert.match(editor, /writeMvMuteAction/, "No lips stores mute for the next Send");
assert.match(editor, /muteMvEmptyFrame/, "plate lock drops the singer when nobody is in the still");
assert.match(editor, /writeMvNobodyInShot/, "Nobody next to HERO/SUPPORT");
assert.match(
  editor,
  /function EmptyMvMotionHole/,
  "empty + Nobody still mounts the [ ] hole — no spoken beat required",
);
assert.match(
  editor,
  /styleId === "music_video" && \(enginePromptOpen \|\| muteAction\)/,
  "LTX / H3 open the hole on an empty plate, not only when a speaker exists",
);
assert.match(
  editor,
  /emptyFrame:\s*true/,
  "empty + Nobody lock is empty road, no people, mouth N/A",
);
{
  const emptyHoleFn =
    editor.match(/function EmptyMvMotionHole\([\s\S]*?\nfunction PlateSendButton/)?.[0] || "";
  assert.match(emptyHoleFn, /MuteMvMotionHole/, "empty path renders the same [ ] hole");
  assert.doesNotMatch(emptyHoleFn, /AnotherLineButton/, "empty hole does not show Walk away / another line");
  assert.doesNotMatch(emptyHoleFn, /Add someone/, "empty hole does not require Add someone");
}
assert.match(trackUi, /muteMvEmptyFrame/, "Send uses the same empty-frame lock");
assert.match(trackUi, /emptyFrame/);
assert.match(
  editor,
  /beat\.kind === "cutaway" && styleId !== "music_video"/,
  "talking Walk away / SFX leftover stays off music_video",
);
assert.match(trackUi, /readMvMuteAction/, "Send reads No lips");
assert.match(trackUi, /mute: true/, "Send posts mute so LTX does not get the song");
assert.match(trackUi, /songRunEmptyExtras/, "TRACK Send posts the on-screen Nobody lock");
assert.match(trackUi, /emptyFrame: true/, "Nobody Send tells song run the frame is empty");
assert.match(trackUi, /emptyFrame \? "" : speaker \|\| shot\?\.title/, "yellow JACK title does not override Nobody");
assert.match(songRoute, /emptyFrame: body.emptyFrame === true/);
assert.match(songRoute, /nobodyInShot: body.nobodyInShot === true/);
assert.match(
  readFileSync(join(here, "../src/lib/mobileImageMotion.ts"), "utf8"),
  /readMvMuteAction/,
);
