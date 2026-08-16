import assert from "node:assert/strict";
import { jobHasEpisodePack, mobileMediaFolder } from "../src/lib/mobileJobFolder.ts";
import { mobileLocationStillUrl, mobileMediaFolderName } from "../src/lib/mobileCandidateUrls.ts";

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

assert.equal(mobileMediaFolderName(firstJob), firstJob.id);
const locUrl = mobileLocationStillUrl(
  { id: firstJob.id, styleId: "skidmarks", folderName: "" },
  "mloc_desert.png",
);
assert.ok(locUrl.includes("/api/crash/mobile/location-still"));
assert.ok(locUrl.includes(encodeURIComponent(firstJob.id)));
assert.ok(!locUrl.includes("/api/crash/gen/file"));

console.log("check-mobile-job-folder: ok");
