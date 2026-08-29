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
  addPlateHangOnTrack,
  cutFromPlateTiming,
  extraStillHangPlateId,
  extraTakeHangPlateId,
  hangClipDurationMs,
  hangMissingPlateTimings,
  hangOneClipOnWave,
  hangPlateShotId,
  hangUnhungDoneClips,
  listUnhungDoneClips,
  isLeftoverPlateHang,
  isRealPlateHang,
  clipFileOnWave,
  hitPlateEdge,
  firstUnusedLyricHangStartMs,
  singingHangStartMs,
  nextPlateHangWindow,
  resolvePlateTimings,
  stretchPlateEdge,
  slidePlateIntoGap,
  withPlateDuration,
  withPlateWindow,
  msToSec,
  orderedDoneCutsForStitch,
  plateRailBox,
  plateSlicePx,
  secToMs,
  hungBarDurationSec,
  cookDurationFromHungBar,
  ensurePlateDuration,
  applyLandedClipDuration,
  sliceBoundsForPlate,
  sortPlateTimings,
  trackWaveCssWidth,
  cutForHungPlate,
  hangIdForSend,
} from "../src/lib/musicVideoTrack.ts";
import { hangDoneClipOnTrack } from "../src/lib/stockClipHang.ts";
import { hungClipFileForPlate } from "../src/lib/orderedJobClips.ts";
import { applyAddPlateOnSong, removePlateFromSong } from "../src/lib/musicVideoSong.ts";
import { MOBILE_JOB_READ_MISS } from "../src/lib/mobileGenJob.ts";
import {
  formatCookClock,
  formatScratchCookNote,
  h3PhaseToCookStep,
  humanScratchCookLine,
  parseScratchCook,
  scratchCookButtonLabel,
  scratchCookShouldWrite,
} from "../src/lib/scratchCookProgress.ts";
import {
  clampHangLengthSec,
  HANG_LENGTH_MAX_SEC,
  HANG_LENGTH_MIN_SEC,
} from "../src/lib/scratchSongWindow.ts";

const here = dirname(fileURLToPath(import.meta.url));
const tree = readFileSync(join(here, "../src/components/mobile/StudioTree.tsx"), "utf8");
const trackUi = readFileSync(join(here, "../src/components/mobile/MusicVideoTrack.tsx"), "utf8");
const trackRoute = readFileSync(join(here, "../src/app/api/crash/mobile/track/route.ts"), "utf8");
const songRoute = readFileSync(join(here, "../src/app/api/crash/mobile/song/route.ts"), "utf8");
const mobileCss = readFileSync(join(here, "../src/app/(mobile)/m/mobile.css"), "utf8");
const attach = readFileSync(join(here, "../src/lib/scratchSongAttach.ts"), "utf8");
const songLib = readFileSync(join(here, "../src/lib/musicVideoSong.ts"), "utf8");
const trackLib = readFileSync(join(here, "../src/lib/musicVideoTrack.ts"), "utf8");

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

const hangWinsTrack = sliceBoundsForPlate({
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
    durationSec: 5,
  },
});
assert.equal(hangWinsTrack.startSec, 60);
assert.equal(hangWinsTrack.durationSec, 15, "stale 5s cut must not beat a 15s hung bar");

