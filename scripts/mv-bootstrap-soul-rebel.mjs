/**
 * New SOUL REBEL music video job — band + locations cloned from Jack job.
 * Run: node scripts/mv-bootstrap-soul-rebel.mjs [--from-job JACK_JOB_ID]
 */
const BASE = process.env.MOBILE_API_BASE || "http://localhost:3737";
const FROM_JOB = process.argv.includes("--from-job")
  ? process.argv[process.argv.indexOf("--from-job") + 1]
  : "mgen_20260822085033162_0ud";

async function api(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `${res.status} ${path}`);
  return data;
}

async function getJob(id) {
  const res = await fetch(`${BASE}/api/crash/mobile/job/${id}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "job fetch failed");
  return data.job;
}

async function main() {
  const jack = await getJob(FROM_JOB);
  const { job: created } = await api("/api/crash/mobile/job", {
    prompt: "SKIDS_MUSIC_TV",
    styleId: "music_video",
    artist: "SOUL REBEL",
    songTitle: "SOUL REBEL",
    deskId: "stuie",
  });
  console.log("Created job:", created.id);

  let job = (await api("/api/crash/mobile/bands", {
    action: "apply",
    jobId: created.id,
    name: "SOUL REBEL",
  })).job;
  console.log("Cast:", job.speakers);

  for (const scene of jack.scenes) {
    const res = await fetch(`${BASE}/api/crash/mobile/candidates`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "add",
        kind: "location",
        jobId: created.id,
        name: scene.placeName,
      }),
    });
    const data = await res.json();
    if (!res.ok) console.log("  location warn:", data.error);
    else job = data.job || job;
  }
  console.log("Locations:", job.scenes?.length);

  const lyrics =
    "[Intro]\n\n[Verse 1] Soul rebel in the neon rain\nStanding centre-left against the pain\n\n[Chorus] Rebel soul, rebel heart\nEvery plate a brand new start";
  await api("/api/crash/mobile/song", {
    action: "set-lyrics",
    jobId: created.id,
    lyrics,
  });

  console.log("\nNext on phone:");
  console.log(`  ${BASE.replace("localhost:3737", "skidmarks.aiglitch.app")}/m?job=${created.id}`);
  console.log("  1. Drop the SOUL REBEL mp3");
  console.log("  2. Start the video");
  console.log("  3. Run: node scripts/mv-band-plates.mjs --job", created.id, "--members SOUL REBEL,CENTRE-LEFT,FAR-LEFT,RIGHT-SIDE --ltx --stitch");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
