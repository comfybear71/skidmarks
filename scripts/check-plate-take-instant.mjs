/** Run: npx tsx scripts/check-plate-take-instant.mjs */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const editor = readFileSync(join(here, "../src/components/mobile/PlateReviewEditor.tsx"), "utf8");
const route = readFileSync(join(here, "../src/app/api/crash/mobile/plate/route.ts"), "utf8");

const preview = editor.slice(editor.indexOf("function PlatePreview"), editor.indexOf("function ShotLineEditor"));
assert.match(preview, /Flip the still now/);
assert.match(preview, /onPicked\(take\.fileName, take\.staging, plateTakes\)/);
assert.match(preview, /pickSeq/);
assert.doesNotMatch(preview, /setBusy\(true\)/);
assert.doesNotMatch(preview, /opacity: busy/);
{
  const pickFn = preview.slice(preview.indexOf("function pick("), preview.indexOf("function dropActiveTake"));
  const onPickedAt = pickFn.indexOf("onPicked(take.fileName");
  const fetchAt = pickFn.indexOf('fetch("/api/crash/mobile/plate"');
  assert.ok(onPickedAt >= 0 && fetchAt > onPickedAt, "onPicked must run before fetch");
}

assert.match(route, /if \(!pick && !dropTake\)/);
assert.match(route, /Hydrate was making every still swipe wait/);

console.log("check-plate-take-instant: ok");
