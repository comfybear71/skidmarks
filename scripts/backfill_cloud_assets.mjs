/**
 * Backfill show-level shelf assets (WORLD images, cast faces, SPX sounds/videos)
 * from local disk into Vercel Blob + Neon, following the cloud naming convention.
 *
 * Run from the machine that HAS the local media (your PC), with DATABASE_URL +
 * BLOB_READ_WRITE_TOKEN available (env or MY MOVIES/.env). Idempotent.
 *
 *   node scripts/backfill_cloud_assets.mjs --style skidmarks           # dry run
 *   node scripts/backfill_cloud_assets.mjs --style skidmarks --go      # upload
 *   node scripts/backfill_cloud_assets.mjs --all --go                  # every show
 *
 * Local sources:
 *   data/crash/world-cards/{show}/*        + manifest.json { "g:file": {name,brief,placeType} }
 *   data/crash/style-cards/{show}/*        + manifest.json { "g:file": {name,brief} }
 *   data/crash/spx/{show}/{sfx,video}/*    + manifest.json [ {id,kind,fileName,label,note} ]
 *
 * Blob targets:
 *   shows/{show}/world-cards/{file}
 *   shows/{show}/style-cards/{file}
 *   shows/{show}/spx/{sfx|video}/{file}
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { put } from "@vercel/blob";
import { neon } from "@neondatabase/serverless";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const moviesRoot = path.resolve(root, "..", "..");

function loadEnvFile(fp) {
  if (!fs.existsSync(fp)) return;
  for (const line of fs.readFileSync(fp, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (k && process.env[k] == null) process.env[k] = v;
  }
}
loadEnvFile(path.join(root, ".env.local"));
loadEnvFile(path.join(root, ".env"));
loadEnvFile(path.join(moviesRoot, ".env"));

const args = process.argv.slice(2);
const go = args.includes("--go");
const all = args.includes("--all");
const styleArg = (() => {
  const i = args.indexOf("--style");
  return i >= 0 ? args[i + 1] : null;
})();
const SHOWS = ["skidmarks", "sunny_banks", "deepfake", "doc", "music_video", "photoreal"];
const shows = all ? SHOWS : styleArg ? [styleArg] : [];
if (!shows.length) {
  console.log("Pass --style <id> or --all. Add --go to actually upload (default is dry run).");
  process.exit(1);
}

const dbUrl = (process.env.DATABASE_URL || "").trim();
const token = (process.env.BLOB_READ_WRITE_TOKEN || "").trim();
if (!dbUrl || !token) {
  console.log("Missing DATABASE_URL or BLOB_READ_WRITE_TOKEN.");
  process.exit(1);
}
const sql = neon(dbUrl);

const IMG = /\.(png|jpe?g|webp|gif)$/i;
const AUD = /\.(mp3|wav|ogg|m4a)$/i;
const VID = /\.(mp4|webm|mov)$/i;

function contentType(file) {
  const e = file.split(".").pop().toLowerCase();
  if (["mp3"].includes(e)) return "audio/mpeg";
  if (e === "wav") return "audio/wav";
  if (e === "ogg") return "audio/ogg";
  if (e === "m4a") return "audio/mp4";
  if (e === "mp4") return "video/mp4";
  if (e === "webm") return "video/webm";
  if (e === "mov") return "video/quicktime";
  if (e === "jpg" || e === "jpeg") return "image/jpeg";
  if (e === "webp") return "image/webp";
  if (e === "gif") return "image/gif";
  return "image/png";
}

function readJson(fp) {
  try { return JSON.parse(fs.readFileSync(fp, "utf8")); } catch { return null; }
}

async function ensureShow(show) {
  if (!go) return;
  await sql`INSERT INTO shows (id, name) VALUES (${show}, ${show}) ON CONFLICT (id) DO NOTHING`;
}

async function upsert(row) {
  const id = `${row.show}/${row.kind}/${row.file}`;
  if (!go) return id;
  const res = await put(row.pathname, fs.readFileSync(row.abs), {
    access: "public", token, contentType: contentType(row.file),
    addRandomSuffix: false, allowOverwrite: true,
  });
  await sql`
    INSERT INTO files (id, episode_id, show_id, kind, blob_url, filename, blob_pathname,
      label_name, label_brief, place_type, spx_id, spx_note)
    VALUES (${id}, NULL, ${row.show}, ${row.kind}, ${res.url}, ${row.file}, ${res.pathname},
      ${row.name ?? null}, ${row.brief ?? null}, ${row.placeType ?? null}, ${row.spxId ?? null}, ${row.note ?? null})
    ON CONFLICT (id) DO UPDATE SET blob_url=EXCLUDED.blob_url, blob_pathname=EXCLUDED.blob_pathname,
      label_name=COALESCE(EXCLUDED.label_name, files.label_name),
      label_brief=COALESCE(EXCLUDED.label_brief, files.label_brief),
      place_type=COALESCE(EXCLUDED.place_type, files.place_type),
      spx_id=COALESCE(EXCLUDED.spx_id, files.spx_id),
      spx_note=COALESCE(EXCLUDED.spx_note, files.spx_note)`;
  return id;
}

let planned = 0, done = 0;
for (const show of shows) {
  await ensureShow(show);

  // WORLD
  const wDir = path.join(root, "data/crash/world-cards", show);
  const wMan = readJson(path.join(wDir, "manifest.json")) || {};
  if (fs.existsSync(wDir)) for (const f of fs.readdirSync(wDir)) {
    if (!IMG.test(f) || f === "manifest.json") continue;
    const lab = wMan[`g:${f}`] || {};
    planned++;
    const id = await upsert({ show, kind: "world", file: f, abs: path.join(wDir, f),
      pathname: `shows/${show}/world-cards/${f}`, name: lab.name, brief: lab.brief, placeType: lab.placeType });
    if (go) done++;
    console.log(`${go ? "up" : "plan"} world  ${id}`);
  }

  // CAST
  const cDir = path.join(root, "data/crash/style-cards", show);
  const cMan = readJson(path.join(cDir, "manifest.json")) || {};
  if (fs.existsSync(cDir)) for (const f of fs.readdirSync(cDir)) {
    if (!IMG.test(f) || f === "manifest.json") continue;
    const lab = cMan[`g:${f}`] || {};
    planned++;
    const id = await upsert({ show, kind: "cast", file: f, abs: path.join(cDir, f),
      pathname: `shows/${show}/style-cards/${f}`, name: lab.name, brief: lab.brief });
    if (go) done++;
    console.log(`${go ? "up" : "plan"} cast   ${id}`);
  }

  // SPX (sfx + video)
  const sMan = readJson(path.join(root, "data/crash/spx", show, "manifest.json")) || [];
  const byFile = Object.fromEntries((Array.isArray(sMan) ? sMan : []).map((i) => [i.fileName, i]));
  for (const [sub, kind, rx] of [["sfx", "spx_sfx", AUD], ["video", "spx_video", VID]]) {
    const dir = path.join(root, "data/crash/spx", show, sub);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!rx.test(f)) continue;
      const meta = byFile[f] || {};
      planned++;
      const id = await upsert({ show, kind, file: f, abs: path.join(dir, f),
        pathname: `shows/${show}/spx/${sub}/${f}`, name: meta.label, spxId: meta.id, note: meta.note });
      if (go) done++;
      console.log(`${go ? "up" : "plan"} ${kind} ${id}`);
    }
  }
}
console.log(`\n${go ? `Uploaded ${done}` : `Planned ${planned} (dry run — add --go to upload)`}.`);
