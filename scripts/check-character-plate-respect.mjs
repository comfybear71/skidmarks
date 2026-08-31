/** Run: npx tsx scripts/check-character-plate-respect.mjs
 *
 * Pick a face → bake the series sheet once → shot stills use the single
 * cast card + LOOK words. The 4-up sheet is QA only (doubles if Drawn).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { applyCandidateLook, pickerLookSeed } from "../src/lib/mobileJobReady.ts";

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(here, p), "utf8");

const takes = [
  { id: "old", approved: false, prompt: "first take" },
  { id: "pick", approved: true, prompt: "" },
];
assert.equal(pickerLookSeed(takes), "");
assert.equal(
  applyCandidateLook(takes, "pick", "blonde dreads, rasta beanie, pink glasses")[1]?.prompt,
  "blonde dreads, rasta beanie, pink glasses",
);

const characterPlate = read("../src/lib/mobileCharacterPlate.ts");
assert.match(characterPlate, /Never handed to plateCastIntoGen/);
assert.match(characterPlate, /resolveApprovedFace/);

const plates = read("../src/lib/mobilePlates.ts");
assert.match(plates, /resolvePlateCastPath/);
assert.doesNotMatch(
  plates,
  /localPath \|\| !jobFile/,
  "Job picked face wins — a shelf card that shares the name must not replace it",
);
assert.match(plates, /Picked a face on this job/);
assert.doesNotMatch(
  plates,
  /findCharacterPlate/,
  "Shot Draw uses the single cast card — not the 4-up sheet",
);

const qa = read("../src/lib/mobilePlateQa.ts");
assert.match(qa, /findCharacterPlate/, "QA may use the series sheet as identity");
assert.match(qa, /Never handed to the still compositor/);

const tree = read("../src/components/mobile/StudioTree.tsx");
assert.match(tree, /m-series-plate/);
assert.match(tree, /This sheet is the lock/);
assert.match(tree, /onMakeSeriesPlate/);
assert.match(tree, /onApproveCast\(castFocus, id, look\)/);

const page = read("../src/app/(mobile)/m/page.tsx");
assert.match(page, /action: "set-look"/);
assert.match(page, /customPrompt: look/);
assert.match(page, /getMobileJob\(job\.id\)/, "failed series plate must reload the job row");

const route = read("../src/app/api/crash/mobile/candidates/route.ts");
assert.match(route, /action === "set-look"/);
assert.match(route, /storedPrompt/);

const prompt = read("../src/lib/characterPlatePrompt.ts");
assert.match(prompt, /Use the provided start image as the identity lock/);

console.log("check-character-plate-respect: ok");
