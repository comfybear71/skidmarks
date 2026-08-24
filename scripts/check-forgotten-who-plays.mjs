/** Run: npx tsx scripts/check-forgotten-who-plays.mjs */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyForgottenWhoPlays,
  forgottenWhoPlaysSlices,
  forgottenIntermissions,
  isHornSoloTitle,
  isJackSoloTitle,
  isSaxTitle,
  padWhoPlaysWindow,
  splitWhoPlaysWindow,
} from "../src/lib/forgottenWhoPlays.ts";
import {
  buildScratchSongLtxMotion,
  skipSongLipSyncLead,
} from "../src/lib/mobileImageMotion.ts";
import {
  JACK_WALK_CAMERAS,
  JACK_WALK_START_SEC,
  jackWalkCameraForStartSec,
} from "../src/lib/musicVideoGroupPlate.ts";
import { sliceBoundsForPlate } from "../src/lib/musicVideoTrack.ts";

const here = dirname(fileURLToPath(import.meta.url));
const trackRoute = readFileSync(join(here, "../src/app/api/crash/mobile/track/route.ts"), "utf8");

assert.equal(isSaxTitle("JACK GHOST + SAXOPHONE"), true);
assert.equal(isSaxTitle("JACK GHOST"), false);
assert.equal(isJackSoloTitle("JACK GHOST"), true);
assert.equal(isJackSoloTitle("JACK GHOST + HORN"), false);
assert.equal(isHornSoloTitle("HORN"), true);
assert.equal(isHornSoloTitle("HORN + SAXOPHONE"), false);

const firstHorn = splitWhoPlaysWindow(
  { who: "horn", startSec: 1, endSec: 23, performance: "play" },
  291.48,
);
assert.equal(firstHorn.length, 2);
assert.equal(firstHorn[0].endSec, 12);
assert.equal(firstHorn[1].startSec, 12);
assert.equal(firstHorn[1].endSec, 23);

const lastTrumpet = padWhoPlaysWindow(268, 270, 291.48);
assert.ok(lastTrumpet.endSec - lastTrumpet.startSec >= 4);

const slices = forgottenWhoPlaysSlices(291.48);
assert.ok(slices.some((s) => s.who === "horn" && s.startSec >= 285 && s.endSec <= 291.5));
assert.ok(slices.every((s) => s.who !== "sax"));
assert.ok(slices.every((s) => s.durationSec >= 4 && s.durationSec <= 30));
assert.ok(!slices.some((s) => s.who === "jack" && s.performance === "play"));
assert.ok(!slices.some((s) => s.performance === "sway"));
const jackSlices = slices.filter((s) => s.who === "jack");
const jackWalk = jackSlices.filter((s) => s.performance === "walk");
const jackSing = jackSlices.filter((s) => s.performance === "sing");
assert.ok(jackWalk.length >= 4, `expected lots of Jack walk slices, got ${jackWalk.length}`);
assert.ok(jackSing.length >= 4, `expected Jack sing slices for body/hands/high notes, got ${jackSing.length}`);
const firstJack = jackSlices.find((s) => Math.round(s.startSec) === 46);
assert.equal(firstJack?.performance, "sing");
assert.ok(
  jackSlices.every((s) => s.performance === "sing" || s.performance === "walk"),
);
assert.ok(slices.filter((s) => s.who === "horn").every((s) => s.performance === "play"));
assert.deepEqual(
  jackWalk.map((s) => Math.round(s.startSec)),
  [...JACK_WALK_START_SEC],
);

const gaps = forgottenIntermissions(291.48);
assert.ok(gaps.some((g) => g.startSec <= 23 && g.endSec >= 46));
assert.ok(gaps.some((g) => g.startSec <= 195 && g.endSec >= 206));
assert.ok(gaps.some((g) => g.startSec <= 270 && g.endSec >= 285));
assert.ok(gaps.every((g) => g.kind === "anim"));

