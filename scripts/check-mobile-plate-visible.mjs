/** Run: node scripts/check-mobile-plate-visible.mjs */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tree = readFileSync(join(root, "src/components/mobile/StudioTree.tsx"), "utf8");
const editor = readFileSync(
  join(root, "src/components/mobile/PlateReviewEditor.tsx"),
  "utf8",
);

assert.match(tree, /function revealPlates/);
assert.match(tree, /setOpenPlace\(null\)/);
assert.match(tree, /id="m-plates-strip"/);
assert.match(tree, /focusShotId=\{focusPlateShotId\}/);

const addFn = tree.slice(
  tree.indexOf("async function addLocationToPlate"),
  tree.indexOf("async function plateThisPlace"),
);
assert.match(addFn, /revealPlates\(data\.shotId\)/);

const plates = tree.slice(tree.indexOf('label="Plates"'), tree.indexOf("<MusicVideoSongCuts"));
assert.ok(
  plates.indexOf("m-plates-strip") < plates.indexOf("Crash Lab: Open"),
  "Plate strip must sit above the Crash Lab line so the cards are on screen",
);

assert.match(editor, /focusShotId/);
assert.match(editor, /if \(id\) setOpenShotId\(id\)/);

console.log("mobile plate visible lock ok");
