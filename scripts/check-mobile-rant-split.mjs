import assert from "node:assert/strict";
import {
  LTX_RANT_HOLD_SEC,
  LTX_RANT_MAX_WORDS,
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

console.log("check-mobile-rant-split: ok");
