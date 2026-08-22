/**
 * Music video — 2 positions × N locations per cast member.
 * Run: node scripts/mv-band-plates.mjs --job JOB_ID --members SAXOPHONE,DRUMMER
 */
const BASE = process.env.MOBILE_API_BASE || "http://localhost:3737";

const SCENE_SHORT = ["SALOON", "Las Vegas", "desert highway"];

function sceneOrder(job) {
  const scenes = job.scenes || [];
  if (!scenes.length) throw new Error("No locations on job");
  return [...scenes].sort((a, b) => {
    const ai = SCENE_SHORT.findIndex((k) => (a.placeName || "").includes(k));
    const bi = SCENE_SHORT.findIndex((k) => (b.placeName || "").includes(k));
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
  });
}

function parseArgs() {
  const args = process.argv.slice(2);
  let jobId = "";
  let members = [];
  let runLtx = false;
  let runStitch = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--job") jobId = args[++i] || "";
    else if (args[i] === "--members") members = (args[++i] || "").split(",").map((s) => s.trim()).filter(Boolean);
    else if (args[i] === "--ltx") runLtx = true;
    else if (args[i] === "--stitch") runStitch = true;
  }
  if (!jobId || !members.length) {
    console.error("Usage: node scripts/mv-band-plates.mjs --job ID --members A,B [--ltx] [--stitch]");
    process.exit(1);
  }
  return { jobId, members, runLtx, runStitch };
}

function singerStaging(speaker, place, variant) {
  if (variant === "a") {
    return [
      `Medium close-up of ${speaker} at ${place}. Upper chest and face fill the frame.`,
      `${speaker} is at the mic stand centre frame at ${place}, front-on to camera, mouth open mid-verse, singing.`,
      "One hand on mic stand. No phone. No crowd.",
      `Only ${speaker} in frame. No other people.`,
    ].join(" ");
  }
  return [
    `Medium shot of ${speaker} at ${place}.`,
    `${speaker} stands three-quarter left at ${place}, one hand on mic stand, body angled toward camera, mouth open singing.`,
    "Weight grounded. No phone. No crowd.",
    `Only ${speaker} in frame. No other people.`,
  ].join(" ");
}

const POSITION_MEMBERS = new Map([
  ["CENTRE-LEFT", "centre-left of frame"],
  ["FAR-LEFT", "far left of frame"],
  ["RIGHT-SIDE", "right side of frame"],
]);

function positionStaging(speaker, place, variant) {
  const who = speaker.trim();
  const pos = POSITION_MEMBERS.get(who) || "centre frame";
  if (variant === "a") {
    return [
      `Medium close-up of ${who} at ${place}.`,
      `${who} stands at the mic ${pos} at ${place}, front-on to camera, mouth open mid-verse, singing.`,
      "One hand on mic stand. No phone. No crowd.",
      `Only ${who} in frame. No other people.`,
    ].join(" ");
  }
  return [
    `Medium shot of ${who} at ${place}.`,
    `${who} at the mic ${pos} at ${place}, three-quarter angle toward camera, mouth open singing.`,
    "Weight grounded. No phone. No crowd.",
    `Only ${who} in frame. No other people.`,
  ].join(" ");
}

function bandStaging(speaker, place, variant) {
  const who = speaker.trim();
  if (variant === "a") {
    return `${who} alone. Only ${who} in frame, no one else appears. At ${place}, centre frame in profile, holding their instrument naturally. NO SINGING — mouth closed, not lip-syncing. No phone. No crowd.`;
  }
  return `${who} alone. Only ${who} in frame, no one else appears. At ${place}, three-quarter angle in profile with instrument visible. NO SINGING — mouth closed. No phone. No crowd.`;
}

function stagingFor(speaker) {
  if (speaker === "SOUL REBEL" || speaker === "JACK GHOST") return singerStaging;
  if (POSITION_MEMBERS.has(speaker)) return positionStaging;
  return bandStaging;
}

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

async function getJob(jobId) {
  const res = await fetch(`${BASE}/api/crash/mobile/job/${jobId}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "job fetch failed");
  return data.job;
}

async function addPlate(jobId, sceneId, speaker, staging) {
  const added = await api("/api/crash/mobile/plate", {
    jobId,
    sceneId,
    speaker,
    action: "add",
  });
  const rebuilt = await api("/api/crash/mobile/plate", {
    jobId,
    shotId: added.shotId,
    staging,
    action: "rebuild",
    qa: true,
  });
  await api("/api/crash/mobile/song", {
    action: "add-plate",
    jobId,
    shotId: added.shotId,
  });
  return { shotId: added.shotId, plateFile: rebuilt.plateFile, qa: rebuilt.qa?.ok };
}

async function runPendingLtx(jobId) {
  let job = await getJob(jobId);
  const cuts = job.scratchSong?.cuts || [];
  for (const cut of cuts.filter((c) => c.status !== "done")) {
    console.log(`  LTX ${cut.id}…`);
    try {
      const out = await api("/api/crash/mobile/song", {
        action: "run",
        jobId,
        cutId: cut.id,
      });
      const done = out.job?.scratchSong?.cuts?.find((c) => c.id === cut.id);
      console.log(`    → ${done?.status}`);
    } catch (e) {
      console.log(`    FAILED: ${e.message}`);
    }
  }
}

async function main() {
  const { jobId, members, runLtx, runStitch } = parseArgs();
  const job = await getJob(jobId);
  if (!job.folderName) throw new Error("Lock the episode first (Start the video)");
  const orderedScenes = sceneOrder(job);
  for (const speaker of members) {
    const stagingFn = stagingFor(speaker);
    console.log(`\n=== ${speaker} ===`);
    for (const scene of orderedScenes) {
      const place = scene.placeName || scene.id;
      for (const variant of ["a", "b"]) {
        const label = variant === "a" ? "centre" : "three-quarter";
        console.log(`  ${place.slice(0, 24)} — ${label}`);
        try {
          const r = await addPlate(jobId, scene.id, speaker, stagingFn(speaker, place, variant));
          console.log(`    ${r.plateFile} qa=${r.qa}`);
        } catch (e) {
          console.log(`    ERROR: ${e.message}`);
        }
      }
    }
  }

  if (runLtx) {
    console.log("\n--- LTX ---");
    await runPendingLtx(jobId);
  }
  if (runStitch) {
    console.log("\n--- Stitch ---");
    const out = await api("/api/crash/mobile/song", { action: "stitch", jobId });
    console.log("stitched:", out.stitchedFile);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
