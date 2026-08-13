/**
 * Dry-run (default) or upload one local episode pack to Blob + Neon.
 * Needs local Studio running (http://localhost:3737). Does not delete files.
 *
 *   node scripts/upload_pack_to_cloud.mjs --style sunny_banks --folder "CURSOR_SUNNY_BANKS_2"
 *   node scripts/upload_pack_to_cloud.mjs --style sunny_banks --folder "CURSOR_SUNNY_BANKS_2" --go
 */
function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")) {
    return process.argv[i + 1];
  }
  return "";
}

const styleId = arg("style") || arg("styleId");
const folderName = arg("folder") || arg("folderName");
const go = process.argv.includes("--go");

if (!styleId || !folderName) {
  console.log("Need --style and --folder. Default is dry-run (no upload).");
  process.exit(1);
}

const res = await fetch("http://localhost:3737/api/crash/cloud/upload", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ styleId, folderName, dryRun: !go }),
});
const data = await res.json().catch(() => ({}));
if (!res.ok) {
  console.log(data.error || `Upload API ${res.status}`);
  process.exit(1);
}
const n = Array.isArray(data.files) ? data.files.length : 0;
console.log(
  data.dryRun
    ? `Dry-run: ${n} files, ${data.bytes || 0} bytes. Nothing uploaded.`
    : `Uploaded ${data.uploaded || 0} files for ${data.folderName}.`,
);
