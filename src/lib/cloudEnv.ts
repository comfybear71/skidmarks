/**
 * Cloud media (Vercel Blob + Neon) vs local Desktop folders.
 * Local Studio always reads disk. Vercel uses cloud only when env is present.
 *
 * Next.js 16 inlines `process.env.SOME_NAME` at build time. Live production
 * (`skidmarks-seven.vercel.app`) baked `process.env.VERCEL` as empty, so the
 * header said "localhost only" and cloud shelves never turned on. Dynamic
 * lookup (`const env = process.env`) is NOT inlined — see Next env docs.
 */

function env(name: string): string {
  return String(process.env[name] || "").trim();
}

/** True on a Vercel deployment (build or serverless), never on the PC/VM. */
export function runningOnVercel(): boolean {
  return Boolean(env("VERCEL") || env("VERCEL_ENV") || env("VERCEL_REGION"));
}

export function cloudEnvReady(): boolean {
  return Boolean(env("DATABASE_URL") && env("BLOB_READ_WRITE_TOKEN"));
}

/** True on Vercel when Blob + Neon env are set. Never true on localhost. */
export function useCloudStore(): boolean {
  return runningOnVercel() && cloudEnvReady();
}
