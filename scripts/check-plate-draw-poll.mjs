/** Run: npx tsx scripts/check-plate-draw-poll.mjs */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const route = readFileSync(join(here, "../src/app/api/crash/mobile/plate/route.ts"), "utf8");
const editor = readFileSync(join(here, "../src/components/mobile/PlateReviewEditor.tsx"), "utf8");
const job = readFileSync(join(here, "../src/lib/mobileGenJob.ts"), "utf8");
const rebuild = readFileSync(join(here, "../src/lib/mobilePlateRebuild.ts"), "utf8");

assert.match(route, /action === "draw-start"/);
assert.match(route, /action === "draw-poll"/);
assert.match(route, /submitSirayScratchPlate/);
assert.match(route, /finishSirayScratchPlate/);
assert.match(route, /landEpisodePlateStill/);
assert.match(route, /plateDraw/);
assert.match(job, /plateDraw\?: ScratchDrawTask/);
assert.match(rebuild, /export async function landEpisodePlateStill/);
assert.match(editor, /action: "draw-start"/);
assert.match(editor, /action: "draw-poll"/);
assert.match(editor, /async function drawPlateStill/);
assert.doesNotMatch(editor, /Draw this picture[\s\S]{0,400}staging: next,\s*summary: next/);

console.log("check-plate-draw-poll: ok");
