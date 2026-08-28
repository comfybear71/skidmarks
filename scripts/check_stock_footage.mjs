import {
  looksLikeLocalFilePath,
  shotFootageRole,
  stockSearchLinks,
  stockSearchQuery,
} from "../src/lib/stockFootage.ts";
import { hangDoneClipOnTrack } from "../src/lib/stockClipHang.ts";
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

const measured = hangDoneClipOnTrack({
  song: {
    fileName: "song.mp3",
    durationSec: 100,
    sliceStartSec: 0,
    sliceDurationSec: 15,
    plateTimings: [{ plateId: "shot_a", startMs: 1000, endMs: 9000, sortIndex: 0 }],
    cuts: [{ id: "c1", plateFile: "p.jpg", shotId: "shot_a", startSec: 1, durationSec: 8 }],
  },
  shotId: "shot_a",
  plateFile: "p.jpg",
  clipFile: "real.mp4",
  durationSec: 8.5,
  newCutId: () => "cut_m",
});
assert(measured?.cuts?.[0]?.durationSec === 8.5, "wave uses probed clip length");
assert(measured?.plateTimings?.[0]?.endMs === 9500, "clock follows the file");

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

console.log("stock footage checks passed");
