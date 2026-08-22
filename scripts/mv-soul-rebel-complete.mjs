/**
 * SOUL REBEL — Jungle Juice end-to-end: locations, sections, plates, LTX, stitch.
 * Run: node scripts/mv-soul-rebel-complete.mjs [--from-jack JOB] [--job JOB] [--plates-only]
 */
const BASE = process.env.MOBILE_API_BASE || "http://localhost:3737";
const DEFAULT_JOB = "mgen_20260822222133185_jsv";
const DEFAULT_JACK = "mgen_20260822085033162_0ud";

const LYRICS = `[Intro]

[Verse 1]
The sun coming down on me
the day is going by in history
we dance and playing in the street
the jungle juice taste so sweet

[Chorus]
Gotta gotta get that juice
the hunky funky junge juice ja
we live and play in the jungle jane
totally free from new worlds pain

[CENTRE-LEFT]
[Verse 2]
So let go of pain
A new dawn of fun begins today
You free in this life, so let just play
The jungle juice is alright cool

[Chorus]
Gotta gotta get that juice
the hunky funky junge juice ja
we live and play in the jungle jane
totally free from new worlds pain

[Verse 3]
Well its late right now
We all wanna stay so were jamming now
The play will never stop, enjoy the time
The jungle juice is where u find

[Chorus]
Gotta gotta get that juice
the hunky funky junge juice ja
we live and play in the jungle jane
totally free from new worlds pain

[Outro]
`;

/** User timings on a 2:10 layout — scaled to the real mp3 length. */
const SECTION_ENDS_130S = [15, 30, 45, 59, 73, 100, 115, 130];

function parseArgs() {
  const args = process.argv.slice(2);
  let jobId = DEFAULT_JOB;
  let jackId = DEFAULT_JACK;
  let platesOnly = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--job") jobId = args[++i] || jobId;
    else if (args[i] === "--from-jack") jackId = args[++i] || jackId;
    else if (args[i] === "--plates-only") platesOnly = true;
  }
  return { jobId, jackId, platesOnly };
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

