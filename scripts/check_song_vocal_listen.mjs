import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildListenReport,
  compareListenClockToPins,
  isInSilence,
  longQuietStretches,
  nearestSoundStart,
  soundWindowsFromSilence,
} from "../src/lib/songVocalListen.ts";
import {
  detectSilenceWindows,
  parseSilenceDetectOutput,
} from "../src/lib/audioSilenceDetect.ts";
import { resolveFfmpeg } from "../src/lib/mobileStitch.ts";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// --- pure logic: soundWindowsFromSilence ---
const silences = [
  { startMs: 0, endMs: 1000 }, // leading silence (intro)
  { startMs: 5000, endMs: 9000 }, // instrumental break
];
const sw = soundWindowsFromSilence(silences, 12000);
assert(sw.length === 4, `expected 4 windows, got ${sw.length}`);
assert(sw[0].kind === "silence" && sw[0].startMs === 0 && sw[0].endMs === 1000, "leading silence");
assert(sw[1].kind === "sound" && sw[1].startMs === 1000 && sw[1].endMs === 5000, "first sound gap");
assert(sw[2].kind === "silence" && sw[2].startMs === 5000 && sw[2].endMs === 9000, "instrumental break");
assert(sw[3].kind === "sound" && sw[3].startMs === 9000 && sw[3].endMs === 12000, "trailing sound");

assert(isInSilence(silences, 500) === true, "500ms is in leading silence");
assert(isInSilence(silences, 3000) === false, "3000ms is sound");
assert(isInSilence(silences, 6000) === true, "6000ms is in instrumental break");

assert(nearestSoundStart(sw, 6000) === 9000, "nearest sound to 6000 is the 9000 restart");
assert(nearestSoundStart(sw, 4900) === 1000, "nearest sound to 4900 is the 1000 start");

const longQuiet = longQuietStretches(silences, 3000);
assert(longQuiet.length === 1 && longQuiet[0].startMs === 5000, "only the 4s break counts as long-quiet");

// --- pure logic: compareListenClockToPins ---
const cues = [
  { lineIndex: 0, atMs: 200 }, // pin sits inside leading silence — should flag
  { lineIndex: 1, atMs: 6500 }, // pin sits inside the instrumental break — should flag, big drift
  { lineIndex: 2, atMs: 10000 }, // pin sits in real sound — should be a clean, near-zero-drift match
];
const drift = compareListenClockToPins(cues, silences, sw);
assert(drift.length === 3, "one drift row per pin");
assert(drift[0].pinInSilence === true, "line 0 pin is in silence");
assert(drift[1].pinInSilence === true, "line 1 pin is in silence");
assert(drift[1].driftMs === 9000 - 6500, "line 1 drift is the gap to the 9000 restart");
assert(drift[2].pinInSilence === false, "line 2 pin is in real sound");
assert(drift[2].nearestSoundStartMs === 9000, "line 2 nearest sound-window start");

const report = buildListenReport({ songDurationMs: 12000, silences, cues });
assert(report.pinDrift.length === 3, "buildListenReport wires pinDrift through");
assert(report.longQuietStretches.length === 1, "buildListenReport wires longQuietStretches through");

// --- ffmpeg stderr parsing, hand-crafted ---
const sampleStderr = `
[silencedetect @ 0x1] silence_start: 0.5
[silencedetect @ 0x1] silence_end: 2.1 | silence_duration: 1.6
[silencedetect @ 0x1] silence_start: 8.0
`;
const parsed = parseSilenceDetectOutput(sampleStderr, 10000);
assert(parsed.length === 2, `expected 2 windows from hand-crafted stderr, got ${parsed.length}`);
assert(parsed[0].startMs === 500 && parsed[0].endMs === 2100, "first parsed window");
assert(parsed[1].startMs === 8000 && parsed[1].endMs === 10000, "trailing open silence closed at durationMs");

const noDuration = parseSilenceDetectOutput(sampleStderr);
assert(noDuration.length === 1, "without durationMs, an unterminated trailing silence is dropped");

console.log("check_song_vocal_listen: pure logic ok");

// --- real end-to-end: synthesize a tone / true-silence / tone track and actually run ffmpeg ---
const { bin } = resolveFfmpeg();
const ffmpeg = bin || "ffmpeg";
const dir = mkdtempSync(path.join(os.tmpdir(), "listen-check-"));
const wavPath = path.join(dir, "tone.wav");

const tonePath = path.join(dir, "a.wav");
const silPath = path.join(dir, "b.wav");
const tone2Path = path.join(dir, "c.wav");
execFileSync(ffmpeg, ["-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=2", tonePath], {
  stdio: "ignore",
});
execFileSync(ffmpeg, ["-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono:d=3", silPath], {
  stdio: "ignore",
});
execFileSync(ffmpeg, ["-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=2", tone2Path], {
  stdio: "ignore",
});
const listPath = path.join(dir, "list.txt");
const fs = await import("node:fs");
fs.writeFileSync(listPath, [tonePath, silPath, tone2Path].map((p) => `file '${p}'`).join("\n"));
execFileSync(ffmpeg, ["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", wavPath], {
  stdio: "ignore",
});

const { silences: real, raw } = detectSilenceWindows(wavPath, { durationMs: 7000 });
assert(raw.includes("silencedetect"), "ffmpeg actually ran the silencedetect filter");
assert(real.length >= 1, `expected at least one detected silence window, got ${JSON.stringify(real)}`);
const middleSilence = real.find((w) => w.startMs > 1000 && w.startMs < 3000);
assert(
  Boolean(middleSilence),
  `expected a silence window starting near 2000ms (the real gap between the two tones), got ${JSON.stringify(real)}`,
);

rmSync(dir, { recursive: true, force: true });
console.log("check_song_vocal_listen: real ffmpeg silencedetect run ok, found", real);
