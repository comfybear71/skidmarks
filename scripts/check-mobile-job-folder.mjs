import assert from "node:assert/strict";
import { jobHasEpisodePack, mobileCandidateFolders, mobileMediaFolder } from "../src/lib/mobileJobFolder.ts";
import { mobileLocationStillUrl, mobileMediaFolderName } from "../src/lib/mobileCandidateUrls.ts";
import {
  allCastApproved,
  allLocationsApproved,
  approvedCandidateFileName,
  phaseAfterScreenplay,
} from "../src/lib/mobileJobReady.ts";
import { screenplaySceneCount } from "../src/lib/mobileScreenplaySize.ts";

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

console.log("check-mobile-job-folder: ok");
