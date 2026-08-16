import assert from "node:assert/strict";
import { jobHasEpisodePack, mobileMediaFolder } from "../src/lib/mobileJobFolder.ts";
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

console.log("check-mobile-job-folder: ok");
