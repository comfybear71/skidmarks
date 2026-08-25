/**
 * Pure checks for store ZIP + CRC.
 * Run: node --experimental-strip-types scripts/test_ordered_clips.mts
 */
import assert from "node:assert/strict";
import { buildStoreZip, crc32 } from "../src/lib/zipStore.ts";

const zip = buildStoreZip([
  { name: "01_RIVER_wide.mp4", data: Buffer.from("abc") },
  { name: "02_DRIFTER_mcu.mp4", data: Buffer.from("xyz") },
]);
assert.equal(zip.subarray(0, 4).toString("hex"), "504b0304");
assert.ok(zip.includes(Buffer.from("01_RIVER_wide.mp4")));
assert.ok(zip.includes(Buffer.from("02_DRIFTER_mcu.mp4")));
assert.equal(crc32(Buffer.from("abc")), 0x352441c2);
assert.equal(crc32(Buffer.from("xyz")), 0xeb8eba67);

console.log("store zip: ok");
