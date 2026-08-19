/** Run: npx tsx scripts/check-plate-automation-archive.mjs */
import assert from "node:assert/strict";
import {
  PLATE_AUTOMATION_ENTRIES,
  SPEECH_QUALITY_MAX_SEC,
  SPEECH_QUALITY_MAX_WORDS,
  SPEECH_QUALITY_MIN_SEC,
  adviseSpeechClip,
  archiveForSurface,
  archiveEntry,
  oneCharacterStillPrompt,
} from "../src/lib/plateAutomationArchive.ts";
import { compileScriptedPosition } from "../src/lib/mobilePlateScript.ts";
import { LTX_RANT_HOLD_SEC, LTX_RANT_MAX_WORDS } from "../src/lib/mobileRantSplit.ts";
import { ltxFollowsMp3DurationSec, LTX_LIPSYNC_MIN_SEC } from "../src/lib/ltxDuration.ts";
import { toggleScoreTag } from "../src/lib/scratchBench/scorecard.ts";

assert.equal(SPEECH_QUALITY_MIN_SEC, LTX_LIPSYNC_MIN_SEC);
assert.equal(ltxFollowsMp3DurationSec(1), 4);
assert.equal(ltxFollowsMp3DurationSec(12), 13);
assert.equal(SPEECH_QUALITY_MAX_SEC, LTX_RANT_HOLD_SEC);
assert.equal(SPEECH_QUALITY_MAX_WORDS, LTX_RANT_MAX_WORDS);

const scratch = archiveForSurface("scratch");
assert.ok(scratch.some((e) => e.id === "scratch-stills-only"));
assert.ok(scratch.every((e) => e.surface !== "mobile"));
assert.equal(archiveEntry("speech-too-short")?.surface, "mobile");
assert.equal(archiveEntry("speech-rant-unsplit")?.surface, "mobile");
assert.equal(archiveEntry("gold-speaking-motion")?.surface, "mobile");
assert.equal(archiveEntry("speech-clip-chain")?.surface, "mobile");
assert.match(archiveEntry("speech-clip-chain")?.fix || "", /last frame/);

const still = oneCharacterStillPrompt("JO", "the kitchen");
assert.equal(still, compileScriptedPosition({ name: "JO", place: "the kitchen" }));
assert.match(still, /Medium close-up of JO/);
assert.match(still, /Only JO in frame/);

const short = adviseSpeechClip("Oi.");
assert.equal(short.status, "too_short");
assert.equal(short.entryId, "speech-too-short");

const ok = adviseSpeechClip(
  "We haven't got any shade, Dazza, so stop complaining and finish your breakfast.",
);
assert.equal(ok.status, "ok");

const rant =
  "I'll be moving out as soon as I can. That will make you happy. No more cats hey LAND LADY. Just drug addicts and mentally ill, unemployed drop kicks. You'll have to buy kitchen shit for your drug addict tenants because I've packed all mine up.";
const split = adviseSpeechClip(rant);
assert.equal(split.status, "split");
assert.ok(split.chunks.length > 1);

assert.ok(PLATE_AUTOMATION_ENTRIES.every((e) => e.id && e.fix));

const withStyle = toggleScoreTag([], "style");
assert.ok(withStyle.includes("style"));
assert.ok(!withStyle.includes("length"));

console.log("check-plate-automation-archive: ok");
