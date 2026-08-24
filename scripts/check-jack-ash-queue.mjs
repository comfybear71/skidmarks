/** Run: npx tsx scripts/check-jack-ash-queue.mjs */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  FORGOTTEN_FOLDER,
  FORGOTTEN_JOB_ID,
  JACK_ASH_BAND,
  JACK_ASH_QUEUE,
  isJackAshQueueTitle,
} from "../src/lib/jackAshQueue.ts";
import { archiveEntry } from "../src/lib/plateAutomationArchive.ts";

assert.deepEqual([...JACK_ASH_QUEUE], [
  "MY NEW TOY",
  "FORGOTTEN",
  "BURNING BRIGHT",
  "EAST",
  "GIVE ME SOMETHING",
]);
assert.equal(JACK_ASH_BAND, "THE JACK ASH BAND");
assert.equal(FORGOTTEN_JOB_ID, "mgen_20260824085817084_edp");
assert.equal(FORGOTTEN_FOLDER, "THE JACK ASH BAND — FORGOTTEN 84_edp");
assert.equal(isJackAshQueueTitle("FORGOTTEN"), true);
assert.equal(isJackAshQueueTitle("BLOWING UP CLAUDE"), false);

const list = readFileSync(new URL("../docs/JACK_ASH_QUEUE.md", import.meta.url), "utf8");
for (const title of JACK_ASH_QUEUE) {
  assert.match(list, new RegExp(title));
}
assert.match(list, /concert loop/);
assert.match(list, /Start directing/);
assert.match(list, /MUSIC_VIDEO_BASE/);

const base = readFileSync(new URL("../docs/MUSIC_VIDEO_BASE.md", import.meta.url), "utf8");
assert.match(base, /MUSIC_VIDEO_CAMERAS/);
assert.match(base, /isForgottenSongJob/);
assert.match(base, /who is playing/);
assert.match(base, /pull\/311/);

const loop = readFileSync(new URL("../docs/CONCERT_LOOP_PLATE.md", import.meta.url), "utf8");
assert.match(loop, /video_ltx2_5_i2v/);
assert.match(loop, /LTX-2\.3 IA2V/);
assert.match(loop, /No people/);
assert.match(loop, /motion_bucket_id/);
assert.match(loop, /Thunderdome/);
assert.match(loop, /Double Talkin/);
assert.match(loop, /after more video/);
assert.doesNotMatch(loop, /swap \/m speech/i);

assert.equal(archiveEntry("concert-loop-not-speech")?.verdict, "fails");
assert.match(archiveEntry("concert-loop-not-speech")?.fix || "", /IA2V/);
assert.equal(archiveEntry("concert-loop-art-plate")?.verdict, "unknown_until_model");
assert.match(archiveEntry("concert-loop-art-plate")?.fix || "", /no people/);

console.log("check-jack-ash-queue: ok");
