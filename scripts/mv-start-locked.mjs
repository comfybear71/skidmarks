/**
 * Drop mp3 + Start the video on a music-video job (CLI stand-in for the phone).
 * Run: node scripts/mv-start-locked.mjs --job ID --mp3 /path/to/song.mp3
 */
import fs from "fs";
import path from "path";

const BASE = process.env.MOBILE_API_BASE || "http://localhost:3737";

function parseArgs() {
  const args = process.argv.slice(2);
  let jobId = "";
  let mp3 = "";
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--job") jobId = args[++i] || "";
    else if (args[i] === "--mp3") mp3 = args[++i] || "";
  }
  if (!jobId || !mp3) {
    console.error("Usage: node scripts/mv-start-locked.mjs --job ID --mp3 /path/to/song.mp3");
    process.exit(1);
  }
  return { jobId, mp3: path.resolve(mp3) };
}

async function uploadTrackSong(jobId, mp3Path) {
  const buf = fs.readFileSync(mp3Path);
  const form = new FormData();
  form.set("jobId", jobId);
  form.set("file", new Blob([buf], { type: "audio/mpeg" }), path.basename(mp3Path));
  const res = await fetch(`${BASE}/api/crash/mobile/track/song`, { method: "POST", body: form });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "track/song failed");
  return data;
}

async function startVideo(jobId) {
  const res = await fetch(`${BASE}/api/crash/mobile/music-video/start`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jobId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "start failed");
  return data;
}

async function attachBeat(jobId, beatId, mp3Path) {
  const buf = fs.readFileSync(mp3Path);
  const form = new FormData();
  form.set("jobId", jobId);
  form.set("beatId", beatId);
  form.set("file", new Blob([buf], { type: "audio/mpeg" }), path.basename(mp3Path));
  const res = await fetch(`${BASE}/api/crash/mobile/beat-audio/upload`, { method: "POST", body: form });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "beat attach failed");
  return data;
}

async function main() {
  const { jobId, mp3 } = parseArgs();
  if (!fs.existsSync(mp3)) throw new Error(`mp3 not found: ${mp3}`);

  console.log("Upload track song…");
  const track = await uploadTrackSong(jobId, mp3);
  console.log("  trackDraft:", track.fileName, track.durationSec + "s");

  console.log("Start the video…");
  const started = await startVideo(jobId);
  const beatId = (started.carrierBeatId || "").trim();
  const folder = started.job?.folderName || "";
  console.log("  folderName:", folder);
  console.log("  carrierBeatId:", beatId);

  if (beatId) {
    console.log("Attach mp3 to carrier beat…");
    const attached = await attachBeat(jobId, beatId, mp3);
    console.log("  carrierBeatId on job:", attached.job?.scratchSong?.carrierBeatId || "set");
  }

  console.log("\nReady for plates:");
  console.log(`  node scripts/mv-band-plates.mjs --job ${jobId} --members SOUL REBEL,CENTRE-LEFT,FAR-LEFT,RIGHT-SIDE --ltx --stitch`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