const sevenHang = sliceBoundsForPlate({
  song: {
    fileName: "song.mp3",
    durationSec: 180,
    sliceStartSec: 0,
    sliceDurationSec: 15,
    plateTimings: [{ plateId: "shot_a", startMs: 0, endMs: 7000, sortIndex: 0 }],
  },
  shotId: "shot_a",
  cut: { id: "c", plateFile: "a.png", shotId: "shot_a", startSec: 0, durationSec: 5 },
});
assert.equal(sevenHang.durationSec, 7);
const nineHang = sliceBoundsForPlate({
  song: {
    fileName: "song.mp3",
    durationSec: 180,
    sliceStartSec: 0,
    sliceDurationSec: 15,
    plateTimings: [{ plateId: "shot_a", startMs: 0, endMs: 9000, sortIndex: 0 }],
  },
  shotId: "shot_a",
});
assert.equal(nineHang.durationSec, 9);
{
  const twice = {
    fileName: "song.mp3",
    durationSec: 180,
    sliceStartSec: 0,
    sliceDurationSec: 15,
    plateTimings: [
      { plateId: "jack", startMs: 0, endMs: 15000, sortIndex: 0 },
      { plateId: "jack~still2", startMs: 20000, endMs: 35000, sortIndex: 1 },
    ],
    cuts: [
      {
        id: "c1",
        plateFile: "jack.png",
        shotId: "jack",
        startSec: 0,
        durationSec: 15,
        clipFile: "01_Jack.mp4",
        status: "done",
      },
      {
        id: "c2",
        plateFile: "jack.png",
        shotId: "jack~still2",
        startSec: 20,
        durationSec: 15,
        status: "pending",
      },
    ],
  };
  const hang2Bounds = sliceBoundsForPlate({
    song: twice,
    shotId: "jack",
    cut: twice.cuts[1],
  });
  assert.equal(hang2Bounds.startSec, 20, "Send on hang 2 uses ~still2 clock, not hang 1");
  assert.equal(hang2Bounds.durationSec, 15);
  const hang1Bounds = sliceBoundsForPlate({
    song: twice,
    shotId: "jack",
    cut: twice.cuts[0],
  });
  assert.equal(hang1Bounds.startSec, 0, "hang 1 keeps its own clock");
  assert.equal(
    cutForHungPlate({
      cuts: twice.cuts,
      shotId: "jack~still2",
      timing: twice.plateTimings[1],
    })?.id,
    "c2",
  );
  assert.equal(
    cutForHungPlate({
      cuts: twice.cuts,
      shotId: "jack",
      timing: twice.plateTimings[0],
    })?.clipFile,
    "01_Jack.mp4",
  );
  const stamped = hangDoneClipOnTrack({
    song: twice,
    shotId: "jack~still2",
    plateFile: "jack.png",
    clipFile: "02_Jack.mp4",
    newCutId: () => "c3",
  });
  assert.equal(
    stamped?.cuts.find((c) => c.id === "c1")?.clipFile,
    "01_Jack.mp4",
    "stamp on hang 2 must not write hang 1's clipFile",
  );
  assert.equal(stamped?.cuts.find((c) => c.id === "c2")?.clipFile, "02_Jack.mp4");
  const steal = hangDoneClipOnTrack({
    song: twice,
    shotId: "jack~still2",
    plateFile: "jack.png",
    clipFile: "01_Jack.mp4",
    newCutId: () => "c3",
  });
  assert.equal(
    steal?.cuts.find((c) => c.id === "c1")?.clipFile,
    "01_Jack.mp4",
  );
  assert.equal(
    (steal?.cuts.find((c) => c.id === "c2")?.clipFile || "").trim(),
    "",
    "clip 1 already on hang 1 — do not copy it onto hang 2",
  );
  assert.equal(
    hungClipFileForPlate({ clips: [], scratchSong: twice }, "jack"),
    "01_Jack.mp4",
  );
  assert.equal(
    hungClipFileForPlate({ clips: [], scratchSong: twice }, "jack~still2"),
    "",
    "hang 2 stays empty until its own cook",
  );
  assert.equal(
    hangIdForSend({
      shotId: "jack",
      plateTimings: twice.plateTimings,
      cuts: twice.cuts,
    }),
    "jack~still2",
    "plate-row Send targets the empty extra hang",
  );
  assert.equal(
    hangIdForSend({
      shotId: "jack",
      plateTimings: twice.plateTimings,
      cuts: twice.cuts,
      pickedId: "jack",
    }),
    "jack",
    "picked hang 1 stays hang 1",
  );
}
assert.equal(hungBarDurationSec({ startMs: 0, endMs: 7000 }), 7);
assert.equal(hungBarDurationSec({ startMs: 0, endMs: 9000 }), 9);
assert.equal(hungBarDurationSec({ startMs: 0, endMs: 500 }), undefined);
{
  const sevenCook = cookDurationFromHungBar({ startMs: 0, endMs: 7000 }, "h3");
  assert.ok(!("error" in sevenCook));
  assert.equal(sevenCook.durationSec, 7);
  assert.equal(sevenCook.note, "");
  const nineCook = cookDurationFromHungBar({ startMs: 0, endMs: 9000 }, "h3");
  assert.ok(!("error" in nineCook));
  assert.equal(nineCook.durationSec, 9);
  const fifteenCook = cookDurationFromHungBar({ startMs: 0, endMs: 15000 }, "h3");
  assert.ok(!("error" in fifteenCook));
  assert.equal(fifteenCook.durationSec, 15);
  const twentyFive = cookDurationFromHungBar({ startMs: 0, endMs: 25000 }, "h3");
  assert.ok(!("error" in twentyFive));
  assert.equal(twentyFive.durationSec, 15);
  assert.match(twentyFive.note, /H3 max 15/);
  const missing = cookDurationFromHungBar(null, "h3");
  assert.ok("error" in missing);
  const tenLtx = cookDurationFromHungBar({ startMs: 0, endMs: 10000 }, "ltx");
  assert.ok(!("error" in tenLtx));
  assert.equal(tenLtx.durationSec, 10, "10s bar cooks 10 — do not invent 15");
  assert.equal(tenLtx.note, "");
  const fortyLtx = cookDurationFromHungBar({ startMs: 0, endMs: 40000 }, "ltx");
  assert.ok(!("error" in fortyLtx));
  assert.equal(fortyLtx.durationSec, 40, "40s bar cooks 40");
  assert.equal(fortyLtx.note, "");
  const midLtx = cookDurationFromHungBar({ startMs: 0, endMs: 31600 }, "ltx");
  assert.ok(!("error" in midLtx));
  assert.equal(midLtx.durationSec, 31.6);
  const overLtx = cookDurationFromHungBar({ startMs: 0, endMs: 45000 }, "ltx");
  assert.ok(!("error" in overLtx));
  assert.equal(overLtx.durationSec, 40);
  assert.match(overLtx.note, /LTX max 40/);
  const fortyH3 = cookDurationFromHungBar({ startMs: 0, endMs: 40000 }, "h3");
  assert.ok(!("error" in fortyH3));
  assert.equal(fortyH3.durationSec, 15, "H3 stays 4–15");
}

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
assert.match(trackUi, /Take off the song/);
assert.match(
  trackUi,
  /aria-label="Take off the song"[\s\S]{0,220}dropPlateFromWave/,
  "TRACK X unhangs — it must not park the mp4",
);
assert.doesNotMatch(
  trackUi,
  /aria-label="Take off the song"[\s\S]{0,220}redoPlate/,
  "TRACK X is not Redo / park",
);
assert.doesNotMatch(trackUi, /Park this clip/);
assert.match(trackUi, /requestSongCookStop/);
assert.match(trackUi, /m-track-film/);
assert.doesNotMatch(trackUi, /m-track-film-len">off</, "TRACK must not draw leftover stills as an off-row");
assert.doesNotMatch(trackUi, /m-track-rail-add/, "TRACK must not draw a second + next to STILLS");
assert.doesNotMatch(trackUi, /aria-label="Add a still"/);
assert.doesNotMatch(trackUi, /aria-label="Add a plate"/, "TRACK + is gone");
assert.doesNotMatch(trackUi, /ADD PLATE/, "TRACK must not draw ADD PLATE — STILLS is how he adds");
assert.doesNotMatch(trackUi, /m-track-add-plate/, "TRACK must not grow an add-plate control");
assert.doesNotMatch(trackUi, /onCreatePlate/, "TRACK must not open a person/place picker");
assert.doesNotMatch(trackUi, /m-plate-pick/, "TRACK picker went with ADD PLATE");
assert.doesNotMatch(trackUi, /filter\(\(cell\) => !cell\.onSong\)/, "TRACK does not list off-song stills");
assert.doesNotMatch(trackUi, />off</, "TRACK has no off badge row of existing stills");
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
assert.match(trackUi, /PlateLenSlider/);
assert.doesNotMatch(trackUi, /snapHangLengthSec/, "TRACK no longer snaps 5/10/15");
assert.doesNotMatch(trackUi, /m-track-len-chip/, "5/10/15 chips as separate buttons are gone");
assert.doesNotMatch(
  trackUi,
  /HANG_LENGTH_CHIPS_SEC\.map\(\(sec\) =>/,
  "chips are not mapped to buttons",
);
assert.doesNotMatch(trackUi, /MINIMAX_H3_OVER_MAX_NOTE/);
assert.doesNotMatch(trackUi, /refuseMinimaxH3OverMax/);
assert.doesNotMatch(trackUi, /H3 max 15 — use LTX for 25/);
assert.match(
  readFileSync(join(here, "../src/lib/minimaxH3.ts"), "utf8"),
  /H3 max 15/,
);
assert.doesNotMatch(mobileCss, /\.m-track-len-chip/, "chip chrome is gone");
assert.match(mobileCss, /\.m-track-len-slider/);
assert.match(mobileCss, /\.m-track-pick-len input\[type="number"\]/);
assert.match(mobileCss, /width: 2\.3rem/, "seconds box is half the old 4.6rem");
{
  const lenUi = readFileSync(join(here, "../src/components/mobile/PlateLenSlider.tsx"), "utf8");
  assert.match(lenUi, /type="range"/);
  assert.match(lenUi, /m-track-len-slider/);
  assert.match(lenUi, /min=\{HANG_LENGTH_MIN_SEC\}/);
  assert.match(lenUi, /max=\{HANG_LENGTH_MAX_SEC\}/);
  assert.match(lenUi, /step=\{1\}/);
  assert.match(lenUi, /aria-label="Seconds on the song"/);
  assert.match(lenUi, /set-plate-duration/);
  assert.match(lenUi, /PlateHangLenControl/);
  assert.doesNotMatch(lenUi, /snapHangLengthSec/);
  assert.doesNotMatch(lenUi, /step=\{5\}/, "slider is continuous 5–40, not 5/10/15 snaps");
}
assert.equal(HANG_LENGTH_MIN_SEC, 5);
assert.equal(HANG_LENGTH_MAX_SEC, 40);
assert.equal(clampHangLengthSec(10), 10);
assert.equal(clampHangLengthSec(40), 40);
assert.equal(clampHangLengthSec(31.6), 31.6);
assert.equal(clampHangLengthSec(50), 40);
assert.equal(clampHangLengthSec(3), 5);
assert.match(
  readFileSync(join(here, "../src/app/api/crash/mobile/song/route.ts"), "utf8"),
  /refuseMinimaxH3OverMax/,
);
assert.match(
  readFileSync(join(here, "../src/app/api/crash/mobile/song/route.ts"), "utf8"),
  /HANG_LENGTH_MAX_SEC/,
  "LTX Send clamp is 40, not the old 30",
);
assert.doesNotMatch(
  readFileSync(join(here, "../src/app/api/crash/mobile/song/route.ts"), "utf8"),
  /SCRATCH_SONG_SLICE_MAX_SEC/,
  "song run must not still clamp LTX to 30",
);
assert.match(
  readFileSync(join(here, "../src/lib/scratchSongWindow.ts"), "utf8"),
  /HANG_LENGTH_MAX_SEC = 40/,
);
assert.match(trackUi, /cookDurationFromHungBar/);
assert.match(trackUi, /durationSec: cook\.durationSec/);
assert.match(trackUi, /commitHungPlateLength/);
assert.doesNotMatch(trackUi, /\.\.\.\(durationSec \? \{ durationSec \} : \{\}\)/);
assert.match(
  readFileSync(join(here, "../src/app/api/crash/mobile/track/route.ts"), "utf8"),
  /action === "move-plate"/,
);
{
  // Move left fills the empty clock. Identities stay. Length stays.
  const desk = [
    { plateId: "a", startMs: 0, endMs: 15000, sortIndex: 0 },
    { plateId: "b", startMs: 22000, endMs: 27000, sortIndex: 1 },
    { plateId: "jack1", startMs: 27000, endMs: 32000, sortIndex: 2 },
    { plateId: "jack2", startMs: 32000, endMs: 37000, sortIndex: 3 },
  ];
  const left = slidePlateIntoGap(desk, "b", -1);
  assert.equal(left?.find((t) => t.plateId === "a")?.startMs, 0);
  assert.equal(left?.find((t) => t.plateId === "a")?.endMs, 15000);
  assert.equal(left?.find((t) => t.plateId === "b")?.startMs, 15000);
  assert.equal(left?.find((t) => t.plateId === "b")?.endMs, 20000, "selected bar stays 5s");
  assert.equal(left?.find((t) => t.plateId === "jack1")?.startMs, 27000);
  assert.equal(left?.find((t) => t.plateId === "jack1")?.endMs, 32000);
  assert.equal(left?.find((t) => t.plateId === "jack2")?.startMs, 32000);
  assert.equal(left?.find((t) => t.plateId === "jack2")?.endMs, 37000);
  assert.equal(left?.[0]?.plateId, "a", "first bar stays first");
  {
    let cuts = [
      {
        id: "cut_a",
        plateFile: "a.png",
        shotId: "a",
        startSec: 0,
        durationSec: 15,
        clipFile: "01_first.mp4",
        status: "done",
        error: "",
      },
      {
        id: "cut_b",
        plateFile: "b.png",
        shotId: "b",
        startSec: 22,
        durationSec: 5,
        clipFile: "02_car.mp4",
        status: "done",
        error: "",
      },
    ];
    for (const timing of left || []) {
      cuts = cutFromPlateTiming(cuts, timing, `${timing.plateId}.png`, () => "cut_x");
    }
    assert.equal(cuts.find((c) => c.shotId === "a")?.clipFile, "01_first.mp4");
    assert.equal(cuts.find((c) => c.shotId === "b")?.clipFile, "02_car.mp4");
    assert.equal(cuts.find((c) => c.shotId === "b")?.startSec, 15);
    assert.equal(cuts.find((c) => c.shotId === "b")?.durationSec, 5);
    assert.equal(cuts.find((c) => c.shotId === "a")?.startSec, 0);
  }
  assert.equal(left?.find((t) => t.startMs === 15000)?.plateId, "b");
  assert.equal(
    slidePlateIntoGap(
      [
        { plateId: "a", startMs: 0, endMs: 15000, sortIndex: 0 },
        { plateId: "b", startMs: 15000, endMs: 30000, sortIndex: 1 },
      ],
      "b",
      -1,
    ),
    null,
    "flush bars do not swap identities",
  );
  const right = slidePlateIntoGap(
    [
      { plateId: "a", startMs: 0, endMs: 15000, sortIndex: 0 },
      { plateId: "b", startMs: 15000, endMs: 20000, sortIndex: 1 },
      { plateId: "c", startMs: 30000, endMs: 35000, sortIndex: 2 },
    ],
    "b",
    1,
  );
  assert.equal(right?.find((t) => t.plateId === "a")?.startMs, 0);
  assert.equal(right?.find((t) => t.plateId === "b")?.startMs, 25000);
  assert.equal(right?.find((t) => t.plateId === "b")?.endMs, 30000, "Move right keeps length");
  assert.equal(right?.find((t) => t.plateId === "c")?.plateId, "c");
  assert.equal(right?.find((t) => t.plateId === "c")?.startMs, 30000);
  assert.equal(
    slidePlateIntoGap(
      [
        { plateId: "a", startMs: 0, endMs: 15000, sortIndex: 0 },
        { plateId: "b", startMs: 15000, endMs: 20000, sortIndex: 1 },
        { plateId: "c", startMs: 20000, endMs: 25000, sortIndex: 2 },
      ],
      "b",
      1,
    ),
    null,
    "Move right does not swap into the next clip",
  );
  assert.equal(
    slidePlateIntoGap(
      [
        { plateId: "a", startMs: 0, endMs: 15000, sortIndex: 0 },
        { plateId: "b", startMs: 22000, endMs: 27000, sortIndex: 1 },
      ],
      "b",
      1,
      180000,
    ),
    null,
    "last bar does not jump to the song end",
  );
}
assert.match(trackRoute, /slidePlateIntoGap/);
assert.doesNotMatch(trackRoute, /swapNeighborPlateTimings/);
assert.match(trackUi, /slidePlateIntoGap/);
assert.doesNotMatch(trackLib, /swapNeighborPlateTimings/);

// Floor A: hang first, pull a handle, then Send. No typed How long box.
assert.match(trackUi, /stretchPlateEdge/);
assert.match(trackUi, /onStretchCommit/);
assert.match(trackUi, /hitPlateEdge/);
assert.doesNotMatch(
  trackUi,
  /Pull a handle on the bar to lengthen or shorten/,
  "TRACK must not lecture about a handle on a bar",
);
assert.doesNotMatch(trackUi, /Pull a handle on the bar/);
assert.match(trackUi, /selectedPlateId/);
assert.match(mobileCss, /\.m-track-stretch-hint/);
assert.match(trackRoute, /set-plate-timings/);
assert.match(trackUi, /saveStretchedBoxes/);
assert.match(trackUi, /pickedOnSong/);
assert.match(trackUi, /Already on the song/);
assert.doesNotMatch(trackUi, /await songPost\("add-plate"/);
assert.doesNotMatch(trackUi, /Pictures stay put/);

assert.match(mobileCss, /\.m-track-rail-add/);
assert.match(
  readFileSync(join(here, "../src/app/api/crash/mobile/track/route.ts"), "utf8"),
  /action === "set-plate-duration"/,
);
assert.match(
  readFileSync(join(here, "../src/app/api/crash/mobile/track/route.ts"), "utf8"),
  /ensurePlateDuration/,
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
  const next20 = nextPlateHangWindow(
    [{ plateId: "shot_2uhu0p1", startMs: 0, endMs: 15000, sortIndex: 0 }],
    20,
  );
  assert.equal(next20.startMs, 15000);
  assert.equal(next20.endMs, 35000, "TRACK Add hangs the slider 20s — not 15");

  const silverCues = [
    { lineIndex: 0, atMs: 31000 },
    { lineIndex: 1, atMs: 81000 },
  ];
  const thirtyIntro = [{ plateId: "intro", startMs: 0, endMs: 30000, sortIndex: 0 }];
  assert.equal(firstUnusedLyricHangStartMs(silverCues, thirtyIntro), 31000);
  assert.equal(
    firstUnusedLyricHangStartMs(silverCues, [
      ...thirtyIntro,
      { plateId: "jack", startMs: 31000, endMs: 46000, sortIndex: 1 },
    ]),
    81000,
    "Jack already on Silver yields wheels",
  );
  assert.equal(singingHangStartMs({ singing: false, lyricCues: silverCues, plateTimings: thirtyIntro }), null);
  assert.equal(singingHangStartMs({ singing: true, lyricCues: silverCues, plateTimings: thirtyIntro }), 31000);
  const singingWin = nextPlateHangWindow(thirtyIntro, { singing: true, lyricCues: silverCues });
  assert.equal(singingWin.startMs, 31000, "TRACK first Add of a singing still uses Silver 0:31");
  assert.equal(singingWin.endMs, 46000);
  const muteWin = nextPlateHangWindow(thirtyIntro, { singing: false, lyricCues: silverCues });
  assert.equal(muteWin.startMs, 30000, "mute / support still hangs in the gap after intro");
  const jackHeld = [{ plateId: "jack", startMs: 31000, endMs: 46000, sortIndex: 0 }];
  const introFront = nextPlateHangWindow(jackHeld, { durationSec: 30, singing: false });
  assert.equal(introFront.startMs, 0, "30s intro sits at 0 — does not push Jack");
  assert.equal(introFront.endMs, 30000);
  assert.equal(jackHeld[0]?.startMs, 31000);

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
  assert.equal(resized?.[1].startMs, 15000, "other plate keeps 0:15 — song does not slide");
  assert.equal(resized?.[1].endMs, 30000);
  assert.equal(withPlateDuration([], "missing", 8000, 180000), null);
  const minted = ensurePlateDuration([], "fresh", 10000, 180000);
  assert.equal(minted?.[0].plateId, "fresh");
  assert.equal(minted?.[0].startMs, 0);
  assert.equal(minted?.[0].endMs, 10000, "unhung slider writes a 10s bar, not 15");
  const afterMint = ensurePlateDuration(minted, "fresh", 40000, 180000);
  assert.equal(afterMint?.[0].endMs, 40000, "slider can stretch that bar to 40");
  const afterLast = ensurePlateDuration(
    [{ plateId: "a", startMs: 0, endMs: 15000, sortIndex: 0 }],
    "b",
    10000,
    180000,
  );
  assert.equal(afterLast?.[1].plateId, "b");
  assert.equal(afterLast?.[1].startMs, 15000);
  assert.equal(afterLast?.[1].endMs, 25000);

  const muteLand = applyLandedClipDuration(
    {
      fileName: "song.mp3",
      durationSec: 180,
      sliceStartSec: 0,
      sliceDurationSec: 15,
      plateTimings: [{ plateId: "intro", startMs: 0, endMs: 30000, sortIndex: 0 }],
      cuts: [
        {
          id: "mute1",
          shotId: "road",
          plateFile: "road.png",
          startSec: 0,
          durationSec: 0,
          clipFile: "04_Road.mp4",
          status: "done",
        },
      ],
    },
    { cutId: "mute1", durationSec: 8 },
  );
  assert.equal(
    muteLand.plateTimings.find((t) => t.plateId === "road")?.startMs,
    30000,
    "No lips cook with no hang gets a clock after intro",
  );
  assert.equal(muteLand.plateTimings.find((t) => t.plateId === "road")?.endMs, 38000);
  assert.equal(muteLand.plateTimings[0]?.startMs, 0, "intro stays");
  assert.equal(muteLand.plateTimings[0]?.endMs, 30000, "intro is not shoved");
  assert.equal(muteLand.cuts.find((c) => c.id === "mute1")?.startSec, 30);
  assert.equal(muteLand.cuts.find((c) => c.id === "mute1")?.durationSec, 8);
  const keepJack = applyLandedClipDuration(
    {
      fileName: "song.mp3",
      durationSec: 180,
      sliceStartSec: 0,
      sliceDurationSec: 15,
      plateTimings: [
        { plateId: "intro", startMs: 0, endMs: 30000, sortIndex: 0 },
        { plateId: "jack", startMs: 31000, endMs: 46000, sortIndex: 1 },
      ],
      cuts: [
        {
          id: "j1",
          shotId: "jack",
          plateFile: "j.png",
          startSec: 31,
          durationSec: 15,
          clipFile: "03_Jack.mp4",
          status: "done",
        },
      ],
    },
    { cutId: "j1", durationSec: 8 },
  );
  assert.equal(keepJack.plateTimings.find((t) => t.plateId === "jack")?.startMs, 31000);
  assert.equal(keepJack.plateTimings.find((t) => t.plateId === "jack")?.endMs, 39000);
  assert.equal(
    keepJack.plateTimings.find((t) => t.plateId === "intro")?.endMs,
    30000,
    "landing a clip must not restamp intro",
  );

  const sevenBar = withPlateDuration(
    [{ plateId: "a", startMs: 0, endMs: 15000, sortIndex: 0 }],
    "a",
    7000,
    180000,
  );
  assert.equal(sevenBar?.[0].endMs, 7000);
  const nineBar = withPlateDuration(
    [{ plateId: "a", startMs: 0, endMs: 15000, sortIndex: 0 }],
    "a",
    9000,
    180000,
  );
  assert.equal(nineBar?.[0].endMs, 9000);

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
  assert.equal(five?.[1].startMs, 15000, "other plate keeps its song time");
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
  assert.equal(hangClipDurationMs(5, 15), 5000, "5s file wins over 15s cook window");
  assert.equal(hangClipDurationMs(15, 5), 5000, "order does not invent 15");

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

  const jackOnSilver = hangMissingPlateTimings(
    [{ plateId: "jack", startMs: 31000, endMs: 46000, sortIndex: 0 }],
    [{ shotId: "intro", startSec: 0, durationSec: 30 }],
  );
  assert.equal(jackOnSilver.find((t) => t.plateId === "jack")?.startMs, 31000, "Jack stays 0:31");
  assert.equal(jackOnSilver.find((t) => t.plateId === "intro")?.startMs, 0, "intro sits on the front");
  assert.equal(jackOnSilver.find((t) => t.plateId === "intro")?.endMs, 30000);

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
  assert.equal(
    extraStillHangPlateId("plate-9", twoTakes?.plateTimings),
    "plate-9~still2",
  );
  assert.equal(
    extraStillHangPlateId("plate-9", [
      ...(twoTakes?.plateTimings || []),
      { plateId: "plate-9~still2" },
    ]),
    "plate-9~still3",
  );
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

  /** Same still, new Position cook stacked on the clip row. Plate-row Add. */
  const stackedRecook = addPlateFileFirstHang({
    shotId: "jack3",
    plateFile: "jack.png",
    plateTimings: hungBars,
    cuts: waitingCuts,
    clips: [
      {
        shotId: "jack3",
        clipFile: "04_Jack_stand.mp4",
        priorClipFiles: ["03_Jack_5.mp4"],
        clipStatus: "done",
        durationSec: 8,
      },
    ],
    newCutId: () => "cut-stacked",
  });
  assert.equal(stackedRecook.hung, true, "Add hangs the leftover Position cook");
  assert.equal(stackedRecook.plateTimings.length, 4);
  assert.equal(stackedRecook.plateTimings[3]?.startMs, 25000, "after last hung bar");
  assert.equal(stackedRecook.plateTimings[3]?.endMs, 33000, "real mp4 length");
  assert.equal(tallyPending(stackedRecook.cuts).parked, 3, "no new WAITING job");

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

  const leftoverAtLyric = addPlateFileFirstHang({
    shotId: "jack",
    plateFile: "jack.png",
    plateTimings: [{ plateId: "intro", startMs: 0, endMs: 30000, sortIndex: 0 }],
    cuts: [
      {
        id: "intro1",
        shotId: "intro",
        plateFile: "car.png",
        startSec: 0,
        durationSec: 30,
        clipFile: "01_Intro.mp4",
        status: "done",
      },
    ],
    clips: [
      { shotId: "intro", clipFile: "01_Intro.mp4", clipStatus: "done", durationSec: 30 },
      { shotId: "jack", clipFile: "03_Jack.mp4", clipStatus: "done", durationSec: 8 },
    ],
    singing: true,
    lyricCues: [
      { lineIndex: 0, atMs: 31000 },
      { lineIndex: 1, atMs: 81000 },
    ],
    newCutId: () => "cut-silver",
  });
  assert.equal(leftoverAtLyric.hung, true);
  assert.equal(leftoverAtLyric.plateTimings[0]?.startMs, 0, "intro 0:00–0:30 stays");
  assert.equal(leftoverAtLyric.plateTimings[0]?.endMs, 30000);
  assert.equal(leftoverAtLyric.plateTimings[1]?.plateId, "jack");
  assert.equal(leftoverAtLyric.plateTimings[1]?.startMs, 31000, "singing leftover at Silver 0:31, not after 0:30");
  assert.equal(leftoverAtLyric.plateTimings[1]?.endMs, 39000, "8s file length — not a 15s invent");
  assert.equal(leftoverAtLyric.cuts.find((c) => c.clipFile === "03_Jack.mp4")?.startSec, 31);

  function tallyPending(cuts) {
    const tally = { parked: 0, done: 0 };
    for (const c of cuts) {
      if (c.status === "done") tally.done += 1;
      else if (c.status !== "running" && c.status !== "error") tally.parked += 1;
    }
    return tally;
  }
  const again = hangOneClipOnWave({
    plateTimings: twoTakes?.plateTimings,
    cuts: twoTakes?.cuts || [],
    shotId: "plate-9",
    plateFile: "9.png",
    clipFile: "09_dzd.mp4",
    durationSec: 8,
    newCutId: () => "c-dup",
  });
  assert.equal(again?.plateTimings.length, 2, "already hung — no second bar");

  const sameTailA = "ab_JackGhostTake.mp4";
  const sameTailB = "cd_JackGhostTake.mp4";
  assert.notEqual(
    extraTakeHangPlateId("jack4", sameTailA),
    extraTakeHangPlateId("jack4", sameTailB),
    "01_/ab_ vs 02_/cd_ Title must not share a hang slot",
  );
  const clashA = "01_JACK_GHOST_ETHING.mp4";
  const clashB = "01_JACK_XXXXXX_ETHING.mp4";
  assert.equal(
    extraTakeHangPlateId("jack4", clashA),
    extraTakeHangPlateId("jack4", clashB),
    "same lead+tail still collides — mint must fire",
  );
  const tailClash = hangOneClipOnWave({
    plateTimings: [
      { plateId: "jack4", startMs: 20000, endMs: 25000, sortIndex: 0 },
      { plateId: extraTakeHangPlateId("jack4", clashA), startMs: 25000, endMs: 30000, sortIndex: 1 },
    ],
    cuts: [
      {
        id: "c4",
        shotId: "jack4",
        plateFile: "4.png",
        startSec: 20,
        durationSec: 5,
        clipFile: "04_Jack.mp4",
        status: "done",
      },
      {
        id: "c5",
        shotId: extraTakeHangPlateId("jack4", clashA),
        plateFile: "4.png",
        startSec: 25,
        durationSec: 5,
        clipFile: clashA,
        status: "done",
      },
    ],
    shotId: "jack4",
    plateFile: "4.png",
    clipFile: clashB,
    durationSec: 21,
    newCutId: () => "c6",
  });
  assert.equal(tailClash?.cuts.find((c) => c.clipFile === clashA)?.clipFile, clashA);
  assert.ok(tailClash?.cuts.some((c) => c.clipFile === clashB), "new file gets its own cut");
  assert.equal(tailClash?.plateTimings.length, 3, "colliding tail mints a free bar — not a no-op");
  assert.notEqual(
    tailClash?.plateTimings[1]?.plateId,
    tailClash?.plateTimings[2]?.plateId,
    "do not reuse clip 2 / clip 5's plateId",
  );

  // Stuie: unhang all, hang three 30s JACK GHOST takes, retime clip 2,
  // hang the 4th — clip 2's clock and file stay. Last-12 only used to
  // stamp 04_ onto clip 2's slot (01_/02_/03_/04_ Title → VESOMETHING).
  {
    const jack = "shot_jack_ghost";
    const files = [
      "01_JACK_GHOST_GIVE_ME_SOMETHING.mp4",
      "02_JACK_GHOST_GIVE_ME_SOMETHING.mp4",
      "03_JACK_GHOST_GIVE_ME_SOMETHING.mp4",
      "04_JACK_GHOST_GIVE_ME_SOMETHING.mp4",
    ];
    assert.notEqual(extraTakeHangPlateId(jack, files[0]), extraTakeHangPlateId(jack, files[1]));
    assert.notEqual(extraTakeHangPlateId(jack, files[1]), extraTakeHangPlateId(jack, files[2]));
    assert.notEqual(extraTakeHangPlateId(jack, files[2]), extraTakeHangPlateId(jack, files[3]));
    const clips = files.map((clipFile) => ({
      shotId: jack,
      clipFile,
      clipStatus: "done",
      durationSec: 30,
    }));
    const leftoverCuts = files.map((clipFile, i) => ({
      id: `left_${i + 1}`,
      shotId: jack,
      plateFile: "jack.png",
      startSec: i * 30,
      durationSec: 30,
      clipFile,
      status: "done",
      error: "",
    }));
    let ids = 0;
    const newCutId = () => `ghost_${++ids}`;
    let plateTimings = [];
    let cuts = leftoverCuts;
    for (let i = 0; i < 3; i++) {
      const hung = hangOneClipOnWave({
        plateTimings,
        cuts,
        shotId: jack,
        plateFile: "jack.png",
        clipFile: files[i],
        durationSec: 30,
        newCutId,
      });
      assert.ok(hung, `hang clip ${i + 1}`);
      plateTimings = hung.plateTimings;
      cuts = hung.cuts;
    }
    assert.equal(plateTimings.length, 3, "three 30s bars after hang 1–3");
    const clip2Id = plateTimings[1]?.plateId;
    assert.ok(clip2Id);
    assert.equal(
      cuts.find((c) => (c.shotId || "").trim() === clip2Id)?.clipFile,
      files[1],
      "clip 2 is 02_",
    );
    const retimed = withPlateWindow(plateTimings, clip2Id, 30000, 18000, 327000);
    assert.ok(retimed, "retime clip 2 to 18s — Stuie's tell");
    plateTimings = retimed;
    assert.equal(plateTimings.find((t) => t.plateId === clip2Id)?.startMs, 30000);
    assert.equal(plateTimings.find((t) => t.plateId === clip2Id)?.endMs, 48000);

    const hang4 = hangOneClipOnWave({
      plateTimings,
      cuts,
      shotId: jack,
      plateFile: "jack.png",
      clipFile: files[3],
      durationSec: 30,
      newCutId,
    });
    assert.equal(hang4?.plateTimings.length, 4, "hang 4 is a new bar");
    assert.equal(
      hang4?.plateTimings.find((t) => t.plateId === clip2Id)?.startMs,
      30000,
      "hang 4 must not move clip 2's start",
    );
    assert.equal(
      hang4?.plateTimings.find((t) => t.plateId === clip2Id)?.endMs,
      48000,
      "hang 4 must not reset clip 2's 18s clock",
    );
    assert.equal(
      hang4?.cuts.find((c) => (c.shotId || "").trim() === clip2Id)?.clipFile,
      files[1],
      "clip 2 keeps 02_",
    );
    assert.ok(
      hang4?.cuts.some((c) => c.clipFile === files[3]),
      "04_ gets its own cut",
    );
    assert.equal(
      new Set((hang4?.plateTimings || []).map((t) => t.plateId)).size,
      4,
      "four unique hang ids — hang 4 must not reuse clip 2",
    );

    const add4 = applyAddPlateOnSong({
      shotId: jack,
      plateFile: "jack.png",
      plateTimings,
      cuts,
      clips,
      songSec: 327,
      newCutId,
    });
    assert.equal(add4.hung, true, "Add hangs leftover 04_");
    assert.equal(add4.plateTimings.length, 4, "Add 4th is a new bar");
    assert.equal(
      add4.plateTimings.find((t) => t.plateId === clip2Id)?.endMs,
      48000,
      "Add 4th must not reset clip 2's 18s clock",
    );
    assert.equal(
      add4.cuts.find((c) => (c.shotId || "").trim() === clip2Id)?.clipFile,
      files[1],
      "Add 4th leaves 02_ on clip 2",
    );
    assert.ok(add4.cuts.some((c) => c.clipFile === files[3]));
    assert.equal(new Set(add4.plateTimings.map((t) => t.plateId)).size, 4);

    let wave = { plateTimings: hang4.plateTimings, cuts: hang4.cuts };
    for (const t of [...wave.plateTimings].reverse()) {
      const off = removePlateFromSong({
        plateId: t.plateId,
        plateTimings: wave.plateTimings,
        cuts: wave.cuts,
        jobShots: [{ shotId: jack, plateFile: "jack.png" }],
      });
      wave = { plateTimings: off.plateTimings, cuts: off.cuts };
    }
    assert.equal(wave.plateTimings.length, 0, "Off song all four");
    plateTimings = [];
    cuts = leftoverCuts;
    for (let i = 0; i < 3; i++) {
      const hung = hangOneClipOnWave({
        plateTimings,
        cuts,
        shotId: jack,
        plateFile: "jack.png",
        clipFile: files[i],
        durationSec: 30,
        newCutId,
      });
      plateTimings = hung.plateTimings;
      cuts = hung.cuts;
    }
    const clip2Again = plateTimings[1]?.plateId;
    const moved = withPlateWindow(plateTimings, clip2Again, 30000, 18000, 327000);
    plateTimings = moved;
    const addAfterClear = applyAddPlateOnSong({
      shotId: jack,
      plateFile: "jack.png",
      plateTimings,
      cuts,
      clips,
      songSec: 327,
      newCutId,
    });
    assert.equal(addAfterClear.plateTimings.length, 4, "unhang + hang 3 + Add 4th");
    assert.equal(
      addAfterClear.plateTimings.find((t) => t.plateId === clip2Again)?.endMs,
      48000,
      "Add after unhang must not stamp clip 2",
    );
    assert.equal(new Set(addAfterClear.plateTimings.map((t) => t.plateId)).size, 4);
  }

  const jackGhost = hangOneClipOnWave({
    plateTimings: [
      { plateId: "jack1", startMs: 0, endMs: 15000, sortIndex: 0 },
      { plateId: "car", startMs: 15000, endMs: 20000, sortIndex: 1 },
      { plateId: "jack3", startMs: 20000, endMs: 25000, sortIndex: 2 },
    ],
    cuts: [
      {
        id: "c1",
        shotId: "jack1",
        plateFile: "1.png",
        startSec: 0,
        durationSec: 15,
        clipFile: "clip1.mp4",
        status: "done",
      },
      {
        id: "c2",
        shotId: "car",
        plateFile: "2.png",
        startSec: 15,
        durationSec: 5,
        clipFile: "clip2.mp4",
        status: "done",
      },
      {
        id: "c3",
        shotId: "jack3",
        plateFile: "3.png",
        startSec: 20,
        durationSec: 5,
        clipFile: "clip3.mp4",
        status: "done",
      },
    ],
    shotId: "jack3",
    plateFile: "3.png",
    clipFile: "clip4.mp4",
    durationSec: 5,
    newCutId: () => "c4",
  });
  assert.equal(jackGhost?.plateTimings.length, 4, "extra take is a 4th bar");
  assert.equal(jackGhost?.plateTimings[2]?.startMs, 20000, "3rd bar stays 0:20");
  assert.equal(jackGhost?.plateTimings[2]?.endMs, 25000);
  assert.equal(jackGhost?.plateTimings[3]?.startMs, 25000, "clip 4 after last hung end — not another 0:20");
  assert.equal(jackGhost?.plateTimings[3]?.endMs, 30000, "real 5s, not a fake 15");
  assert.equal(jackGhost?.cuts.length, 4, "do not delete clip 3");
  assert.deepEqual(listUnhungDoneClips({
    clips: [
      { shotId: "jack3", clipFile: "clip4.mp4", priorClipFiles: ["clip3.mp4"], clipStatus: "done", durationSec: 5 },
    ],
    cuts: [
      { shotId: "jack3", clipFile: "clip3.mp4", status: "done", durationSec: 5 },
    ],
    plateTimings: [
      { plateId: "jack3", startMs: 20000, endMs: 25000, sortIndex: 2 },
    ],
  }).map((r) => r.clipFile), ["clip4.mp4"]);
  const autoHung = hangUnhungDoneClips({
    plateTimings: [
      { plateId: "jack1", startMs: 0, endMs: 15000, sortIndex: 0 },
      { plateId: "car", startMs: 15000, endMs: 20000, sortIndex: 1 },
      { plateId: "jack3", startMs: 20000, endMs: 25000, sortIndex: 2 },
    ],
    cuts: [
      {
        id: "c3",
        shotId: "jack3",
        plateFile: "3.png",
        startSec: 20,
        durationSec: 5,
        clipFile: "clip3.mp4",
        status: "done",
      },
    ],
    clips: [
      {
        shotId: "jack3",
        clipFile: "clip4.mp4",
        priorClipFiles: ["clip3.mp4"],
        clipStatus: "done",
        durationSec: 5,
      },
    ],
    plateFileFor: () => "3.png",
    newCutId: () => "c4",
  });
  assert.equal(autoHung.plateTimings.at(-1)?.startMs, 25000, "auto-place extra take after 0:25");
  assert.equal(autoHung.plateTimings.at(-1)?.endMs, 30000);

  /** Screenshots: TRACK 3 bars, CLIPS 4, clip 3 + clip 4 both stamped 0:20. */
  const stuiesThreeBars = [
    { plateId: "jack1", startMs: 0, endMs: 15000, sortIndex: 0 },
    { plateId: "car", startMs: 15000, endMs: 20000, sortIndex: 1 },
    { plateId: "jack", startMs: 20000, endMs: 25000, sortIndex: 2 },
  ];
  const stuiesCutsClip3Hung = [
    {
      id: "c1",
      shotId: "jack1",
      plateFile: "1.png",
      startSec: 0,
      durationSec: 15,
      clipFile: "01_jack.mp4",
      status: "done",
    },
    {
      id: "c2",
      shotId: "car",
      plateFile: "2.png",
      startSec: 15,
      durationSec: 5,
      clipFile: "02_car.mp4",
      status: "done",
    },
    {
      id: "c3",
      shotId: "jack",
      plateFile: "3.png",
      startSec: 20,
      durationSec: 5,
      clipFile: "03_stand.mp4",
      status: "done",
    },
  ];
  const stuiesFourClips = [
    { shotId: "jack1", clipFile: "01_jack.mp4", clipStatus: "done", durationSec: 15 },
    { shotId: "car", clipFile: "02_car.mp4", clipStatus: "done", durationSec: 5 },
    { shotId: "jack", clipFile: "03_stand.mp4", clipStatus: "done", durationSec: 5 },
    { shotId: "jack", clipFile: "04_crouch.mp4", clipStatus: "done", durationSec: 5 },
  ];
  assert.deepEqual(
    listUnhungDoneClips({
      clips: stuiesFourClips,
      cuts: stuiesCutsClip3Hung,
      plateTimings: stuiesThreeBars,
    }).map((r) => r.clipFile),
    ["04_crouch.mp4"],
    "clip 3 is the 3rd bar — leftover is clip 4",
  );
  const hangClip4 = hangUnhungDoneClips({
    plateTimings: stuiesThreeBars,
    cuts: stuiesCutsClip3Hung,
    clips: stuiesFourClips,
    plateFileFor: (id) => (id === "car" ? "2.png" : id === "jack1" ? "1.png" : "3.png"),
    newCutId: () => "c4",
  });
  assert.deepEqual(
    hangClip4.plateTimings.slice(0, 3).map((t) => [t.plateId, t.startMs, t.endMs]),
    [
      ["jack1", 0, 15000],
      ["car", 15000, 20000],
      ["jack", 20000, 25000],
    ],
    "do not move or overwrite the three good bars",
  );
  assert.equal(hangClip4.plateTimings.length, 4);
  assert.equal(hangClip4.plateTimings[3]?.startMs, 25000, "clip 4 starts at 0:25");
  assert.equal(hangClip4.plateTimings[3]?.endMs, 30000, "clip 4 is 5s, not 15");
  assert.equal(hangClip4.cuts.find((c) => c.clipFile === "03_stand.mp4")?.shotId, "jack");
  assert.equal(
    hangClip4.cuts.find((c) => c.clipFile === "04_crouch.mp4")?.shotId,
    extraTakeHangPlateId("jack", "04_crouch.mp4"),
  );
  assert.equal(
    hangClip4.cuts.find((c) => c.clipFile === "02_car.mp4")?.shotId,
    "car",
    "leftover hang must not drop previous clip 2 (0:15 car)",
  );
  assert.equal(hangClip4.cuts.find((c) => c.clipFile === "02_car.mp4")?.startSec, 15);

  const siblings = cutFromPlateTiming(
    [
      {
        id: "c2",
        shotId: "car",
        plateFile: "2.png",
        startSec: 15,
        durationSec: 5,
        clipFile: "02_car.mp4",
        status: "done",
      },
      {
        id: "c2b",
        shotId: "car",
        plateFile: "2.png",
        startSec: 20,
        durationSec: 5,
        clipFile: "02b_other.mp4",
        status: "done",
      },
    ],
    { plateId: "car", startMs: 15000, endMs: 20000, sortIndex: 1 },
    "2.png",
    () => "n",
  );
  assert.ok(
    siblings.some((c) => c.clipFile === "02_car.mp4") &&
      siblings.some((c) => c.clipFile === "02b_other.mp4"),
    "cutFromPlateTiming must keep both done clipFiles on the same still",
  );

  const leftoverOntoCar = hangOneClipOnWave({
    plateTimings: [],
    cuts: [
      {
        id: "c2",
        shotId: "car",
        plateFile: "2.png",
        startSec: 15,
        durationSec: 5,
        clipFile: "02_car.mp4",
        status: "done",
      },
    ],
    shotId: "car",
    plateFile: "2.png",
    clipFile: "04_crouch.mp4",
    durationSec: 5,
    newCutId: () => "c4",
  });
  assert.ok(
    leftoverOntoCar?.cuts.some((c) => c.clipFile === "02_car.mp4"),
    "file-first hang must not replace another clip's file",
  );
  assert.ok(leftoverOntoCar?.cuts.some((c) => c.clipFile === "04_crouch.mp4"));

  const stuiesCutsClip4Hung = stuiesCutsClip3Hung.map((c) =>
    c.clipFile === "03_stand.mp4" ? { ...c, clipFile: "04_crouch.mp4" } : c,
  );
  assert.deepEqual(
    listUnhungDoneClips({
      clips: stuiesFourClips,
      cuts: stuiesCutsClip4Hung,
      plateTimings: stuiesThreeBars,
    }).map((r) => r.clipFile),
    ["03_stand.mp4"],
    "if clip 4 is the 3rd bar, leftover is clip 3",
  );
  const hangClip3 = hangUnhungDoneClips({
    plateTimings: stuiesThreeBars,
    cuts: stuiesCutsClip4Hung,
    clips: stuiesFourClips,
    plateFileFor: (id) => (id === "car" ? "2.png" : id === "jack1" ? "1.png" : "3.png"),
    newCutId: () => "c3b",
  });
  assert.equal(hangClip3.plateTimings[2]?.startMs, 20000);
  assert.equal(hangClip3.plateTimings[2]?.endMs, 25000);
  assert.equal(hangClip3.plateTimings[3]?.startMs, 25000, "clip 3 after 0:25 when clip 4 is the 3rd bar");
  assert.equal(hangClip3.plateTimings[3]?.endMs, 30000);
  assert.equal(hangClip3.cuts.find((c) => c.clipFile === "04_crouch.mp4")?.shotId, "jack");

  const xdCarLeftOff = {
    clips: [
      { shotId: "car", clipFile: "01_car.mp4", clipStatus: "done", durationSec: 5 },
      { shotId: "jack", clipFile: "02_jack.mp4", clipStatus: "done", durationSec: 5 },
      {
        shotId: "car",
        clipFile: "03_car_xd.mp4",
        priorClipFiles: ["01_car.mp4"],
        clipStatus: "done",
        durationSec: 15,
      },
    ],
    cuts: [
      { shotId: "car", clipFile: "01_car.mp4", status: "done", durationSec: 5 },
      { shotId: "jack", clipFile: "02_jack.mp4", status: "done", durationSec: 5 },
    ],
    plateTimings: [
      { plateId: "car", startMs: 0, endMs: 5000, sortIndex: 0 },
      { plateId: "jack", startMs: 5000, endMs: 10000, sortIndex: 1 },
    ],
  };
  assert.deepEqual(
    listUnhungDoneClips(xdCarLeftOff).map((r) => r.clipFile),
    ["03_car_xd.mp4"],
    "X'd leftover mp4 stays off the wave until he taps Add or Hang",
  );
  assert.equal(xdCarLeftOff.plateTimings.length, 2, "open must not invent a 15s end bar");

  const clip2FiveNotFifteen = hangUnhungDoneClips({
    plateTimings: [{ plateId: "jack1", startMs: 0, endMs: 15000, sortIndex: 0 }],
    cuts: [
      {
        id: "c2",
        shotId: "car",
        plateFile: "2.png",
        startSec: 15,
        durationSec: 15,
        clipFile: "02_car.mp4",
        status: "done",
      },
    ],
    clips: [
      { shotId: "car", clipFile: "02_car.mp4", clipStatus: "done", durationSec: 5 },
    ],
    plateFileFor: () => "2.png",
    newCutId: () => "c-car",
  });
  assert.equal(clip2FiveNotFifteen.plateTimings.length, 2, "explicit hang only — one new bar");
  assert.equal(clip2FiveNotFifteen.plateTimings[1]?.startMs, 15000, "next gap after 0:15");
  assert.equal(
    clip2FiveNotFifteen.plateTimings[1]?.endMs,
    20000,
    "clip 2 is the 5s car — do not invent a 15s end bar",
  );
  assert.equal(
    listUnhungDoneClips({
      clips: [{ shotId: "car", clipFile: "02_car.mp4", clipStatus: "done", durationSec: 5 }],
      cuts: [{ shotId: "car", clipFile: "02_car.mp4", status: "done", durationSec: 15, startSec: 15 }],
      plateTimings: [{ plateId: "jack1", startMs: 0, endMs: 15000, sortIndex: 0 }],
    })[0]?.durationSec,
    5,
    "listUnhungDoneClips keeps the 5s file, not the 15s window",
  );
  assert.deepEqual(
    listUnhungDoneClips({
      clips: [
        { shotId: "car", clipFile: "02_Car.mp4", clipStatus: "done", durationSec: 5 },
        { shotId: "jack3", clipFile: "04_Jack_stand.mp4", clipStatus: "done", durationSec: 8 },
      ],
      cuts: [
        { shotId: "car", clipFile: "02_Car.mp4", status: "done", durationSec: 5 },
      ],
      plateTimings: [
        { plateId: "car", startMs: 15000, endMs: 20000, sortIndex: 1 },
      ],
      skipShotIds: ["car~6ir"],
    }).map((r) => r.clipFile),
    ["04_Jack_stand.mp4"],
    "skip car~6ir must not hide leftover on another still",
  );
  const skipWholeCar = listUnhungDoneClips({
    clips: [{ shotId: "car", clipFile: "05_Car_take.mp4", clipStatus: "done", durationSec: 6 }],
    cuts: [],
    plateTimings: [],
    skipShotIds: ["car"],
  });
  assert.deepEqual(skipWholeCar.map((r) => r.clipFile), [], "skip car still skips the car still");
  assert.deepEqual(
    listUnhungDoneClips({
      clips: [{ shotId: "jack", clipFile: "01_Jack.mp4", clipStatus: "done", durationSec: 8 }],
      cuts: [],
      plateTimings: [],
      skipClipFiles: ["01_Jack.mp4"],
    }).map((r) => r.clipFile),
    [],
    "X'd mp4 stays off Add / Hang / hang-plates",
  );
  const skippedStill = addPlateFileFirstHang({
    shotId: "jack",
    plateFile: "jack.png",
    plateTimings: [],
    cuts: [],
    clips: [{ shotId: "jack", clipFile: "01_Jack.mp4", clipStatus: "done", durationSec: 8 }],
    skipClipFiles: ["01_Jack.mp4"],
    newCutId: () => "cut_skip",
  });
  assert.equal(skippedStill.hung, false, "X'd file does not file-first hang");

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

  {
    const jack = "shot_jack_ghost";
    const car = "shot_car";
    const jack2 = "shot_jack_ghost_2";
    const threeBars = [
      { plateId: jack, startMs: 0, endMs: 15000, sortIndex: 0 },
      { plateId: car, startMs: 15000, endMs: 20000, sortIndex: 1 },
      { plateId: jack2, startMs: 20000, endMs: 25000, sortIndex: 2 },
    ];
    const fourCuts = [
      { id: "c1", plateFile: "jack.png", shotId: jack, startSec: 0, durationSec: 15, clipFile: "clip1.mp4", status: "done" },
      { id: "c2", plateFile: "car.png", shotId: car, startSec: 15, durationSec: 5, clipFile: "clip2.mp4", status: "done" },
      { id: "c3", plateFile: "jack2.png", shotId: jack2, startSec: 20, durationSec: 5, clipFile: "clip3.mp4", status: "done" },
      { id: "c4", plateFile: "jack2.png", shotId: jack2, startSec: 20, durationSec: 5, clipFile: "clip4.mp4", status: "done" },
    ];
    const waitingCuts = [
      { id: "w1", plateFile: "jack2.png", shotId: jack2, startSec: 0, durationSec: 15, status: "pending" },
      { id: "w2", plateFile: "jack2.png", shotId: jack2, startSec: 15, durationSec: 15, status: "pending" },
      { id: "w3", plateFile: "jack2.png", shotId: jack2, startSec: 30, durationSec: 15, status: "pending" },
    ];
    const clips = [
      { shotId: jack, clipFile: "clip1.mp4", clipStatus: "done", durationSec: 15 },
      { shotId: car, clipFile: "clip2.mp4", clipStatus: "done", durationSec: 5 },
      {
        shotId: jack2,
        clipFile: "clip4.mp4",
        priorClipFiles: ["clip3.mp4"],
        clipStatus: "done",
        durationSec: 5,
      },
    ];
    const ids = { n: 0 };
    const plateFileFor = (id) =>
      id === car ? "car.png" : id === jack ? "jack.png" : "jack2.png";

    const stillsAdd = addPlateHangOnTrack({
      plateTimings: threeBars,
      cuts: [...fourCuts, ...waitingCuts],
      clips,
      shotId: jack2,
      hangCuts: waitingCuts,
      extraIds: [],
      plateFileFor,
      newCutId: () => `cut_${++ids.n}`,
    });
    const plateRowAdd = addPlateHangOnTrack({
      plateTimings: threeBars,
      cuts: [...fourCuts, ...waitingCuts],
      clips,
      shotId: jack2,
      hangCuts: waitingCuts,
      extraIds: [],
      plateFileFor,
      newCutId: () => `cut_${++ids.n}`,
    });
    for (const [label, hung] of [
      ["STILLS ADD", stillsAdd],
      ["plate-row Add", plateRowAdd],
    ]) {
      assert.equal(hung.plateTimings.length, 4, `${label} hangs the leftover take`);
      assert.deepEqual(
        hung.plateTimings.slice(0, 3).map((t) => [t.plateId, t.startMs, t.endMs]),
        [
          [jack, 0, 15000],
          [car, 15000, 20000],
          [jack2, 20000, 25000],
        ],
        `${label} leaves the three hung bars`,
      );
      assert.equal(hung.plateTimings[3].startMs, 25000, `${label} starts after 0:25`);
      assert.equal(hung.plateTimings[3].endMs, 30000, `${label} uses the 5s clip length`);
      assert.equal(
        hung.plateTimings[3].plateId,
        extraTakeHangPlateId(jack2, "clip4.mp4"),
        `${label} unique slot, not another 0:20`,
      );
    }

    const again = hangOneClipOnWave({
      plateTimings: stillsAdd.plateTimings,
      cuts: stillsAdd.cuts,
      shotId: jack2,
      plateFile: "jack2.png",
      clipFile: "clip4.mp4",
      durationSec: 5,
      newCutId: () => "nope",
    });
    assert.equal(again?.plateTimings.length, 4, "already-hung leftover is a no-op");
    assert.equal(
      hangUnhungDoneClips({
        plateTimings: stillsAdd.plateTimings,
        cuts: stillsAdd.cuts,
        clips,
        plateFileFor,
        newCutId: () => "nope",
        onlyShotId: jack2,
      }).plateTimings.length,
      4,
      "second Add does not invent another bar",
    );
  }

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
assert.match(songRoute, /applyAddPlateOnSong/, "both Add buttons hang leftover takes after the last bar");
assert.match(trackUi, /hangPlateShotId/, "extra take bars keep the still title");
assert.match(trackUi, /action: "add-plate"/, "already-hung Add still posts add-plate for leftover takes");
assert.match(
  readFileSync(join(here, "../src/app/api/crash/mobile/song/route.ts"), "utf8"),
  /action === "hang-plates"/,
);
assert.match(trackUi, /hang-plates/);
assert.match(
  trackUi,
  /async function hangStillsOnWave\([\s\S]*?action: "hang-plates"/,
  "Put stills / Hang is the only hang-plates POST",
);
assert.doesNotMatch(
  trackUi,
  /if \(!needsDoneClipHang\(song, job\.shots, job\.clips \|\| \[\]\)\) return;[\s\S]{0,500}action: "hang-plates"/,
  "TRACK / job open must not auto-hang leftover or X'd clips",
);
assert.match(trackUi, /remove-plate-timing/);
assert.match(trackUi, /dropPlateFromWave/);
assert.match(trackUi, /Off song/);
assert.match(trackUi, /Off the wave\. Clip stays/);
assert.doesNotMatch(songLib, /the route can park them/);
assert.match(trackRoute, /keepClipsAfterUnhang/);
assert.doesNotMatch(
  trackRoute.slice(trackRoute.indexOf('action === "remove-plate-timing"')),
  /parkMobileClipFile/,
  "Off song / TRACK X must not park the mp4",
);
assert.doesNotMatch(trackRoute, /parkMobileClipFile/);
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
  /lyricCues/,
  "Add singing hang reads lyric pins",
);
assert.match(trackUi, /singingHangForShot/, "TRACK Add knows No lips OFF");
assert.match(
  songRoute.slice(songRoute.indexOf('action === "add-plate"')),
  /applyAddPlateOnSong/,
  "Add keeps sibling clipFiles — no desk rebuild",
);
assert.match(
  songRoute.slice(songRoute.indexOf('action === "add-plate"')),
  /durationSec: body\.durationSec/,
  "add-plate writes the slider seconds onto plateTimings",
);
assert.doesNotMatch(
  songRoute.slice(songRoute.indexOf('action === "add-plate"')),
  /MINIMAX_H3_MAX_SEC|clampMinimaxH3HangSec|cookDurationFromHungBar/,
  "Add hang must not follow H3's 15s cook cap",
);
assert.match(trackUi, /durationSec: readHangLengthDraft/, "TRACK Add sends the slider seconds");
assert.match(trackUi, /needsDoneClipHang/);
assert.match(trackUi, /hungClipFileForPlate\(job, picked\.shotId\) \? null/);
assert.match(trackUi, /isRealPlateHang/);
assert.doesNotMatch(trackUi, /!compact \|\| Boolean\(onCreatePlate\)/);
assert.doesNotMatch(trackUi, /m-track-film-len">off</);
assert.match(trackLib, /lead && tail && lead !== compact/, "01_Title and 04_Title must not share last-12");
assert.match(trackLib, /occupiedByOther/, "mint when another file already owns that hang id");
assert.match(songRoute, /MOBILE_JOB_READ_MISS/);
assert.match(trackRoute, /MOBILE_JOB_READ_MISS/);
assert.match(MOBILE_JOB_READ_MISS, /don't tap Start directing/);
assert.match(songRoute, /action === "hang-clip"/);
assert.match(songRoute, /hangOneClipOnWave/);
assert.match(songRoute, /hangUnhungDoneClips/);
assert.match(songRoute, /alreadyHung/);
assert.match(
  songRoute.slice(songRoute.indexOf('action === "hang-plates"')),
  /hangUnhungDoneClips/,
  "hang-plates also places a second take after the last hung end",
);
assert.doesNotMatch(
  songRoute.slice(
    songRoute.indexOf('action === "hang-plates"'),
    songRoute.indexOf('action === "hang-clip"'),
  ),
  /clipFile: row\.clipFile/,
  "hang-plates must not overwrite another cut's clipFile",
);
assert.match(
  songLib,
  /alreadyHung/,
  "STILLS ADD alreadyHung lives on applyAddPlateOnSong — second bar after last end",
);
assert.match(trackUi, /hangIdForSend/, "Send uses the extra hang id, not the first still");
{
  const sendFn =
    trackUi.slice(
      trackUi.indexOf("async function sendPlate"),
      trackUi.indexOf("sendPlateRef.current = sendPlate"),
    ) || "";
  assert.doesNotMatch(
    sendFn,
    /hangStillsOnWave/,
    "Send must not hang every leftover mp4",
  );
  assert.match(sendFn, /addPlateToTimeline/, "Send hangs this still only");
  assert.doesNotMatch(
    sendFn,
    /await persistMotionFor/,
    "Send must not wait on beat-motion story write before LTX",
  );
  assert.match(sendFn, /motionBodyForSend/, "Send keeps the [ ] words on the LTX POST");
  assert.match(sendFn, /Starting the Send/, "Send starts LTX without Saving the motion box");
}

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
assert.match(scratchClip, /nextHumanClipName/, "new cook gets a free NN_ name — not doneCuts + 1");
assert.match(scratchClip, /hangOneClipOnWave/, "second cook appends a new hang");
assert.doesNotMatch(
  scratchClip,
  /planParkDeskClipTake/,
  "Send must not park clip 4 so the new take can steal 05_",
);
assert.doesNotMatch(
  scratchClip,
  /doneCuts \+ 1/,
  "doneCuts + 1 reused 05_ and overwrote clip 5",
);
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
assert.match(editor, /durationSec: readHangLengthDraft/, "plate-row Add sends the slider seconds");
const mobileUi = readFileSync(join(here, "../src/components/mobile/MobileUi.tsx"), "utf8");
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
assert.match(panels, /MINIMAX_H3_CAMERAS/, "hole lists official H3 camera chips");
assert.match(panels, /m-plate-h3-last/, "hole has last-frame thumbs");
assert.match(panels, /MINIMAX_H3_RESOLUTIONS/, "hole has 768P/2K");
assert.match(editor, /collectMinimaxH3LastStills/, "plate editor collects last stills");
assert.match(editor, /h3LastStills/, "last stills reach the hole");
assert.doesNotMatch(trackUi, /MINIMAX_H3_CAMERAS/, "camera chips are not on TRACK");
assert.doesNotMatch(trackUi, /m-plate-h3-last/, "last-frame picker is not on TRACK");
assert.match(trackUi, /endPlateFile/, "H3 Send posts last frame");
assert.match(trackUi, /h3Camera/, "H3 Send posts camera");
assert.match(trackUi, /resolution: readMvH3Resolution/, "H3 Send posts 768P/2K");
assert.match(
  readFileSync(join(here, "../src/app/api/crash/mobile/song/route.ts"), "utf8"),
  /endPlateFile: String\(body\.endPlateFile/,
);
assert.match(
  readFileSync(join(here, "../src/app/api/crash/mobile/song/route.ts"), "utf8"),
  /h3Camera/,
);
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
assert.match(editor, /onClick=\{onAddToSong\}/, "plate-row Add next to LTX is onAddToSong");
assert.match(editor, />\s*LTX\s*</, "LTX is a real button next to Add");
assert.match(editor, />\s*H3\s*</, "H3 is a real button next to Add");
assert.match(editor, /busy \? label\?\.trim\(\) \|\| "Sending…" : "Send"/, "Send is on the same row as Add / LTX / H3");
assert.match(editor, /onSendStill/, "plate Send uses the one TRACK cook");
assert.match(editor, /Sending…/, "plate Send falls back to Sending until a step lands");
assert.match(editor, /sendStillNote/, "plate card can show a cook line under Send");
assert.match(editor, /sendStillLabel/, "plate Send button shows the live step");
assert.match(
  editor,
  /sendStillBusy \? "m-song-cook-note" : "m-track-err"/,
  "cook line is lime while Sending, pink if it failed",
);
assert.match(trackUi, /onSendStillNote/, "TRACK paints the plate cook line");
assert.match(trackUi, /onSendStillLabel/, "TRACK paints the Send button step");
assert.match(trackUi, /formatScratchCookNote/, "Send paints LTX/H3 steps, not Still going");
assert.match(trackUi, /watchPlateCook/, "Send polls the job while the LTX POST is open");
assert.match(trackUi, /refreshMobileJob/, "Send reads scratchCook off the job");
assert.doesNotMatch(trackUi, /Cooking\. Still going\./, "no more silent still-going tick");
assert.doesNotMatch(
  trackUi,
  /Cooking — mouths shut\. Still going\./,
  "No lips Send uses the same live step + clock",
);
assert.match(trackUi, /paintPlateSend/, "Send writes the plate line, not only TRACK setNote");
assert.match(
  tree,
  /onSendStillNote=\{setSendStillNote\}/,
  "tree passes the cook line to the open plate",
);
assert.match(
  tree,
  /onSendStillLabel=\{setSendStillLabel\}/,
  "tree passes the Send-button step to the open plate",
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
assert.match(editor, /tone=\{muteOn \? "accent" : "danger"\}/, "No lips off is red");
assert.match(mobileUi, /tone\?: "accent" \| "ghost" \| "danger"/, "primary button has danger tone");
assert.match(mobileUi, /--magenta-hot/, "danger tone uses the existing hot token");
assert.match(editor, /writeMvMuteAction/, "No lips stores mute for the next Send");
assert.match(editor, /mute=\{Boolean\(muteOn\)\}/, "hole mute flag follows No lips");
assert.match(editor, /singingBody=\{motionBody\}/, "No lips off shows the singing stack");
assert.match(panels, /data-mute=\{mute \? "yes" : "no"\}/, "hole marks mute on/off");
assert.match(panels, /mute \? \(/, "mute tail only when No lips is on");
assert.match(trackUi, /if \(muteOn\)/, "mute lock compose only when No lips or empty frame");
assert.match(trackUi, /buildScratchSongLtxMotion/, "Send persist writes singing when No lips is off");
assert.match(trackUi, /imageMotionLooksMuteLock/, "persist drops a stored mute lock when singing");
assert.match(editor, /muteMvEmptyFrame/, "plate lock drops the singer when nobody is in the still");
assert.match(editor, /writeMvNobodyInShot/, "Nobody next to HERO/SUPPORT");
assert.match(
  editor,
  /function EmptyMvMotionHole/,
  "empty + Nobody still mounts the [ ] hole — no spoken beat required",
);
assert.match(
  editor,
  /styleId === "music_video" && muteAction/,
  "empty-plate mute hole only when No lips is on",
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
assert.match(songRoute, /writeScratchCookProgress/, "song run writes the live Send step");
assert.match(songRoute, /imageMotion: String\(body.imageMotion/, "song run takes motion from the phone");
assert.match(scratchClip, /onProgress:/, "LTX Send keeps the Crash Lab steps");
assert.match(scratchClip, /writeScratchCookProgress/, "LTX steps land on the job");
assert.match(scratchClip, /Getting the still/, "Send writes before Blob resolve");
assert.match(scratchClip, /Making the silent length/, "No lips writes before the silent mp3");
assert.match(scratchClip, /Finding LTX/, "Send writes before Comfy probe");
assert.match(
  readFileSync(join(here, "../src/lib/songCutCook.ts"), "utf8"),
  /cache: "no-store"/,
  "Send poll must not reuse a cached job GET",
);
assert.match(
  readFileSync(join(here, "../src/app/api/crash/mobile/job/[id]/route.ts"), "utf8"),
  /Cache-Control": "no-store"/,
  "job GET must not cache scratchCook",
);
assert.match(park, /skipClipFiles/, "X'd mp4 names stay on the song skip list");
assert.doesNotMatch(
  readFileSync(join(here, "../src/lib/scratchCookProgress.ts"), "utf8"),
  /mobileGenJob/,
  "phone cook words must not import Node job IO",
);
assert.match(scratchClip, /step: "error"/, "LTX fail writes the real error on the job");

{
  const startedAt = "2026-08-29T02:00:00.000Z";
  const cook = parseScratchCook({
    engine: "ltx",
    step: "running",
    mute: true,
    startedAt,
    updatedAt: startedAt,
  });
  assert.ok(cook);
  assert.equal(humanScratchCookLine(cook), "LTX cooking — mouths shut");
  assert.equal(
    formatScratchCookNote(cook, { nowMs: Date.parse(startedAt) + 45_000 }),
    "LTX cooking — mouths shut · 0:45",
  );
  assert.equal(
    scratchCookButtonLabel(cook, true, { nowMs: Date.parse(startedAt) + 45_000 }),
    "0:45",
  );
  assert.equal(
    formatScratchCookNote(null, {
      engine: "ltx",
      mute: true,
      startedMs: Date.parse(startedAt),
      nowMs: Date.parse(startedAt) + 3_000,
    }),
    "Sending to LTX — mouths shut · 0:03",
  );
  assert.equal(
    formatScratchCookNote(null, {
      engine: "ltx",
      mute: true,
      startedMs: Date.parse(startedAt),
      nowMs: Date.parse(startedAt) + 12_000,
    }),
    "Starting the Send — mouths shut · 0:12",
  );
  assert.equal(
    formatScratchCookNote(null, {
      engine: "ltx",
      mute: true,
      posted: true,
      cutRunning: true,
      startedMs: Date.parse(startedAt),
      nowMs: Date.parse(startedAt) + 12_000,
    }),
    "Studio has the Send. Waiting for a step — mouths shut · 0:12",
  );
  assert.equal(
    formatScratchCookNote(null, {
      engine: "ltx",
      mute: true,
      posted: true,
      cutRunning: false,
      startedMs: Date.parse(startedAt),
      nowMs: Date.parse(startedAt) + 20_000,
    }),
    "Send has not reached LTX yet — mouths shut · 0:20",
  );
  assert.equal(
    humanScratchCookLine({
      engine: "ltx",
      step: "sending",
      message: "Getting the still",
      mute: true,
      startedAt,
      updatedAt: startedAt,
    }),
    "Getting the still — mouths shut",
  );
  assert.equal(
    scratchCookShouldWrite(
      {
        engine: "ltx",
        step: "sending",
        startedAt,
        updatedAt: startedAt,
      },
      { step: "sending", message: "Getting the still" },
    ),
    true,
    "same sending step with a new line must write",
  );
  assert.equal(
    scratchCookShouldWrite(
      {
        engine: "ltx",
        step: "sending",
        message: "Getting the still",
        startedAt,
        updatedAt: startedAt,
      },
      { step: "sending", message: "Getting the still" },
    ),
    false,
    "same sending line must not hammer Neon",
  );
  assert.equal(formatCookClock(62), "1:02");
  assert.equal(h3PhaseToCookStep("queueing"), "queued");
  assert.equal(h3PhaseToCookStep("processing"), "running");
  assert.equal(
    formatScratchCookNote({
      engine: "ltx",
      step: "error",
      message: "COMFY_CLOUD_API_KEY missing — set it in your environment variables",
      startedAt,
      updatedAt: startedAt,
    }),
    "COMFY_CLOUD_API_KEY missing — set it in your environment variables",
  );
  assert.equal(scratchCookButtonLabel({ engine: "h3", step: "queued", startedAt, updatedAt: startedAt }, true), "Queued…");
}
assert.match(
  readFileSync(join(here, "../src/lib/mobileImageMotion.ts"), "utf8"),
  /readMvMuteAction/,
);
console.log("check-music-video-track h3 capabilities: ok");
