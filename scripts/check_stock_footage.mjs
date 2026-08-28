import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  looksLikeLocalFilePath,
  shotFootageRole,
  stockSearchLinks,
  stockSearchQuery,
} from "../src/lib/stockFootage.ts";
import { clipOwnsHangPlate, hangDoneClipOnTrack } from "../src/lib/stockClipHang.ts";
import {
  composeStockSearchQuery,
  parseStockLook,
  stockLookFoldLabel,
  stockLookIsOn,
} from "../src/lib/stockLook.ts";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(shotFootageRole({}) === "hero", "omitted role is hero");
assert(shotFootageRole({ footageRole: "support" }) === "support", "support tags");
assert(shotFootageRole({ footageRole: "nope" }) === "hero", "junk role is hero");

assert(
  stockSearchQuery({ title: "Seed", summary: "frost", staging: "void" }) ===
    "Seed frost void",
  "query falls back to shot words",
);
assert(
  stockSearchQuery({ title: "Seed", stockQuery: "ice drop" }) === "ice drop",
  "typed query wins",
);

const links = stockSearchLinks("frozen seed");
assert(links.length === 5, "five search sites");
assert(links.some((l) => l.id === "mixkit"), "Mixkit is in the free list");
assert(links.every((l) => l.href.includes("frozen")), "query is in each URL");
assert(
  links.find((l) => l.id === "pexels")?.href.includes("/search/videos/"),
  "Pexels video search",
);

assert(looksLikeLocalFilePath("C:\\\\Users\\\\Stuie\\\\clip.mp4"), "windows path");
assert(looksLikeLocalFilePath("/Users/stuie/clip.mp4"), "mac path");
assert(!looksLikeLocalFilePath("frozen seed ice"), "search words are not a path");

const hung = hangDoneClipOnTrack({
  song: {
    fileName: "song.mp3",
    durationSec: 100,
    sliceStartSec: 0,
    sliceDurationSec: 15,
    plateTimings: [{ plateId: "shot_a", startMs: 1000, endMs: 9000, sortIndex: 0 }],
    cuts: [],
  },
  shotId: "shot_a",
  plateFile: "plate.jpg",
  clipFile: "/tmp/01_stock_Seed.mp4",
  newCutId: () => "cut_1",
});
assert(hung?.cuts?.[0]?.clipFile === "01_stock_Seed.mp4", "hang uses basename");
assert(hung?.cuts?.[0]?.status === "done", "hang marks done");
assert(hung?.cuts?.[0]?.startSec === 1, "hang keeps existing clock");

const noClock = hangDoneClipOnTrack({
  song: {
    fileName: "song.mp3",
    durationSec: 100,
    sliceStartSec: 0,
    sliceDurationSec: 15,
    plateTimings: [],
    cuts: [{ id: "c1", plateFile: "p.jpg", shotId: "shot_b", startSec: 4, durationSec: 8 }],
  },
  shotId: "shot_b",
  plateFile: "p.jpg",
  clipFile: "stock.mp4",
  newCutId: () => "cut_x",
});
assert(noClock?.cuts?.[0]?.clipFile === "stock.mp4", "stamps existing cut");
assert((noClock?.plateTimings || []).length === 0, "does not invent timings");

assert(clipOwnsHangPlate("shot_a", "shot_a"), "same still can hang");
assert(clipOwnsHangPlate("", "shot_b"), "stock hang has no owner shot");
assert(!clipOwnsHangPlate("shot_a", "shot_b"), "do not hang this cook on the next still");

const cloned = hangDoneClipOnTrack({
  song: hung,
  shotId: "shot_b",
  plateFile: "other.jpg",
  clipFile: "01_stock_Seed.mp4",
  newCutId: () => "cut_2",
});
assert(
  (cloned?.cuts || []).filter((c) => c.clipFile === "01_stock_Seed.mp4").length === 1,
  "same mp4 does not land on a second plate",
);

const otherOwner = hangDoneClipOnTrack({
  song: {
    fileName: "song.mp3",
    durationSec: 100,
    sliceStartSec: 0,
    sliceDurationSec: 15,
    plateTimings: [{ plateId: "shot_b", startMs: 9000, endMs: 18000, sortIndex: 1 }],
    cuts: [],
  },
  shotId: "shot_b",
  plateFile: "other.jpg",
  clipFile: "01_JACK_GHOST.mp4",
  newCutId: () => "cut_x",
  ownerShotId: "shot_a",
});
assert(
  (otherOwner?.cuts || []).every((c) => c.clipFile !== "01_JACK_GHOST.mp4"),
  "owner still wins — do not attach to the next still",
);


const ww1 = parseStockLook({
  theme: "first world war",
  colour: "mud brown grain",
  types: "trenches archival",
});
assert(stockLookIsOn(ww1), "WWI look is on");
assert(stockLookFoldLabel(ww1) === "first world war", "fold shows theme");
assert(
  composeStockSearchQuery(ww1, "hospital ward") ===
    "first world war mud brown grain trenches archival hospital ward",
  "look rides in front of the shot words",
);

const nature = parseStockLook({ theme: "nature", colour: "", types: "forest river" });
assert(
  composeStockSearchQuery(nature, "aerial") === "nature forest river aerial",
  "nature topic composes",
);
const space = parseStockLook({ theme: "space", colour: "deep black", types: "stars nebula" });
assert(
  composeStockSearchQuery(space, "") === "space deep black stars nebula",
  "space topic composes with no shot extra",
);
assert(composeStockSearchQuery(null, "ice drop") === "ice drop", "empty look leaves shot query");
assert(!stockLookIsOn(parseStockLook({})), "blank look is off");

const here = dirname(fileURLToPath(import.meta.url));
const panel = readFileSync(join(here, "../src/components/StockFootagePanel.tsx"), "utf8");
assert(panel.includes("Nobody"), "Nobody sits next to HERO/SUPPORT");
assert(panel.includes("onNobodyChange"), "Nobody is optional — desk storyboard stays as-is");
const songUi = readFileSync(join(here, "../src/components/mobile/MusicVideoSongCuts.tsx"), "utf8");
const trackUi = readFileSync(join(here, "../src/components/mobile/MusicVideoTrack.tsx"), "utf8");
assert(songUi.includes('label="Free look"'), "free look fold is under Song list");
assert(!trackUi.includes('label="Free look"'), "free look fold is not on TRACK");

console.log("stock footage checks passed");
