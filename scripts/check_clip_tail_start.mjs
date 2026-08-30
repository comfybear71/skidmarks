/** Run: npx tsx scripts/check_clip_tail_start.mjs */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  clipTailPlateFileName,
  clipTailPlateLabel,
  previousDoneClipOnStill,
  shouldChainClipTail,
} from "../src/lib/clipTailStart.ts";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(clipTailPlateFileName("gclip_abc.mp4") === "tail_gclip_abc.jpg", "tail name");
assert(clipTailPlateLabel(1) === "Last frame · clip 1", "label");

const clips = [
  { shotId: "shotA", clipFile: "gclip_one.mp4", clipStatus: "done" },
  { shotId: "shotA~still2", clipFile: "", clipStatus: "pending" },
];
const prior = previousDoneClipOnStill(clips, "shotA~still2");
assert(prior?.clipFile === "gclip_one.mp4", "extra hang finds clip 1");
assert(shouldChainClipTail({ shotId: "shotA~still2", clips }), "chain when clip 1 exists");
assert(!shouldChainClipTail({ shotId: "shotA", clips: [] }), "no chain without a clip");

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const song = readFileSync(join(root, "src/app/api/crash/mobile/song/route.ts"), "utf8");
assert(song.includes("resolveStartPlateForNextClip"), "song run uses last frame for clip 2");

const hole = readFileSync(join(root, "src/components/mobile/GrokImagineHole.tsx"), "utf8");
assert(hole.includes("/api/crash/mobile/clip-tail"), "hole pulls last frame");
assert(hole.includes("Clip 2 starts from clip 1 last frame"), "hole says clip 2");

const track = readFileSync(join(root, "src/components/mobile/MusicVideoTrack.tsx"), "utf8");
assert(track.includes("clip-tail"), "Send pulls last frame when clip 1 exists");

console.log("check_clip_tail_start: ok");
