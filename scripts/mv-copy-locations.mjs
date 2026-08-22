/**
 * Copy approved location stills from one music-video job to another (match scenes by place name).
 * Run: node scripts/mv-copy-locations.mjs --from JOB --to JOB
 */
const BASE = process.env.MOBILE_API_BASE || "http://localhost:3737";

function parseArgs() {
  const args = process.argv.slice(2);
  let from = "";
  let to = "";
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--from") from = args[++i] || "";
    else if (args[i] === "--to") to = args[++i] || "";
  }
  if (!from || !to) {
    console.error("Usage: node scripts/mv-copy-locations.mjs --from SOURCE_JOB --to TARGET_JOB");
    process.exit(1);
  }
  return { from, to };
}

async function getJob(id) {
  const res = await fetch(`${BASE}/api/crash/mobile/job/${id}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "job fetch failed");
  return data.job;
}

function sceneKey(placeName) {
  const p = String(placeName || "").trim().toLowerCase();
  if (p.startsWith("saloon")) return "saloon";
  if (p.includes("las vegas")) return "vegas";
  if (p.includes("highway") || p.includes("desert")) return "highway";
  return p.slice(0, 40);
}

async function uploadLocation(jobId, sceneId, buffer, fileName) {
  const form = new FormData();
  form.set("jobId", jobId);
  form.set("kind", "location");
  form.set("target", sceneId);
  form.set("file", new Blob([buffer]), fileName);
  const res = await fetch(`${BASE}/api/crash/mobile/candidate-upload`, { method: "POST", body: form });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "upload failed");
  return data.job;
}

async function approveLocation(jobId, sceneId, candidateId) {
  const res = await fetch(`${BASE}/api/crash/mobile/candidates`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action: "approve",
      kind: "location",
      jobId,
      target: sceneId,
      candidateId,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "approve failed");
  return data.job;
}

async function fetchLocationBlob(job, sceneId, fileName) {
  const url =
    `${BASE}/api/crash/mobile/location-still?styleId=${encodeURIComponent(job.styleId)}` +
    `&folderName=${encodeURIComponent(job.folderName || job.id)}` +
    `&fileName=${encodeURIComponent(fileName)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const alt =
      `${BASE}/api/crash/mobile/location-still?styleId=${encodeURIComponent(job.styleId)}` +
      `&folderName=${encodeURIComponent(job.id)}` +
      `&fileName=${encodeURIComponent(fileName)}`;
    const res2 = await fetch(alt);
    if (!res2.ok) throw new Error(`Could not fetch ${fileName} (${res.status})`);
    return Buffer.from(await res2.arrayBuffer());
  }
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  const { from, to } = parseArgs();
  const src = await getJob(from);
  const dst = await getJob(to);

  const srcByKey = new Map();
  for (const scene of src.scenes || []) {
    const approved = (src.locationCandidates?.[scene.id] || []).find((c) => c.approved);
    if (!approved) continue;
    srcByKey.set(sceneKey(scene.placeName), { scene, approved });
  }

  let job = dst;
  for (const scene of dst.scenes || []) {
    const key = sceneKey(scene.placeName);
    const hit = srcByKey.get(key);
    if (!hit) {
      console.log(`  skip ${scene.placeName?.slice(0, 32)} — no source`);
      continue;
    }
    const existing = (job.locationCandidates?.[scene.id] || []).find((c) => c.approved);
    if (existing) {
      console.log(`  ok ${scene.placeName?.slice(0, 32)} — already approved`);
      continue;
    }
    console.log(`  copy ${scene.placeName?.slice(0, 32)}…`);
    const buf = await fetchLocationBlob(src, hit.scene.id, hit.approved.fileName);
    job = await uploadLocation(to, scene.id, buf, hit.approved.fileName);
    const uploaded = (job.locationCandidates?.[scene.id] || []).slice(-1)[0];
    if (!uploaded?.id) throw new Error("upload did not return candidate id");
    job = await approveLocation(to, scene.id, uploaded.id);
    console.log(`    approved ${uploaded.fileName}`);
  }
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
