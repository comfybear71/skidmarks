/**
 * Finish THE JACK ASH BAND — section-aligned plates, LTX, stitch.
 * Keeps the 6 done JACK GHOST stills; adds sax + guitar for the breaks.
 * Run: node scripts/mv-jack-finish.mjs [--job ID] [--lyrics-file path]
 */
const BASE = process.env.MOBILE_API_BASE || "http://localhost:3737";
const DEFAULT_JOB = "mgen_20260822085033162_0ud";

const DEFAULT_LYRICS = `[Instrumental Intro] [Tension-strummed 12-string, slow dragging bass pulse]


[Verse 1]Silver glass on the table catching cold blue fire
A tiny church of smoke built on high wire
You feed the little dragon in the quiet dead of night
And the room gets small, but the shadows burn bright
It eats your pocket clean, leaves the copper on the tongue
A heavy-metal clock in a chest too young
The engine starts to scream, spinning miles in a chair
Chasing phantom ghosts through the thin, dry air


[Chorus]Blow the glass clean, watch the white smoke spin
Let the white-hot current pull the engine right inIt's a high-priced ticket on a runaway train
Burning up the fuel just to outrun the pain
When the dragon goes to sleep and the metal gets cold
You pay the heavy toll for the silver you sold

[Verse 2]The clock on the wall turns to water and sand
With a pocketful of lightning in a twitching hand
You talk to the walls till the sun cuts the blind
Leaving all the pieces of the morning behindIt looks like a feast, but it leaves you so bare
A skeleton dance on the edge of the stair
The engine slows down and the gears start to grind
Leaving broken-down rust in the back of the mind


[Chorus]Blow the glass clean, watch the white smoke spin
Let the white-hot current pull the engine right inIt's a high-priced ticket on a runaway train
Burning up the fuel just to outrun the pain
When the dragon goes to sleep and the metal gets cold
You pay the heavy toll for the silver you sold

[Outro]
 [Fading 12-string drone, a single slow bass thud dying out]`;

/** Six JACK plates that already have done LTX — do not redraw stills. */
const KEEP_JACK = [
  "shot_h3gn4xf",
  "shot_wyqy4vq",
  "shot_2p04clq",
  "shot_0u1p6vh",
  "shot_sqh6jbu",
  "shot_q553t02",
];

function parseArgs() {
  const args = process.argv.slice(2);
  let jobId = DEFAULT_JOB;
  let lyricsFile = "";
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--job") jobId = args[++i] || jobId;
    else if (args[i] === "--lyrics-file") lyricsFile = args[++i] || "";
  }
  return { jobId, lyricsFile };
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

function performerFor(label) {
  const id = String(label || "").trim().toLowerCase();
  if (id === "sax_break") return "SAXOPHONE";
  if (id === "lead_break") return "GUITAR";
  return "JACK GHOST";
}

function singerStaging(speaker, place) {
  return [
    `Medium close-up of ${speaker} at ${place}.`,
    `${speaker} is at the mic stand centre frame at ${place}, front-on to camera, mouth open mid-verse, singing.`,
    "One hand on mic stand. No phone. No crowd.",
    `Only ${speaker} in frame. No other people.`,
  ].join(" ");
}

function bandStaging(speaker, place) {
  return `${speaker} alone. Only ${speaker} in frame. At ${place}, centre frame in profile with instrument visible. NO SINGING — mouth closed, playing the ${speaker === "SAXOPHONE" ? "sax" : "guitar"}. No phone. No crowd.`;
}

function saloonScene(job) {
  return (
    job.scenes.find((s) => (s.placeName || "").toUpperCase().startsWith("SALOON")) ||
    job.scenes[0]
  );
}

async function skipPlate(jobId, shotId) {
  return api("/api/crash/mobile/song", { action: "skip-plate", jobId, shotId });
}

async function setTiming(jobId, plateId, startMs, endMs, sortIndex) {
  return api("/api/crash/mobile/track", {
    action: "set-plate-timing",
    jobId,
    plateId,
    startMs,
    endMs,
    sortIndex,
  });
}

