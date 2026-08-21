/** Run: npx tsx scripts/check-deploy-image-speed.mjs */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { STILL_CACHE_CONTROL } from "../src/lib/stillCache.ts";

const here = dirname(fileURLToPath(import.meta.url));
const nextConfig = readFileSync(join(here, "../next.config.ts"), "utf8");
const genFile = readFileSync(join(here, "../src/app/api/crash/gen/file/route.ts"), "utf8");
const world = readFileSync(join(here, "../src/app/api/crash/world-cards/file/route.ts"), "utf8");
const style = readFileSync(join(here, "../src/app/api/crash/style-cards/file/route.ts"), "utf8");
const cloudMedia = readFileSync(join(here, "../src/lib/cloudMedia.ts"), "utf8");
const cloudShelf = readFileSync(join(here, "../src/lib/cloudShelf.ts"), "utf8");

assert.match(STILL_CACHE_CONTROL, /max-age=86400/);
assert.doesNotMatch(nextConfig, /"\/api\/crash\/mobile\/\*\*"/);
assert.match(nextConfig, /"\/api\/crash\/mobile\/song\/\*\*"/);
assert.match(nextConfig, /\/api\/crash\/mobile\/scratch\/\*\*/);
assert.match(nextConfig, /\/api\/crash\/mobile\/step\/\*\*/);
assert.match(nextConfig, /\/api\/crash\/mobile\/beat-audio\/\*\*/);
assert.match(nextConfig, /@ffmpeg-installer\/linux-x64\/ffmpeg/);
assert.doesNotMatch(nextConfig, /@ffmpeg-installer\/\*\*/);
assert.match(genFile, /STILL_CACHE_CONTROL/);
assert.doesNotMatch(genFile, /no-store/);
assert.match(world, /STILL_CACHE_CONTROL/);
assert.match(style, /STILL_CACHE_CONTROL/);
assert.match(cloudMedia, /STILL_CACHE_CONTROL/);
assert.match(cloudShelf, /STILL_CACHE_CONTROL/);

console.log("check-deploy-image-speed: ok");
