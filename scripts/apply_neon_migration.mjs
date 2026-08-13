/**
 * Apply sql/001_init.sql using DATABASE_URL.
 * Never prints the URL or other secret values.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const moviesRoot = path.resolve(root, "..", "..");

function loadEnvFile(fp) {
  if (!fs.existsSync(fp)) return;
  const text = fs.readFileSync(fp, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (key && process.env[key] == null) process.env[key] = val;
  }
}

loadEnvFile(path.join(root, ".env.local"));
loadEnvFile(path.join(root, ".env"));
loadEnvFile(path.join(moviesRoot, ".env"));

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.log("No DATABASE_URL in env — skip. Paste sql/001_init.sql in the Neon SQL editor.");
  process.exit(0);
}

const sqlFile = path.join(root, "sql", "001_init.sql");
const raw = fs.readFileSync(sqlFile, "utf8");
const statements = raw
  .split(";")
  .map((s) =>
    s
      .split(/\r?\n/)
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n")
      .trim(),
  )
  .filter(Boolean);

const { neon } = await import("@neondatabase/serverless");
const sql = neon(url);

for (const statement of statements) {
  await sql.query(statement);
}

console.log(`Neon tables ready (${statements.length} statements).`);
