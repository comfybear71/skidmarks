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
  isSaxSoloTitle,
  isSaxTitle,
  padWhoPlaysWindow,
  splitWhoPlaysWindow,
} from "../src/lib/forgottenWhoPlays.ts";
import {
  buildScratchSongLtxMotion,
  skipSongLipSyncLead,
} from "../src/lib/mobileImageMotion.ts";
import { forgottenSoloCamera, FORGOTTEN_GROK_GRADE } from "../src/lib/musicVideoGroupPlate.ts";
import { sliceBoundsForPlate } from "../src/lib/musicVideoTrack.ts";

const here = dirname(fileURLToPath(import.meta.url));
const trackRoute = readFileSync(join(here, "../src/app/api/crash/mobile/track/route.ts"), "utf8");

assert.equal(isSaxTitle("JACK GHOST + SAXOPHONE"), true);
assert.equal(isSaxTitle("JACK GHOST"), false);
assert.equal(isSaxSoloTitle("SAXOPHONE"), true);
assert.equal(isSaxSoloTitle("JACK GHOST + SAXOPHONE"), false);
assert.equal(isJackSoloTitle("JACK GHOST"), true);
assert.equal(isJackSoloTitle("JACK GHOST + HORN"), false);
assert.equal(isHornSoloTitle("HORN"), true);
assert.equal(isHornSoloTitle("HORN + SAXOPHONE"), false);

const firstSax = splitWhoPlaysWindow(
  { who: "sax", startSec: 1, endSec: 23, performance: "play" },
  291.48,
);
assert.equal(firstSax.length, 2);
assert.equal(firstSax[0].endSec, 12);
assert.equal(firstSax[1].startSec, 12);
assert.equal(firstSax[1].endSec, 23);

const lastLead = padWhoPlaysWindow(268, 270, 291.48);
assert.ok(lastLead.endSec - lastLead.startSec >= 4);

const slices = forgottenWhoPlaysSlices(291.48);
assert.ok(slices.some((s) => s.who === "sax" && s.startSec >= 285 && s.endSec <= 291.5));
assert.ok(slices.every((s) => s.who === "jack" || s.who === "sax"));
assert.ok(slices.every((s) => s.durationSec >= 4 && s.durationSec <= 30));
assert.ok(!slices.some((s) => s.who === "jack" && s.performance === "play"));
assert.ok(!slices.some((s) => s.performance === "sway"));
assert.ok(!slices.some((s) => s.performance === "walk"));
const jackSlices = slices.filter((s) => s.who === "jack");
assert.ok(jackSlices.length >= 6);
assert.ok(jackSlices.every((s) => s.performance === "sing"));
assert.ok(slices.filter((s) => s.who === "sax").every((s) => s.performance === "play"));

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
assert.ok(laid.cuts.every((c) => c.shotId === "jack" || c.shotId === "sax"));
assert.ok(!laid.cuts.some((c) => c.shotId === "horn" || c.shotId === "trio"));
assert.ok(!laid.cuts.some((c) => c.performance === "sway"));
assert.ok(!laid.cuts.some((c) => c.performance === "walk"));
assert.ok(laid.cuts.some((c) => c.performance === "sing"));
assert.ok(laid.cuts.some((c) => c.performance === "play"));

const noSax = applyForgottenWhoPlays({
  song: {
    fileName: "FORGOTTEN.mp3",
    durationSec: 291.48,
    sliceStartSec: 0,
    sliceDurationSec: 15,
  },
  shots: [
    { shotId: "jack", plateFile: "jack.png", title: "JACK GHOST" },
    { shotId: "horn", plateFile: "horn.png", title: "HORN" },
  ],
  newCutId: () => "cut",
});
assert.ok("error" in noSax);
assert.match(noSax.error, /SAXOPHONE/);

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

const saxPlay = buildScratchSongLtxMotion({
  styleId: "music_video",
  speaker: "SAXOPHONE",
  performance: "play",
  staging: "SAXOPHONE holds the sax at the lips",
});
assert.match(saxPlay, /actually playing the saxophone/);
assert.match(saxPlay, /Fade in/);
assert.match(saxPlay, /Fade out/);
assert.match(saxPlay, /revolves back/);
assert.match(saxPlay, /Not posing/);
assert.doesNotMatch(saxPlay, /actually playing the trumpet/);
assert.equal(
  skipSongLipSyncLead({ speaker: "SAXOPHONE", performance: "play", singing: true }),
  true,
);

assert.match(forgottenSoloCamera("JACK GHOST", "graveyard"), /blood crimson/);
assert.match(forgottenSoloCamera("SAXOPHONE", "eerie house"), /Grok logo/);
assert.match(FORGOTTEN_GROK_GRADE, /Grok plates/);

assert.match(trackRoute, /set-who-plays/);
assert.match(trackRoute, /applyForgottenWhoPlays/);

console.log("check-forgotten-who-plays: ok");
