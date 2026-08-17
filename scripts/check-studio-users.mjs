/** Run: npx tsx scripts/check-studio-users.mjs
 * (Node type-stripping cannot follow extensionless TS imports in this file.) */
import assert from "node:assert/strict";
import {
  HOME_OWNER_ID,
  findStudioUserByEmail,
  homeOwnerId,
  isHomeOwner,
  isStudioPublicPath,
  parseStudioUsers,
  passwordsMatch,
  studioUsersConfigured,
} from "../src/lib/studioUsers.ts";
import {
  jobBelongsToOwner,
  ownedEpisodeRowId,
  ownedShowFileRowId,
  ownerStoragePrefix,
} from "../src/lib/studioOwner.ts";

const prev = process.env.STUDIO_USERS;
delete process.env.STUDIO_USERS;

assert.equal(studioUsersConfigured(), false);
assert.equal(homeOwnerId(), HOME_OWNER_ID);
assert.equal(ownerStoragePrefix("stuie"), "");
assert.equal(ownerStoragePrefix("mum"), "users/mum/");
assert.equal(ownedEpisodeRowId("skidmarks", "PILOT", "stuie"), "skidmarks/PILOT");
assert.equal(ownedEpisodeRowId("skidmarks", "PILOT", "mum"), "mum/skidmarks/PILOT");
assert.equal(
  ownedShowFileRowId("skidmarks", "cast", "thumb.png", "mum"),
  "mum/skidmarks/cast/thumb.png",
);
assert.equal(isStudioPublicPath("/login"), true);
assert.equal(isStudioPublicPath("/api/studio/login"), true);
assert.equal(isStudioPublicPath("/m"), false);
assert.equal(isStudioPublicPath("/api/crash/mobile/job"), false);

process.env.STUDIO_USERS = "stuie@x.com:secret,mum@x.com:other";
assert.equal(studioUsersConfigured(), true);
assert.equal(homeOwnerId(), "stuie");
assert.equal(findStudioUserByEmail("Mum@x.com")?.id, "mum");
assert.equal(isHomeOwner("stuie"), true);
assert.equal(isHomeOwner("mum"), false);
assert.equal(ownerStoragePrefix(homeOwnerId()), "");
assert.equal(ownerStoragePrefix("mum"), "users/mum/");
assert.equal(passwordsMatch("secret", "secret"), true);
assert.equal(passwordsMatch("secret", "other"), false);

assert.equal(jobBelongsToOwner({}, "stuie"), true);
assert.equal(jobBelongsToOwner({ deskId: "stuie" }, "mum"), false);
assert.equal(jobBelongsToOwner({ ownerId: "mum" }, "mum"), true);
assert.equal(jobBelongsToOwner({ ownerId: "stuie" }, "mum"), false);
assert.equal(jobBelongsToOwner({ deskId: "mum" }, "mum"), true);
assert.equal(jobBelongsToOwner({ ownerId: "mum" }, "stuie"), false);

if (prev == null) delete process.env.STUDIO_USERS;
else process.env.STUDIO_USERS = prev;

console.log("check-studio-users: ok");
