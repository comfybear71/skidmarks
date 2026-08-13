import { NextResponse } from "next/server";
import { useCloudStore } from "./cloudEnv";
import { findNeonFile } from "./neonStore";
import type { BlobFileKind } from "./blobStore";

const SAFE_NAME = /^[\w.\-]+$/;

export function isSafeMediaName(name: string): boolean {
  return Boolean(name) && SAFE_NAME.test(name);
}

/** On Vercel, send the browser to the Blob URL. Local returns null (use disk). */
export async function cloudBlobRedirect(
  kind: BlobFileKind,
  filename: string,
): Promise<NextResponse | null> {
  if (!useCloudStore()) return null;
  if (!isSafeMediaName(filename)) return null;
  const row = await findNeonFile({ kind, filename });
  if (!row?.blob_url) return null;
  return NextResponse.redirect(row.blob_url, 302);
}
