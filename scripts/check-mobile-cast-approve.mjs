/** Run: npx tsx scripts/check-mobile-cast-approve.mjs */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const candidates = readFileSync(join(here, "../src/lib/mobileCandidates.ts"), "utf8");
const route = readFileSync(join(here, "../src/app/api/crash/mobile/candidates/route.ts"), "utf8");

assert.match(candidates, /resolveMobileMediaByFilename/);
assert.match(candidates, /altFolders/);
assert.match(candidates, /Faces often live under the job id/);
assert.match(route, /mobileCandidateFolders\(job\)/);
assert.match(route, /approveCastCandidate\(/);
assert.match(route, /generateCastCandidates\(/);
{
  const approveCall = route.slice(route.indexOf("approveCastCandidate("), route.indexOf("approveCastCandidate(") + 400);
  assert.match(approveCall, /mobileCandidateFolders\(job\)/);
}

console.log("check-mobile-cast-approve: ok");
