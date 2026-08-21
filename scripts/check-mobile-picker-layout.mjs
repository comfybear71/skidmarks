/** Run: node scripts/check-mobile-picker-layout.mjs */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tree = readFileSync(join(root, "src/components/mobile/StudioTree.tsx"), "utf8");
const css = readFileSync(join(root, "src/app/(mobile)/m/mobile.css"), "utf8");
const layout = readFileSync(join(root, "src/app/(mobile)/layout.tsx"), "utf8");
const card = readFileSync(join(root, "src/components/mobile/SingleCandidateCard.tsx"), "utf8");

assert.match(tree, /className="m-picker-actions"/);
assert.match(tree, /className="m-picker-extra"/);
assert.match(tree, /className="m-place-plate-extra"/);
assert.match(tree, /Locked place still\. More makes a new take if you want\./);

const locGen = tree.indexOf("onGenerate={(p) => onGenerateLocation");
assert.ok(locGen > 0, "location CandidatePicker onGenerate missing");
const extraAt = tree.lastIndexOf("extra={", locGen);
assert.ok(extraAt > 0, "location extra missing");
const extraBlock = tree.slice(extraAt, locGen);
assert.doesNotMatch(
  extraBlock,
  /worldGalleryStillUrl/,
  "Place extra must not load g:place_… — that copy is not in Blob",
);
assert.doesNotMatch(
  extraBlock,
  /<img/,
  "Place extra must not draw a second still beside Undo / More",
);

const actionsAt = tree.indexOf('className="m-picker-actions"');
assert.ok(actionsAt > 0, "m-picker-actions missing");
const actionsEnd = tree.indexOf("</div>", actionsAt);
const undoRow = tree.slice(actionsAt, actionsEnd);
assert.match(undoRow, /Undo/);
assert.match(undoRow, /More/);
assert.doesNotMatch(undoRow, /\{extra/, "Undo / More row must not include extra");
assert.match(tree, /\{extra \? <div className="m-picker-extra">\{extra\}<\/div> : null\}/);

assert.match(css, /\.m-picker-extra/);
assert.match(css, /safe-area-inset-top/);
assert.match(css, /\.m-candidate-still/);
assert.match(layout, /viewportFit:\s*"cover"/);
assert.match(card, /className="m-candidate-still"/);
assert.doesNotMatch(card, /height:\s*"300px"/);

console.log("mobile picker layout lock ok");
