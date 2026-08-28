/** Run: npx tsx scripts/check-music-video-track.mjs */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  evenPlateTimings,
  formatTrackClock,
  formatTrackClockPrecise,
  hangMissingPlateTimings,
  nextPlateHangWindow,
  swapNeighborPlateTimings,
  withPlateDuration,
  withPlateWindow,
  msToSec,
  orderedDoneCutsForStitch,
  plateRailBox,
  secToMs,
  sliceBoundsForPlate,
  sortPlateTimings,
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
assert.match(trackUi, /How long/);
assert.match(trackUi, /Starts at/);
assert.match(trackUi, /startSec/);
assert.doesNotMatch(trackUi, /Send all/);
assert.match(trackUi, /"Send"/);
assert.match(trackUi, /Park this clip/);
assert.match(trackUi, /requestSongCookStop/);
assert.match(trackUi, /m-track-film/);
assert.doesNotMatch(trackUi, /Use range/);
assert.doesNotMatch(trackUi, />Earlier</);
assert.doesNotMatch(trackUi, />Later</);
assert.doesNotMatch(trackUi, /Hang stills on the wave/);
assert.doesNotMatch(trackUi, /Plates on the track/);
assert.doesNotMatch(trackUi, /!compact && picked/);
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

// Drag-to-stretch on the coloured bars is gone. Add a still to the timeline.
assert.doesNotMatch(trackUi, /stretchPlateEdge/);
assert.doesNotMatch(trackUi, /onStretchCommit/);
assert.doesNotMatch(trackUi, /Drag a coloured box edge/);
assert.doesNotMatch(trackUi, /Pictures stay put/);
assert.doesNotMatch(mobileCss, /\.m-track-stretch-hint/);
assert.doesNotMatch(trackRoute, /set-plate-timings/);

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
  assert.equal(hung[1].startMs, 15000);
  assert.equal(hung[1].endMs, 30000);

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
assert.match(songRoute, /hangCuts/);
assert.match(
  songRoute,
  /leftover job\.shots/,
  "hang-plates must not take every leftover shot row",
);

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
const prompts = readFileSync(join(here, "../src/components/mobile/ShotPromptPanels.tsx"), "utf8");
const thumbs = readFileSync(join(here, "../src/components/mobile/PlateClipThumbs.tsx"), "utf8");
assert.doesNotMatch(trackUi, /m-track-engines/, "engines do not sit on TRACK How long / Starts at / Send");
assert.doesNotMatch(trackUi, />\s*Siray\s*</, "Siray is not on the TRACK pick");
assert.doesNotMatch(trackUi, />\s*Free\s*</, "Free is not on the TRACK pick");
assert.match(prompts, /MuteMvEnginePanel/, "LTX / H3 sit on the plate prompt list");
assert.match(prompts, />\s*LTX\s*</, "LTX is on the JACK GHOST plate block");
assert.match(prompts, />\s*H3\s*</, "H3 is on the JACK GHOST plate block");
assert.doesNotMatch(prompts, /Siray/, "Siray stays off the plate engine row");
assert.doesNotMatch(prompts, />\s*Free\s*</, "Free stays off the plate engine row");
assert.match(prompts, /m-track-motion-slot/, "[ ] motion hole sits under LTX / H3");
assert.match(prompts, /MUTE_MV_SLOT_PLACEHOLDER/, "slot placeholder is stand up, car drives off");
assert.match(editor, /MuteMvEnginePanel/, "music_video plate uses LTX / H3, not the LTX Image motion fold");
assert.doesNotMatch(editor, /pickEngine/, "do not put LTX / H3 on CLIPS thumbs");
assert.doesNotMatch(thumbs, /pickEngine/, "CLIPS / plate-1 thumb is not the engine row");
assert.doesNotMatch(thumbs, /m-plate-clip-engine/, "CLIPS / plate-1 thumb is not the engine row");
assert.match(trackUi, /readMvEngine/, "TRACK Send reads the plate LTX / H3 pick");
assert.match(trackUi, /clipEngine/, "Send can still run LTX / H3");
assert.doesNotMatch(trackUi, /Seedance/, "do not fake a Seedance button");
assert.match(mobileCss, /\.shot-prompt-engines/, "plate engine buttons have a place under JACK GHOST");
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
assert.match(
  readFileSync(join(here, "../src/components/mobile/PlateReviewEditor.tsx"), "utf8"),
  /styleId === "music_video" \? null/,
  "+ another line / + cutaway stay off music_video only",
);
