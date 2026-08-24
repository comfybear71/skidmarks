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
const strip = tree.slice(tree.indexOf('id="m-plates-strip"'));
assert.match(strip, /job\.folderName \? \(/);
assert.match(strip, /<PlateReviewEditor/);
assert.doesNotMatch(
  strip,
  /job\.phase === "review"/,
  "Do not hide the plate strip behind a review-only phase gate",
);

const addFn = tree.slice(
  tree.indexOf("async function addLocationToPlate"),
  tree.indexOf("const episodeHint"),
);
assert.match(addFn, /revealPlates\(data\.shotId\)/);
assert.match(addFn, /studioFetchError/);
assert.doesNotMatch(
  tree,
  /Plate this place/,
  "One add button on a place — do not show a second plate button",
);
assert.match(tree, /Add \$\{plateSpeaker\.trim\(\)\}/);
assert.match(tree, /Add empty plate/);
assert.match(tree, /Add empty stage/);
assert.match(tree, /Tap a name, or Empty\. Then Add/);
assert.doesNotMatch(
  tree,
  /Pick who is in this place first/,
  "Empty plate must still add — do not block on a name",
);

const plates = tree.slice(tree.indexOf('label="Plates"'), tree.indexOf("<MusicVideoSongCuts"));
assert.ok(
  plates.indexOf("m-plates-strip") >= 0,
  "Plate strip must sit above song cuts so the cards are on screen",
);
assert.doesNotMatch(
  tree,
  /Crash Lab: Open/,
  "Do not leave a Crash Lab Open line on /m — it is not a button",
);

assert.match(editor, /focusShotId/);
assert.match(editor, /setOpenShotId\(id\)/);
assert.match(editor, /setStillsStripOpen\(true\)/);
assert.doesNotMatch(
  editor,
  /if \(!shots\.length && !story\) return null/,
  "A failed story GET must not hide the plate strip",
);
assert.match(editor, /No plates yet\. Tap \+/);
assert.match(editor, /m-plate-no-still/);
assert.match(editor, /Drawing the still — wait here/);
assert.match(tree, /Adding a plate — wait here/);
assert.match(tree, /busy=\{addingPlateFor === placeFocus\}/);

const css = readFileSync(join(root, "src/app/(mobile)/m/mobile.css"), "utf8");
assert.match(css, /\.mobile-shell button:active/);
assert.match(css, /\.m-tap-busy/);
assert.match(css, /\.m-plate-no-still/);

const tap = readFileSync(
  join(root, "src/components/mobile/MobileTapFeedback.tsx"),
  "utf8",
);
assert.match(tap, /touchstart/);
assert.match(
  readFileSync(join(root, "src/app/(mobile)/layout.tsx"), "utf8"),
  /MobileTapFeedback/,
);

console.log("mobile plate visible lock ok");