async function getJob(id) {
  const res = await fetch(`${BASE}/api/crash/mobile/job/${id}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "job fetch failed");
  return data.job;
}

function scaleSectionMarkers(durationMs, speakers) {
  const scale = durationMs / 130_000;
  const labels = ["intro", "verse", "chorus", "verse", "chorus", "verse", "chorus", "outro"];
  const performers = [
    undefined,
    undefined,
    undefined,
    "CENTRE-LEFT",
    undefined,
    undefined,
    undefined,
    undefined,
  ];
  const now = Date.now();
  let prev = 0;
  return labels.map((label, i) => {
    const endMs = Math.round(SECTION_ENDS_130S[i] * 1000 * scale);
    const row = {
      id: `marker_${now}_${i}`,
      label,
      startMs: prev,
      endMs,
      ...(performers[i] ? { performer: performers[i] } : {}),
    };
    prev = endMs;
    return row;
  });
}

function performerForSection(marker, markers, lead, speakers) {
  if (marker.performer) return marker.performer;
  const id = String(marker.label || "").trim().toLowerCase();
  if (id === "intro") return speakers.find((s) => s === "FAR-LEFT") || speakers[2] || lead;
  if (id === "outro") return speakers.find((s) => s === "RIGHT-SIDE") || speakers[3] || lead;
  if (id === "verse") {
    const verses = markers.filter((m) => String(m.label).toLowerCase() === "verse");
    const n = verses.findIndex((m) => m.id === marker.id) + 1;
    if (n === 2) return speakers.find((s) => s === "CENTRE-LEFT") || speakers[1] || lead;
  }
  return lead;
}

const POSITION_MEMBERS = new Map([
  ["CENTRE-LEFT", "centre-left of frame"],
  ["FAR-LEFT", "far left of frame"],
  ["RIGHT-SIDE", "right side of frame"],
]);

function singerStaging(speaker, place) {
  return [
    `Medium close-up of ${speaker} at ${place}.`,
    `${speaker} is at the mic stand centre frame at ${place}, front-on to camera, mouth open mid-verse, singing.`,
    "One hand on mic stand. No phone. No crowd.",
    `Only ${speaker} in frame. No other people.`,
  ].join(" ");
}

function positionStaging(speaker, place) {
  const pos = POSITION_MEMBERS.get(speaker) || "centre frame";
  return [
    `Medium close-up of ${speaker} at ${place}.`,
    `${speaker} stands at the mic ${pos} at ${place}, front-on to camera, mouth open mid-verse, singing.`,
    "One hand on mic stand. No phone. No crowd.",
    `Only ${speaker} in frame. No other people.`,
  ].join(" ");
}

function hummingStaging(speaker, place) {
  return [
    `Medium close-up of ${speaker} at ${place}.`,
    `${speaker} at the mic, mouth closed, eyes half closed, humming soft backup harmonies — not lip-syncing lead lines.`,
    "Still and soulful. No phone. No crowd.",
    `Only ${speaker} in frame. No other people.`,
  ].join(" ");
}

function stagingFor(speaker, lead) {
  if (speaker === lead) return singerStaging;
  if (POSITION_MEMBERS.has(speaker)) return positionStaging;
  return hummingStaging;
}

function sceneOrder(job) {
  const scenes = job.scenes || [];
  const rank = (name) => {
    const p = String(name || "").toLowerCase();
    if (p.startsWith("saloon")) return 0;
    if (p.includes("las vegas")) return 1;
    return 2;
  };
  return [...scenes].sort((a, b) => rank(a.placeName) - rank(b.placeName));
}

async function copyLocations(from, to) {
  const { execSync } = await import("node:child_process");
  const { fileURLToPath } = await import("node:url");
  const { dirname, join } = await import("node:path");
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  execSync(`node scripts/mv-copy-locations.mjs --from ${from} --to ${to}`, {
    stdio: "inherit",
    cwd: root,
  });
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

async function setPlateTiming(jobId, plateId, startMs, endMs, sortIndex) {
  return api("/api/crash/mobile/track", {
    action: "set-plate-timing",
    jobId,
    plateId,
    startMs,
    endMs,
    sortIndex,
  });
}

async function runPendingLtx(jobId) {
  let job = await getJob(jobId);
  for (const cut of (job.scratchSong?.cuts || []).filter((c) => c.status !== "done")) {
    console.log(`  LTX ${cut.id} (${cut.shotId})…`);
    try {
      const out = await api("/api/crash/mobile/song", { action: "run", jobId, cutId: cut.id });
      const done = out.job?.scratchSong?.cuts?.find((c) => c.id === cut.id);
      console.log(`    → ${done?.status}${done?.error ? ": " + done.error : ""}`);
    } catch (e) {
      console.log(`    FAILED: ${e.message}`);
    }
  }
}

async function main() {
  const { jobId, jackId, platesOnly } = parseArgs();
  console.log("Job:", jobId);

  if (!platesOnly) {
    console.log("\n1. Copy locations from Jack…");
    await copyLocations(jackId, jobId);

    console.log("\n2. Lyrics + [CENTRE-LEFT] tag…");
    await api("/api/crash/mobile/song", { action: "set-lyrics", jobId, lyrics: LYRICS });
  }

  let job = await getJob(jobId);
  if (!job.folderName) throw new Error("Lock the episode first (Start the video)");
  const durationMs = Math.round((job.scratchSong?.durationSec || 0) * 1000);
  if (!durationMs) throw new Error("No song duration on job");

  const lead = (job.speakers?.[0] || "SOUL REBEL").trim();
  const markers = scaleSectionMarkers(durationMs, job.speakers || []);

  if (!platesOnly) {
    console.log("\n3. Section markers…");
    await api("/api/crash/mobile/track", {
      action: "save-track",
      jobId,
      sectionMarkers: markers,
    });
    job = await getJob(jobId);
  } else {
    job = await getJob(jobId);
  }

  const scenes = sceneOrder(job);
  const primaryScene = scenes[0];
  if (!primaryScene) throw new Error("No scenes on job");

  console.log("\n4. Section plates…");
  let sortIndex = 0;
  for (const marker of markers) {
    const speaker = performerForSection(marker, markers, lead, job.speakers || []);
    const place = primaryScene.placeName || "stage";
    const stagingFn = stagingFor(speaker, lead);
    const staging = stagingFn(speaker, place);
    console.log(
      `  ${marker.label} ${Math.round(marker.startMs / 1000)}s–${Math.round(marker.endMs / 1000)}s → ${speaker}`,
    );
    try {
      const r = await addPlate(jobId, primaryScene.id, speaker, staging);
      await setPlateTiming(jobId, r.shotId, marker.startMs, marker.endMs, sortIndex++);
      console.log(`    ${r.plateFile} qa=${r.qa}`);
    } catch (e) {
      console.log(`    ERROR: ${e.message}`);
    }
  }

  console.log("\n5. LTX…");
  await runPendingLtx(jobId);

  console.log("\n6. Stitch…");
  try {
    const out = await api("/api/crash/mobile/song", { action: "stitch", jobId });
    console.log("  stitched:", out.stitchedFile);
  } catch (e) {
    console.log("  stitch skipped:", e.message);
  }

  console.log("\nDone:", `${BASE.replace("localhost:3737", "skidmarks.aiglitch.app")}/m?job=${jobId}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
