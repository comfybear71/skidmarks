/** Run: npx tsx scripts/check-cast-look-carries.mjs
 *
 * A reused cast card has to bring the words as well as the face. Without the
 * words every shot re-invents whatever the picture does not pin down, which is
 * how a character drifts between shots and between episodes.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(here, p), "utf8");

const candidates = read("../src/lib/mobileCandidates.ts");
const reuse = read("../src/lib/mobileCastReuse.ts");
const bands = read("../src/app/api/crash/mobile/bands/route.ts");
const approve = read("../src/app/api/crash/mobile/candidates/route.ts");

// 1. The shelf stores the look, not the name repeated back.
assert.doesNotMatch(
  candidates,
  /labelBrief:\s*name,/,
  "labelBrief must hold the look, not the name",
);
assert.match(candidates, /labelBrief:\s*look\.trim\(\)\s*\|\|\s*name/);

// 2. Approving a face sends the LOOK box (or the stored take words).
assert.match(approve, /storedPrompt/, "approve writes the LOOK box onto the take");
assert.match(approve, /lookIn \|\| candidate\.prompt/, "LOOK box wins over a blank stored take");
assert.match(approve, /action === "set-look"/, "typed LOOK saves without a second Pick");

// 3. Saving a band collects each member's words.
assert.match(bands, /looks\[member\] = take\.prompt\.trim\(\)/);
assert.match(bands, /looks,/, "and hands them to the shelf sync");

// 4. Reading the shelf brings the look back.
assert.match(reuse, /look: string/, "a reusable card carries a look");
assert.match(reuse, /label_brief/);

// 5. Applying a band puts the words on the candidate, where
//    candidateLookPrompt can find them.
assert.match(bands, /prompt: card\.look \|\| ""/);

// 6. Old rows stored the name in label_brief. That is not a look, and must not
//    be handed on as one — "JACK GHOST looks like: JACK GHOST" describes
//    nothing.
const guard = reuse.slice(reuse.indexOf("const brief"), reuse.indexOf("mtime: toMtime"));
assert.match(guard, /brief\.toLowerCase\(\) !== name\.toLowerCase\(\)/);

// 7. The look ends up where the plate compositor reads it.
const ready = read("../src/lib/mobileJobReady.ts");
assert.match(ready, /prompt\?\.trim\(\)/, "candidateLookPrompt reads candidate.prompt");
const plates = read("../src/lib/mobilePlates.ts");
assert.match(plates, /candidateLookPrompt/, "the shot plate uses the look words");
assert.match(plates, /looks like/, "and puts them in the staging note");

console.log("check-cast-look-carries OK");
