import assert from "node:assert/strict";
import { ASSIST_CONSENT_LOCK } from "../src/lib/mobileAssistConsent.ts";
import { platePositionAssistHint } from "../src/lib/mobileAssist.ts";

assert.match(ASSIST_CONSENT_LOCK, /into it/i);
assert.match(ASSIST_CONSENT_LOCK, /rape/i);
assert.match(ASSIST_CONSENT_LOCK, /pinning/i);
assert.match(ASSIST_CONSENT_LOCK, /holding someone down/i);

const hint = platePositionAssistHint({
  people: ["Crazy Jo"],
  placeName: "Jo's bedroom (the cell)",
  placeLook: "high-set Darwin house, cot, flywire",
  looks: [{ name: "Crazy Jo", look: "wild Territory woman" }],
});
assert.match(hint, /Crazy Jo/);
assert.match(hint, /Jo's bedroom/);
assert.match(hint, /wild Territory woman/);
assert.match(hint, /this room/i);

console.log("check-mobile-assist: ok");
