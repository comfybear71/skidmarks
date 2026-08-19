/** Run: npx tsx scripts/check-ltx-25-flf2v-research.mjs */
import assert from "node:assert/strict";
import {
  LTX_25_FLF2V_DEFAULTS,
  LTX_25_FLF2V_HUB_HASH,
  LTX_25_FLF2V_MODELS,
  LTX_25_FLF2V_PROMPT_LOCK,
  LTX_25_FLF2V_SIGMAS,
  LTX_25_FLF2V_SUBGRAPH_ID,
  ltxFlf2vFrameCount,
} from "../src/lib/ltxFlf2vResearch.ts";
import { archiveEntry } from "../src/lib/plateAutomationArchive.ts";

assert.equal(LTX_25_FLF2V_HUB_HASH, "d78377cf53f4");
assert.equal(LTX_25_FLF2V_SUBGRAPH_ID, "cf70afc4-5a03-47ce-8210-734b1de6c6bc");
assert.equal(LTX_25_FLF2V_DEFAULTS.durationSec, 5);
assert.equal(LTX_25_FLF2V_DEFAULTS.fps, 24);
assert.equal(LTX_25_FLF2V_DEFAULTS.firstGuideFrameIdx, 0);
assert.equal(LTX_25_FLF2V_DEFAULTS.lastGuideFrameIdx, -1);
assert.equal(LTX_25_FLF2V_DEFAULTS.guideStrength, 0.7);
assert.equal(LTX_25_FLF2V_DEFAULTS.videoCfg, 1);
assert.equal(LTX_25_FLF2V_DEFAULTS.audioCfg, 1);
assert.equal(ltxFlf2vFrameCount(5, 24), 121);
assert.equal((121 - 1) % 8, 0, "LTX length must be 8n+1");
assert.equal(LTX_25_FLF2V_SIGMAS.split(",").length, LTX_25_FLF2V_DEFAULTS.sigmaValues);
assert.match(LTX_25_FLF2V_PROMPT_LOCK, /end image as the final frame anchor/);
assert.match(LTX_25_FLF2V_MODELS.unet, /ltx-2\.5-22b-distilled/);

assert.equal(archiveEntry("ltx-25-flf2v-not-speech")?.verdict, "fails");
assert.equal(archiveEntry("ltx-25-flf2v-two-guides")?.verdict, "works");
assert.match(archiveEntry("ltx-25-flf2v-not-speech")?.fix || "", /IA2V/);

console.log("check-ltx-25-flf2v-research: ok");
