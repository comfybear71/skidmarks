/** Run: npx tsx scripts/check-ltx-id-lora.mjs */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const graph = JSON.parse(
  readFileSync(join(here, "..", "workflow", "LTX_2.3_IA2V_Cloud.json"), "utf8"),
);

function node(id) {
  const n = graph[id];
  assert.ok(n, `missing node ${id}`);
  return n;
}

function modelSrc(id) {
  const m = node(id).inputs.model;
  assert.ok(Array.isArray(m), `${id} model is not a link`);
  return m[0];
}

assert.equal(node("340:293").class_type, "LoraLoaderModelOnly");
assert.match(node("340:293").inputs.lora_name, /distilled/);
assert.equal(node("340:293").inputs.strength_model, 0.5);

assert.equal(node("340:345").class_type, "LoraLoader");
assert.match(node("340:345").inputs.lora_name, /gemma/);

const idLora = node("340:352");
assert.equal(idLora.class_type, "LoraLoaderModelOnly");
assert.equal(idLora.inputs.lora_name, "ltx-2.3-id-lora-talkvid-3k.safetensors");
assert.equal(idLora.inputs.strength_model, 1);
assert.equal(modelSrc("340:352"), "340:293");

const ref = node("340:353");
assert.equal(ref.class_type, "LTXVReferenceAudio");
assert.equal(modelSrc("340:353"), "340:352");
assert.equal(ref.inputs.reference_audio[0], "276");
assert.equal(ref.inputs.audio_vae[0], "340:335");
assert.equal(ref.inputs.identity_guidance_scale, 3);

assert.equal(modelSrc("340:290"), "340:293");
assert.equal(modelSrc("340:315"), "340:353");

assert.equal(node("269").class_type, "LoadImage");
assert.equal(node("276").class_type, "LoadAudio");

const blob = JSON.stringify(graph);
assert.doesNotMatch(blob, /ic-lora-union/i);
assert.doesNotMatch(blob, /video_ltx2_3_ic_lora/);
assert.doesNotMatch(blob, /plate_\{slug\}/);

const ia2v = readFileSync(join(here, "..", "src/lib/ltxCloudIa2v.ts"), "utf8");
assert.match(ia2v, /Do not swap in plate_\{slug\}/);
assert.match(ia2v, /talkvid-3k @ 1\.0/);

const face = readFileSync(join(here, "..", "src/lib/mobileCharacterPlate.ts"), "utf8");
assert.match(face, /Never the 4-up `plate_\{slug\}` sheet/);

console.log("check-ltx-id-lora: ok");
console.log("id_lora=ltx-2.3-id-lora-talkvid-3k.safetensors strength=1.0 (Hub default; not 0.75 IC-LoRA)");
console.log("chain=317→293 distilled 0.5 → 352 id-lora 1.0 → 353 LTXVReferenceAudio → 315");
console.log("stage1 290 stays distilled-only");
