import assert from "node:assert/strict";
import { ASSIST_CONSENT_LOCK } from "../src/lib/mobileAssistConsent.ts";

assert.match(ASSIST_CONSENT_LOCK, /into it/i);
assert.match(ASSIST_CONSENT_LOCK, /rape/i);
assert.match(ASSIST_CONSENT_LOCK, /pinning/i);
assert.match(ASSIST_CONSENT_LOCK, /holding someone down/i);

console.log("check-mobile-assist: ok");
