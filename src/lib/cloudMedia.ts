import { NextResponse } from "next/server";
import { useCloudStore } from "./cloudEnv";
import { findNeonFile, getLatestOpenedEpisode } from "./neonStore";
import { blobContentType, getBlobPayload, type BlobFileKind } from "./blobStore";

/** Basename only — allow apostrophes/spaces that disk packs actually use. */
export function isSafeMediaName(name: string): boolean {
  const n = String(name || "").trim();
  if (!n || n.length > 240) return false;
  if (n.includes("..") || n.includes("/") || n.includes("\\")) return false;
  if (/[:*?"<>|\r\n]/.test(n)) return false;
  return true;
}

/**
 * On Vercel, stream the file from Blob through this origin.
 * Do not redirect the browser at a private Blob URL (and never put the token in HTML).
 * Local returns null so the route can read disk.
 */
export async function cloudBlobRedirect(
  kind: BlobFileKind,
  filename: string,
): Promise<NextResponse | null> {
  if (!useCloudStore()) return null;
  if (!isSafeMediaName(filename)) return null;
  const opened = await getLatestOpenedEpisode();
  const row =
    (opened?.id
      ? await findNeonFile({
          kind,
          filename,
          episodeId: opened.id,
        })
      : null) || (await findNeonFile({ kind, filename }));
  if (!row?.blob_url && !row?.blob_pathname) return null;
  const payload = await getBlobPayload(row.blob_url || row.blob_pathname);
  if (!payload) return null;
  return new NextResponse(payload.stream, {
    headers: {
      "Content-Type":
        payload.contentType || blobContentType(kind, filename),
      "Cache-Control": "private, max-age=120",
    },
  });
}
