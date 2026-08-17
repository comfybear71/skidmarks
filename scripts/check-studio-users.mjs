/** Run: npx tsx scripts/check-studio-users.mjs */
import assert from "node:assert/strict";
import {
  findStudioUserByEmail,
  isStudioPublicPath,
  parseStudioUsers,
  passwordsMatch,
  studioUsersConfigured,
} from "../src/lib/studioUsers.ts";

const prev = process.env.STUDIO_USERS;
delete process.env.STUDIO_USERS;

assert.equal(studioUsersConfigured(), false);
assert.equal(isStudioPublicPath("/"), true);
assert.equal(isStudioPublicPath("/login"), true);
assert.equal(isStudioPublicPath("/api/studio/login"), true);
assert.equal(isStudioPublicPath("/m"), false);
assert.equal(isStudioPublicPath("/m?job=mgen_20260816055919862_906"), false);
assert.equal(isStudioPublicPath("/scratch"), false);
assert.equal(isStudioPublicPath("/crash"), false);
assert.equal(isStudioPublicPath("/api/crash/mobile/job"), false);

process.env.STUDIO_USERS = "stuie@x.com:secret,mum@x.com:other";
assert.equal(studioUsersConfigured(), true);
assert.equal(parseStudioUsers().length, 2);
assert.equal(findStudioUserByEmail("StuIe@x.com")?.id, "stuie");
assert.equal(findStudioUserByEmail("mum@x.com")?.email, "mum@x.com");
assert.equal(passwordsMatch("secret", "secret"), true);
assert.equal(passwordsMatch("secret", "other"), false);
assert.equal(findStudioUserByEmail("stranger@x.com"), null);

if (prev == null) delete process.env.STUDIO_USERS;
else process.env.STUDIO_USERS = prev;

console.log("check-studio-users: ok");
