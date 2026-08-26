import {
  looksLikeLocalFilePath,
  shotFootageRole,
  stockSearchLinks,
  stockSearchQuery,
} from "../src/lib/stockFootage.ts";
import { hangDoneClipOnTrack } from "../src/lib/stockClipHang.ts";

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
assert(links.length === 4, "four search sites");
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

console.log("stock footage checks passed");
