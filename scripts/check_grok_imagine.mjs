/** Run: npx tsx scripts/check_grok_imagine.mjs */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  GROK_IMAGINE_IMAGE_MODEL,
  GROK_IMAGINE_VIDEO_MODEL,
  composeGrokImagineMotion,
  grokImagineFoldSummary,
  grokImagineMotionLooksLike,
  grokPlatesForShot,
  normalizeGrokImagineSettings,
  parseGrokImagineMode,
  parseGrokImagineVideoRes,
  snapGrokImagineDurationSec,
} from "../src/lib/grokImagine.ts";
import { resolveGrokClipRefs } from "../src/lib/grokScratchClip.ts";
import { parseMuteMvEngine, resolveMvSendEngine } from "../src/lib/mobileImageMotion.ts";
import { cookDurationFromHungBar } from "../src/lib/musicVideoTrack.ts";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(parseMuteMvEngine("grok") === "grok", "parse grok");
assert(resolveMvSendEngine({ jobId: "j", picked: "grok" }) === "grok", "picked grok");
assert(parseGrokImagineMode("image") === "image", "image mode");
assert(GROK_IMAGINE_IMAGE_MODEL === "grok-imagine-image-2.0", "image 2.0");
assert(GROK_IMAGINE_VIDEO_MODEL === "grok-imagine-video-1.5", "video 1.5 — no 2.0 yet");
assert(snapGrokImagineDurationSec(40) === 15, "video max 15");
assert(snapGrokImagineDurationSec(6) === 6, "6 stays 6");
assert(parseGrokImagineVideoRes("1080p") === "720p", "desk locks 720p");
assert(
  normalizeGrokImagineSettings({ prompt: "Slowly " }).prompt === "Slowly ",
  "prompt keeps the space while typing",
);

const composed = composeGrokImagineMotion({
  mode: "image",
  prompt: "rainbow fluid",
  plateFile: "p.png",
  imageRes: "2k",
  videoRes: "720p",
  durationSec: 10,
  aspect: "16:9",
  keepAudio: false,
});
assert(grokImagineMotionLooksLike(composed), "looks like GROK");
assert(!/Use the provided start image/i.test(composed), "not an LTX lock");
assert(/not LTX/i.test(grokImagineFoldSummary()), "fold says not LTX");

const ten = cookDurationFromHungBar({ startMs: 0, endMs: 10000 }, "grok");
assert(!("error" in ten) && ten.durationSec === 10, "GROK uses hung 10s");
const forty = cookDurationFromHungBar({ startMs: 0, endMs: 40000 }, "grok");
assert(!("error" in forty) && forty.durationSec === 15, "GROK 40s bar snaps to 15");

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const song = readFileSync(join(root, "src/app/api/crash/mobile/song/route.ts"), "utf8");
assert(song.includes("submitScratchGrokClip"), "song run submits GROK");
assert(song.includes("finishScratchGrokClip"), "song poll finishes GROK");
assert(song.includes('clipPick === GROK_I2V_ID'), "GROK is not LTX fallthrough");

const imagine = readFileSync(join(root, "src/app/api/crash/mobile/imagine/route.ts"), "utf8");
assert(imagine.includes("grok-imagine-image-2.0") || imagine.includes("GROK_IMAGINE_IMAGE_MODEL"), "imagine still is 2.0");
assert(imagine.includes("generateImagineImage"), "imagine uses Image 2.0 helper");

const track = readFileSync(join(root, "src/components/mobile/MusicVideoTrack.tsx"), "utf8");
assert(track.includes("sendGrokImagineImage"), "image Send");
assert(track.includes("sendGrokVideo"), "video Send");
assert(track.includes("clipEngine: GROK_I2V_ID"), "video uses grok engine");

const imageGen = readFileSync(join(root, "src/lib/imageGen.ts"), "utf8");
assert(imageGen.includes("grok-imagine-image-2.0"), "2.0 model in imageGen");
assert(imageGen.includes("export async function generateImagineImage"), "dedicated 2.0 helper");
assert(imageGen.includes('model: "grok-imagine-image"'), "face/plate cooks stay on old model");

const scratch = readFileSync(join(root, "src/lib/grokScratchClip.ts"), "utf8");
assert(scratch.includes("hangPlateShotId"), "GROK strips extra hang ids");
assert(scratch.includes("storyShotForSongCut"), "GROK uses story stills");
assert(
  !scratch.includes('throw new Error("Scratch plate is not on this job")'),
  "GROK no longer requires a Scratch pad row",
);
assert(song.includes("cut.plateFile"), "song run passes the hung plate file");

const holePlates = grokPlatesForShot(
  { plateFile: "buddha.png", title: "MEDITATING BUDDHA FOREST", plateTakes: [] },
  [{ fileName: "place.png", title: "Place still" }],
);
assert(holePlates[0]?.fileName === "buddha.png", "hole leads with this plate");
assert(
  holePlates.some((p) => p.fileName === "place.png"),
  "hole also offers the place still",
);

const storyOnly = resolveGrokClipRefs({
  job: {
    id: "j",
    styleId: "music_video",
    folderName: "PACK",
    shots: [],
    clips: [],
    scratchSong: { fileName: "song.mp3" },
  },
  story: {
    scenes: [
      {
        id: "sc1",
        shots: [
          {
            id: "shotA",
            title: "BUD",
            plateFile: "buddha.png",
            beats: [{ id: "b1", speaker: "", text: "" }],
            sfx: [],
          },
        ],
      },
    ],
  },
  shotId: "shotA~still2",
  sceneId: "",
  beatId: "song-cut",
});
assert(storyOnly.plateFile === "buddha.png", "story plate without job.shots");
assert(storyOnly.stillId === "shotA", "extra hang strips to the still");
assert(storyOnly.beat, "music-video beat is not required on the pad");

const hole = readFileSync(join(root, "src/components/mobile/GrokImagineHole.tsx"), "utf8");
assert(!hole.includes("480p"), "no 480p chip");
assert(!hole.includes("1080p"), "no 1080p chip");
assert(!hole.includes("16:9"), "no aspect chips");
assert(hole.includes("GrokSpeakerIcon"), "audio is a speaker icon");
assert(hole.includes("e.stopPropagation()"), "space is not stolen from the box");

console.log("check_grok_imagine: ok");