async function addPlate(jobId, sceneId, speaker, staging) {
  const added = await api("/api/crash/mobile/plate", {
    jobId,
    sceneId,
    speaker,
    action: "add",
  });
  await api("/api/crash/mobile/plate", {
    jobId,
    shotId: added.shotId,
    staging,
    action: "rebuild",
    qa: true,
  });
  await api("/api/crash/mobile/song", { action: "add-plate", jobId, shotId: added.shotId });
  return added.shotId;
}

async function runAllLtx(jobId) {
  let job = await getJob(jobId);
  for (const cut of job.scratchSong?.cuts || []) {
    console.log(`  LTX ${cut.id} (${cut.shotId}) ${cut.startSec}s…`);
    try {
      const out = await api("/api/crash/mobile/song", { action: "run", jobId, cutId: cut.id });
      const done = out.job?.scratchSong?.cuts?.find((c) => c.id === cut.id);
      console.log(`    → ${done?.status}${done?.error ? ": " + done.error : ""}`);
      job = out.job || job;
    } catch (e) {
      console.log(`    FAILED: ${e.message}`);
    }
  }
}

async function main() {
  const { jobId, lyricsFile } = parseArgs();
  let lyrics = DEFAULT_LYRICS;
  if (lyricsFile) {
    const { readFileSync } = await import("node:fs");
    lyrics = readFileSync(lyricsFile, "utf8");
  }
  console.log("Job:", jobId);

  console.log("\n1. Lyrics…");
  await api("/api/crash/mobile/song", { action: "set-lyrics", jobId, lyrics });

  let job = await getJob(jobId);
  const markers = job.scratchSong?.sectionMarkers || [];
  if (!markers.length) throw new Error("No section markers — time sections on the phone first.");

  console.log("\n2. Clear junk from song list…");
  const onList = [...(job.scratchSong?.songPlateIds || [])];
  const junk = onList.filter((id) => !KEEP_JACK.includes(id));
  for (const shotId of [...junk].reverse()) {
    try {
      job = (await skipPlate(jobId, shotId)).job;
      console.log(`  × ${shotId}`);
    } catch (e) {
      console.log(`  skip ${shotId}: ${e.message}`);
    }
  }

  job = await getJob(jobId);
  const sorted = [...markers].sort((a, b) => a.startMs - b.startMs);
  const scene = saloonScene(job);
  const place = scene.placeName || "SALOON";

  console.log("\n3. Section plates…");
  let jackIdx = 0;
  for (let i = 0; i < sorted.length; i++) {
    const m = sorted[i];
    const who = performerFor(m.label);
    const label = String(m.label);
    console.log(
      `  ${label} ${Math.round(m.startMs / 1000)}–${Math.round(m.endMs / 1000)}s → ${who}`,
    );

    let shotId;
    if (who === "JACK GHOST" && jackIdx < KEEP_JACK.length) {
      shotId = KEEP_JACK[jackIdx++];
      const onSong = (job.scratchSong?.songPlateIds || []).includes(shotId);
      if (!onSong) {
        await api("/api/crash/mobile/song", { action: "add-plate", jobId, shotId });
      }
    } else {
      const staging = who === "JACK GHOST" ? singerStaging(who, place) : bandStaging(who, place);
      shotId = await addPlate(jobId, scene.id, who, staging);
      console.log(`    new plate ${shotId}`);
    }

    await setTiming(jobId, shotId, m.startMs, m.endMs, i);
  }

  console.log("\n4. LTX (all sections)…");
  await runAllLtx(jobId);

  console.log("\n5. Stitch…");
  try {
    const out = await api("/api/crash/mobile/song", { action: "stitch", jobId });
    console.log("  stitched:", out.stitchedFile);
  } catch (e) {
    console.log("  stitch:", e.message);
  }

  console.log("\nDone:", `${BASE.replace("localhost:3737", "skidmarks.aiglitch.app")}/m?job=${jobId}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
