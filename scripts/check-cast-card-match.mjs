/** Run: npx tsx scripts/check-cast-card-match.mjs */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pickCastCardIndexByName, castCardTokens } from "../src/lib/castCardMatch.ts";

const pick = (labels, name) => {
  const i = pickCastCardIndexByName(labels, name);
  return i < 0 ? null : labels[i];
};

// Exact wins, always.
assert.equal(pick(["Dazza test photoreal", "Old Dazza v1", "Dazza", "Nan"], "Dazza"), "Dazza");
assert.equal(pick(["Shazza", "Dazza", "Nan"], "Nan"), "Nan");

// THE BUG: no exact card, several labels contain the name. Used to hand back
// whichever the map yielded first — a photoreal human on one draw, someone
// else on the next. Now it refuses, and the caller says "approve that face".
assert.equal(pick(["Dazza test photoreal", "Old Dazza v1"], "Dazza"), null);
// Order no longer changes the answer.
assert.equal(pick(["Old Dazza v1", "Dazza test photoreal"], "Dazza"), null);

// A short label can no longer swallow a character — whole tokens only.
assert.equal(pick(["Az"], "Dazza"), null);
assert.equal(pick(["Da"], "Dazza"), null);
assert.equal(pick(["N"], "Nan"), null);
assert.equal(pick(["zz"], "Shazza"), null);

// Still finds the real ones.
assert.equal(pick(["Ranger Bazza", "Shazza"], "Bazza"), "Ranger Bazza");
assert.equal(pick(["Bazza", "Shazza"], "Ranger Bazza"), "Bazza");
assert.equal(pick(["Nugget", "Dazza"], "Nuggets"), "Nugget");
assert.equal(pick(["Nuggets", "Dazza"], "Nugget"), "Nuggets");
assert.equal(pick(["The Unit 4s", "Dazza"], "the unit 4s"), "The Unit 4s");

// Dazza and Shazza never resolve to each other.
const sunny = ["Dazza", "Shazza", "Nuggets", "Nan", "Ranger Bazza", "The Unit 4s"];
for (const n of sunny) assert.equal(pick(sunny, n), n, `${n} must be itself`);

// Empty / junk.
assert.equal(pick([], "Dazza"), null);
assert.equal(pick(["", "  "], "Dazza"), null);
assert.equal(pick(["Dazza"], ""), null);

// Plural stripping only on real words, so "4s" is not "4".
assert.deepEqual(castCardTokens("Nuggets"), ["nugget"]);
assert.deepEqual(castCardTokens("The Unit 4s"), ["the", "unit", "4s"]);

// Both resolvers must use it — neither may keep the old includes() match.
const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../src/lib/mobilePlates.ts"),
  "utf8",
);
assert.match(src, /pickCastCardIndexByName/);
assert.doesNotMatch(src, /includes\(lower\)|lower\.includes\(n\)/);
assert.doesNotMatch(src, /label\.includes\(wanted\)|wanted\.includes\(r\.label\)/);
assert.equal((src.match(/pickCastCardIndexByName\(/g) || []).length, 2, "both resolvers call it");

console.log("check-cast-card-match: ok");
