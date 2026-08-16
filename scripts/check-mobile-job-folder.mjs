import assert from "node:assert/strict";
import { jobHasEpisodePack, mobileCandidateFolders, mobileMediaFolder } from "../src/lib/mobileJobFolder.ts";
import { mobileLocationStillUrl, mobileMediaFolderName } from "../src/lib/mobileCandidateUrls.ts";
import {
  allCastApproved,
  allLocationsApproved,
  approvedCandidateFileName,
  directorNote,
  keepCandidateTakes,
  dropCandidateTake,
  faceCandidateTakes,
  isCharacterPlateFileName,
  latestCandidate,
  phaseAfterScreenplay,
  canLockEpisode,
  preferredCandidate,
  candidateLookPrompt,
} from "../src/lib/mobileJobReady.ts";
import { screenplaySceneCount } from "../src/lib/mobileScreenplaySize.ts";
import { MOBILE_LAST_JOB_KEY, readResumedJobId } from "../src/lib/mobileJobResume.ts";

const firstJob = { id: "mgen_20260816020100_abc", folderName: "" };
assert.equal(mobileMediaFolder(firstJob), firstJob.id);
assert.equal(jobHasEpisodePack(firstJob), false);

const jobIdAsFolder = { id: firstJob.id, folderName: firstJob.id };
assert.equal(mobileMediaFolder(jobIdAsFolder), firstJob.id);
assert.equal(jobHasEpisodePack(jobIdAsFolder), false);

const packed = { id: firstJob.id, folderName: "CURSOR_THE_PROJECT_PITCH" };
assert.equal(mobileMediaFolder(packed), "CURSOR_THE_PROJECT_PITCH");
assert.equal(jobHasEpisodePack(packed), true);

assert.equal(jobHasEpisodePack({ id: firstJob.id, folderName: "   " }), false);

assert.equal(screenplaySceneCount(0), 1);
assert.equal(screenplaySceneCount(1), 1);
assert.equal(screenplaySceneCount(3), 3);

assert.equal(mobileMediaFolderName(firstJob), firstJob.id);
const locUrl = mobileLocationStillUrl(
  { id: firstJob.id, styleId: "skidmarks", folderName: "" },
  "mloc_desert.png",
);
assert.ok(locUrl.includes("/api/crash/mobile/location-still"));
assert.ok(locUrl.includes(encodeURIComponent(firstJob.id)));
assert.ok(!locUrl.includes("/api/crash/gen/file"));

const picked = {
  speakers: ["Tomato"],
  castCandidates: { Tomato: [{ id: "1", approved: true }] },
  scenes: [{ id: "scene_1" }],
  locationCandidates: { scene_1: [{ id: "2", approved: true }] },
};
assert.equal(allCastApproved(picked), true);
assert.equal(allLocationsApproved(picked), true);
assert.equal(phaseAfterScreenplay(picked), "plates");
assert.equal(
  allCastApproved({ ...picked, speakers: ["TOMATO"] }),
  true,
);
assert.equal(
  phaseAfterScreenplay({ ...picked, speakers: ["Tomato", "Kim"] }),
  "cast_images",
);
assert.equal(
  phaseAfterScreenplay({
    ...picked,
    scenes: [{ id: "scene_1" }, { id: "scene_2" }],
  }),
  "location_images",
);

assert.deepEqual(mobileCandidateFolders(firstJob), [firstJob.id]);
assert.deepEqual(mobileCandidateFolders(jobIdAsFolder), [firstJob.id]);
assert.deepEqual(mobileCandidateFolders(packed), [firstJob.id, "CURSOR_THE_PROJECT_PITCH"]);

const tomatoFace = "face_tomato.png";
const holeStill = "mloc_hole.png";
assert.equal(
  approvedCandidateFileName(
    { Tomato: [{ id: "1", fileName: tomatoFace, approved: true }] },
    "TOMATO",
  ),
  tomatoFace,
);
assert.equal(
  approvedCandidateFileName(
    { scene_1: [{ id: holeStill, fileName: holeStill, approved: true }] },
    "scene_1",
  ),
  holeStill,
);
assert.equal(
  approvedCandidateFileName(
    { Tomato: [{ id: "1", fileName: tomatoFace, approved: false }] },
    "Tomato",
  ),
  null,
);

const first = { id: "1", fileName: "jo_1.png", approved: false, prompt: "grumpy dad Jo" };
const raccoon = { id: "2", fileName: "jo_2.png", approved: false, prompt: "more feral" };
const kept = keepCandidateTakes([first], [raccoon]);
assert.equal(kept.length, 2);
assert.equal(kept[0].prompt, "grumpy dad Jo");
assert.equal(latestCandidate(kept).fileName, "jo_2.png");
assert.equal(keepCandidateTakes(kept, [raccoon]).length, 2);
assert.deepEqual(
  dropCandidateTake(kept, raccoon.id).map((c) => c.id),
  [first.id],
);
assert.deepEqual(dropCandidateTake(kept, "missing").map((c) => c.id), [first.id, raccoon.id]);
assert.deepEqual(dropCandidateTake(undefined, "x"), []);
assert.equal(isCharacterPlateFileName("plate_baby.jpg"), true);
assert.equal(isCharacterPlateFileName("plate_crazy_jo.png"), true);
assert.equal(isCharacterPlateFileName("face_tomato.png"), false);
assert.equal(isCharacterPlateFileName("cplate_20260808000108230_nu2.png"), false);
assert.equal(
  faceCandidateTakes([
    { id: "1", fileName: "face_jo.png" },
    { id: "2", fileName: "plate_jo.png" },
    { id: "3", fileName: "jo_more.jpg" },
  ]).map((c) => c.id).join(","),
  "1,3",
);
assert.equal(
  directorNote("more like a grumpy dad", "weathered scowling Jo"),
  "weathered scowling Jo. more like a grumpy dad",
);
assert.equal(directorNote("weathered scowling Jo. more like a grumpy dad", "weathered scowling Jo"), "weathered scowling Jo. more like a grumpy dad");
assert.equal(directorNote("", "weathered scowling Jo"), "weathered scowling Jo");

const teeTakes = [
  { id: "a", approved: false, prompt: "first tee" },
  { id: "b", approved: true, prompt: "A lovely overweight but bubbly middle aged woman" },
];
assert.equal(preferredCandidate(teeTakes)?.id, "b");
assert.equal(preferredCandidate(teeTakes)?.prompt, "A lovely overweight but bubbly middle aged woman");
assert.equal(preferredCandidate([{ id: "only", approved: false, prompt: "last" }])?.prompt, "last");

assert.equal(MOBILE_LAST_JOB_KEY, "skidmarks.mobile.lastJobId");
assert.equal(
  readResumedJobId("?job=mgen_20260816055919862_906", { getItem: () => "other" }),
  "mgen_20260816055919862_906",
);
assert.equal(
  readResumedJobId("", { getItem: (k) => (k === MOBILE_LAST_JOB_KEY ? "mgen_from_store" : null) }),
  "mgen_from_store",
);
assert.equal(readResumedJobId("", { getItem: () => null }), "");
assert.equal(canLockEpisode("plates"), true);
assert.equal(canLockEpisode("review"), true);
assert.equal(canLockEpisode("animate"), false);
assert.equal(
  candidateLookPrompt(
    { MATTY: [{ approved: true, prompt: "beard, anchor tattoo" }] },
    "matty",
  ),
  "beard, anchor tattoo",
);

console.log("check-mobile-job-folder: ok");
