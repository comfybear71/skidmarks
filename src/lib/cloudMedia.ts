import { NextResponse } from "next/server";
import { useCloudStore } from "./cloudEnv";
import { findNeonFile, getLatestOpenedEpisode } from "./neonStore";
import { blobContentType, getBlobPayload, type BlobFileKind } from "./blobStore";
import { serveMediaBuffer } from "./serveMediaFile";
import { STILL_CACHE_CONTROL } from "./stillCache";

/** Basename only — allow apostrophes/spaces that disk packs actually use. */
export function isSafeMediaName(name: string): boolean {
  const n = String(name || "").trim();
  if (!n || n.length > 240) return false;
  if (n.includes("..") || n.includes("/") || n.includes("\\")) return false;
  if (/[:*?"<>|\r\n]/.test(n)) return false;
  return true;
}

/**
 * On Vercel, serve Blob bytes through this origin with Range (206).
 * iPhone Safari will not play <video>/<audio> from a 200 stream with no
 * Accept-Ranges — same bug disk routes already fixed in serveMediaFile.
 * Do not redirect the browser at a private Blob URL (and never put the token in HTML).
 * Local returns null so the route can read disk.
 */
export async function cloudBlobRedirect(
  kind: BlobFileKind,
  filename: string,
  req?: Request,
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
  const contentType =
    payload.contentType || blobContentType(kind, filename);
  const buf = Buffer.from(await new Response(payload.stream).arrayBuffer());
  return serveMediaBuffer(
    req ?? new Request("http://localhost"),
    buf,
    contentType,
    { "Cache-Control": STILL_CACHE_CONTROL },
  );
}
