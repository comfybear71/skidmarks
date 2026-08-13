/**
 * Cloud media (Vercel Blob + Neon) vs local Desktop folders.
 * Local Studio always reads disk. Vercel uses cloud only when env is present.
 */

export function cloudEnvReady(): boolean {
  return Boolean(
    process.env.DATABASE_URL?.trim() &&
      process.env.BLOB_READ_WRITE_TOKEN?.trim(),
  );
}

/** True on Vercel when Blob + Neon env are set. Never true on localhost. */
export function useCloudStore(): boolean {
  return Boolean(process.env.VERCEL) && cloudEnvReady();
}
