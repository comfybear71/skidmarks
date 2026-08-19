import assert from "node:assert/strict";
import {
  LTX_RANT_HOLD_SEC,
  LTX_RANT_MAX_WORDS,
  insertBeatAfter,
  splitSpokenRant,
  wordCount,
} from "../src/lib/mobileRantSplit.ts";

assert.equal(LTX_RANT_HOLD_SEC, 6);
assert.equal(LTX_RANT_MAX_WORDS, 15);

assert.deepEqual(splitSpokenRant("I'll be moving out as soon as I can."), [
  "I'll be moving out as soon as I can.",
]);

const rant =
  "I'll be moving out as soon as I can. That will make you happy. No more cats hey LAND LADY. Just drug addicts and mentally ill, unemployed drop kicks. You'll have to buy kitchen shit for your drug addict tenants because I've packed all mine up. I'll be calling today to see what my rights are when landlord rents to drug addicts and I'll be calling the police to let them know what is going on and I'll give them your information as the owner and landlord. I thought I was a very good friend to both of you but obviously you only want drug addicts in your house and not someone who treats your house like their own.";

const parts = splitSpokenRant(rant);
assert.ok(parts.length >= 4, `expected several clips, got ${parts.length}`);
assert.equal(parts.join(" "), rant.replace(/\s+/g, " ").trim());
for (const part of parts) {
  if (part.includes(". ")) assert.ok(wordCount(part) <= LTX_RANT_MAX_WORDS + 8);
}
assert.ok(parts.every((p) => p.length > 0));

const runOn =
  "I'll be moving out as soon as I can that will make you happy no more cats hey land lady just drug addicts and mentally ill unemployed drop kicks you will have to buy kitchen shit for your drug addict tenants";
const runParts = splitSpokenRant(runOn);
assert.ok(runParts.length >= 2, `run-on should split, got ${runParts.length}`);
assert.ok(runParts.every((p) => wordCount(p) <= LTX_RANT_MAX_WORDS));
assert.equal(runParts.join(" "), runOn.replace(/\s+/g, " ").trim());

const beats = [
  { id: "a", text: "chunk 1" },
  { id: "other", text: "someone else" },
];
const withChunk2 = insertBeatAfter(beats, "a", { id: "a2", text: "chunk 2" });
assert.deepEqual(
  withChunk2.map((b) => b.id),
  ["a", "a2", "other"],
  "rant extras sit next to the original line, not at the end of the shot",
);
const withChunk3 = insertBeatAfter(withChunk2, "a2", { id: "a3", text: "chunk 3" });
assert.deepEqual(withChunk3.map((b) => b.id), ["a", "a2", "a3", "other"]);
assert.deepEqual(insertBeatAfter(beats, "missing", { id: "z", text: "z" }).map((b) => b.id), [
  "a",
  "other",
  "z",
]);

console.log("check-mobile-rant-split: ok");
