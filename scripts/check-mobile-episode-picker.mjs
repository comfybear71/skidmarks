/** Run: npx tsx scripts/check-mobile-episode-picker.mjs */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const page = readFileSync(join(root, "src/app/(mobile)/m/page.tsx"), "utf8");
const picker = readFileSync(join(root, "src/components/mobile/OpenEpisodePicker.tsx"), "utf8");

assert.doesNotMatch(
  page,
  /styleId=\{job \? undefined : styleId\}/,
  "Your episodes must stay on the current show after Open — do not list the whole desk",
);
assert.match(
  page,
  /styleId=\{job\?\.styleId \|\| styleId\}/,
  "Your episodes uses the open pack's style, or the Look tile when no pack is open",
);
assert.match(
  picker,
  /styleId \? jobs\.filter\(\(j\) => j\.styleId === styleId\) : jobs/,
  "OpenEpisodePicker still filters when styleId is set",
);

console.log("mobile episode picker style lock ok");