const laid = applyForgottenWhoPlays({
  song: {
    fileName: "FORGOTTEN.mp3",
    durationSec: 291.48,
    sliceStartSec: 0,
    sliceDurationSec: 15,
  },
  shots: [
    { shotId: "jack", plateFile: "jack.png", title: "JACK GHOST" },
    { shotId: "horn", plateFile: "horn.png", title: "HORN" },
    { shotId: "sax", plateFile: "sax.png", title: "SAXOPHONE" },
    { shotId: "trio", plateFile: "trio.png", title: "JACK GHOST + HORN + SAXOPHONE" },
  ],
  newCutId: (() => {
    let n = 0;
    return () => `cut_${++n}`;
  })(),
});
if ("error" in laid) throw new Error(laid.error);
assert.ok(laid.cuts.every((c) => c.shotId === "jack" || c.shotId === "horn"));
assert.ok(!laid.cuts.some((c) => c.shotId === "sax" || c.shotId === "trio"));
assert.ok(!laid.cuts.some((c) => c.performance === "sway"));
assert.ok(laid.cuts.some((c) => c.performance === "sing"));
assert.ok(laid.cuts.some((c) => c.performance === "walk"));
assert.ok(laid.cuts.some((c) => c.performance === "play"));

const cutWins = sliceBoundsForPlate({
  song: {
    fileName: "song.mp3",
    durationSec: 291,
    sliceStartSec: 0,
    sliceDurationSec: 15,
    plateTimings: [{ plateId: "jack", startMs: 0, endMs: 15000, sortIndex: 0 }],
  },
  shotId: "jack",
  cut: {
    id: "x",
    plateFile: "jack.png",
    shotId: "jack",
    startSec: 46,
    durationSec: 30,
  },
});
assert.equal(cutWins.startSec, 46);
assert.equal(cutWins.durationSec, 30);

const jackSingMotion = buildScratchSongLtxMotion({
  styleId: "music_video",
  speaker: "JACK GHOST",
  performance: "sing",
});
assert.match(jackSingMotion, /Face stays hidden/);
assert.match(jackSingMotion, /No saxophone/);
assert.match(jackSingMotion, /Cyan mouth line moves/);
assert.match(jackSingMotion, /Body and empty hands express the song/);
assert.match(jackSingMotion, /high notes/);
assert.doesNotMatch(jackSingMotion, /singing, lip-sync/);
assert.doesNotMatch(jackSingMotion, /walks away from camera/);
assert.equal(
  skipSongLipSyncLead({ speaker: "JACK GHOST", performance: "sing", singing: true }),
  true,
);

const walkAngles = new Set();
for (const startSec of JACK_WALK_START_SEC) {
  const jackWalkMotion = buildScratchSongLtxMotion({
    styleId: "music_video",
    speaker: "JACK GHOST",
    performance: "walk",
    startSec,
  });
  assert.match(jackWalkMotion, /walks away from camera/);
  assert.match(jackWalkMotion, /Face stays hidden/);
  assert.match(jackWalkMotion, /Face never readable/);
  assert.match(jackWalkMotion, /Does not turn around/);
  assert.doesNotMatch(jackWalkMotion, /Cyan mouth line moves/);
  assert.doesNotMatch(jackWalkMotion, /singing, lip-sync/);
  const camera = jackWalkCameraForStartSec(startSec);
  assert.match(jackWalkMotion, new RegExp(camera.slice(0, 18).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  walkAngles.add(camera);
}
assert.equal(walkAngles.size, JACK_WALK_START_SEC.length);
assert.ok(walkAngles.size >= 4);
assert.equal(
  skipSongLipSyncLead({ speaker: "JACK GHOST", performance: "walk", singing: true }),
  true,
);

const hornPlay = buildScratchSongLtxMotion({
  styleId: "music_video",
  speaker: "HORN",
  performance: "play",
  staging: "HORN holds muted trumpet at the lips",
});
assert.match(hornPlay, /actually playing the trumpet/);
assert.match(hornPlay, /Fade in/);
assert.match(hornPlay, /Fade out/);
assert.match(hornPlay, /revolves back/);
assert.match(hornPlay, /Not posing/);

assert.match(trackRoute, /set-who-plays/);
assert.match(trackRoute, /applyForgottenWhoPlays/);

console.log("check-forgotten-who-plays: ok");
