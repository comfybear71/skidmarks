import {
  buildScratchSongLtxMotion,
  isHummingDefaultMotion,
  isSingingDefaultMotion,
  looksLikeCameraSlotName,
  pickSongSendMotionBody,
  skipSongLipSyncLead,
  stillNamesMicrophone,
} from "../src/lib/mobileImageMotion.ts";

const hum = buildScratchSongLtxMotion({
  styleId: "music_video",
  speaker: "CENTRE-LEFT",
  lookLock: "A medium portrait shot of an Afro-Caribbean woman with a microphone",
  staging: "singing into a vintage microphone",
  performance: "hum",
});
const sing = buildScratchSongLtxMotion({
  styleId: "music_video",
  speaker: "SOUL REBEL",
  lookLock: "dreadlocks, beard, beanie",
  staging: "Empty hands. No instrument.",
  performance: "sing",
});
const picked = pickSongSendMotionBody({
  stored: sing,
  storedUsable: true,
  singing: true,
  singingDefault: sing,
  speakingDefault: "",
  hum: true,
  humDefault: hum,
});
const checks = [
  ["camera slot", looksLikeCameraSlotName("CENTRE-LEFT") === true],
  ["hum not sing words", !/singing, lip-sync/.test(hum) && /soft hum/.test(hum)],
  ["hum name not camera", !/CENTRE-LEFT/.test(hum) && /The performer/.test(hum)],
  ["hum keeps mic", /Same microphone as the start image/.test(hum) && !/No microphone/.test(hum)],
  ["hum lock", isHummingDefaultMotion(hum) && !isSingingDefaultMotion(hum)],
  [
    "skip lip-sync lead",
    skipSongLipSyncLead({ speaker: "A", performance: "hum", singing: true }) === true,
  ],
  ["mic detect", stillNamesMicrophone("vintage microphone") === true],
  ["pick dumps sing", !/sings this slice/.test(picked)],
  ["soul rebel still sings", /sings this slice/.test(sing) && /SOUL REBEL/.test(sing)],
];
const bad = checks.filter(([, ok]) => !ok).map(([name]) => name);
if (bad.length) {
  console.error("FAIL", bad);
  console.error("--- hum ---\n", hum);
  process.exit(1);
}
console.log("ok", checks.length, "checks");
console.log(hum.slice(0, 240));
