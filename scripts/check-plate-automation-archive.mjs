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
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildDefaultBeatMotion,
  buildGroupHoldMotion,
  ltxSendPrompt,
} from "../src/lib/mobileImageMotion.ts";
import { plateCastStagingNote } from "../src/lib/mobilePlateLines.ts";
import { stagingNamesHeldProp } from "../src/lib/mobileImageMotion.ts";

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
assert.equal(archiveEntry("ltx-25-flf2v-not-speech")?.surface, "mobile");
assert.equal(archiveEntry("ltx-25-flf2v-two-guides")?.verdict, "works");
assert.equal(archiveEntry("speech-clip-chain")?.surface, "mobile");
assert.match(archiveEntry("speech-clip-chain")?.fix || "", /last frame/);
assert.equal(archiveEntry("concert-loop-not-speech")?.verdict, "fails");
assert.equal(archiveEntry("concert-loop-art-plate")?.verdict, "unknown_until_model");

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

// ---------------------------------------------------------------------------
// Two or more on one card. docs/SUNNY_BANKS_MULTI_CHARACTER_RESEARCH.md rests on
// these being true; if any of them stops being true the doc is stale and this
// check is where we find out.
// ---------------------------------------------------------------------------
const here = dirname(fileURLToPath(import.meta.url));

for (const id of [
  "sunny-gold-is-solo-only",
  "group-speak-no-listener-lock",
  "group-speak-no-spatial-anchor",
  "multi-still-drops-headcount-lock",
  "held-prop-regex-gap",
  "three-faces-two-render-passes",
  "sunny-cook-clears-qa-verdict",
]) {
  assert.equal(archiveEntry(id)?.verdict, "fails", `${id} should be a logged fail`);
}

// The headline claim: the proven Sunny gold has no group SPEAK beat, only group
// holds. If someone lands a scored two-hander speaking beat in the gold, this
// fires and the research doc needs rewriting.
const gold = JSON.parse(
  readFileSync(join(here, "../docs/SUNNY_BANKS_IMAGE_MOTION_GOLD.json"), "utf8"),
);
const goldBeats = Object.values(gold.beats).map((b) => String(b.imageMotion || ""));
const speaking = goldBeats.filter((m) => /\bsays:\s*"/i.test(m));
const twoPlusInFrame = (m) => /Only .+ and .+ in frame/i.test(m);
assert.ok(speaking.length > 0, "gold should contain speaking beats");
assert.equal(
  speaking.filter(twoPlusInFrame).length,
  0,
  "gold now has a group SPEAK beat — docs/SUNNY_BANKS_MULTI_CHARACTER_RESEARCH.md is stale",
);
assert.ok(
  goldBeats.filter((m) => !/\bsays:\s*"/i.test(m)).some(twoPlusInFrame),
  "gold should still contain group HOLD beats",
);

// The group hold has a mouths-closed rule; the speaking shape has no listener
// rule at all. That asymmetry is Failure 2 in the research doc.
const twoHanderSpeak = ltxSendPrompt(
  buildDefaultBeatMotion({
    styleId: "sunny_banks",
    speaker: "Ranger Bazza",
    line: "Ten bucks and the turkeys are gone.",
    lookLock: "portly park ranger, oversized Akubra, high-vis vest",
    shotSpeakers: ["Ranger Bazza", "Dazza"],
  }),
);
assert.match(twoHanderSpeak, /Only Ranger Bazza and Dazza in frame/);
assert.doesNotMatch(twoHanderSpeak, /mouths? (stay|stays|remain) closed/i);
assert.match(
  buildGroupHoldMotion({ styleId: "sunny_banks", names: ["Ranger Bazza", "Dazza"] }),
  /All mouths stay closed/,
);

// The still drops every anti-extra guard once there are two names. Failure 1a.
const soloNote = plateCastStagingNote({ speakers: ["Nan"], staging: "Nan sits in her chair." });
const duoNote = plateCastStagingNote({
  speakers: ["Ranger Bazza", "Dazza"],
  staging: "Bazza holds a whistle up. Dazza leans on the rail.",
});
assert.match(soloNote, /Do not invent anyone else/);
assert.doesNotMatch(duoNote, /Do not invent anyone else/);
assert.doesNotMatch(duoNote, /Exactly 2 people/);

// "holds a whistle" is not read as a held prop, so Empty hands is stapled on
// next to the prop the writer just named. Failure 1c.
assert.equal(stagingNamesHeldProp("Bazza holds a whistle up."), false);
assert.equal(stagingNamesHeldProp("Bazza holding a whistle up."), true);
assert.equal(stagingNamesHeldProp("Shazza has a cigarette."), false);
assert.match(duoNote, /Empty hands/);

console.log("check-plate-automation-archive: ok");
