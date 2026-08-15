/**
 * Cloud (Vercel Blob + Neon) read path for show-level shelf assets:
 * WORLD images, cast faces, and SPX (sfx/video). Local returns null so the
 * route falls back to disk. Never sends the Blob token to the browser.
 */
import { NextResponse } from "next/server";
// Aliased: a plain env check, not a React hook — the `use` prefix otherwise
// trips rules-of-hooks in every non-component file that calls it.
import { useCloudStore as cloudStoreEnabled } from "./cloudEnv";
import {
  blobContentType,
  getBlobPayload,
  type BlobFileKind,
  type ShowAssetKind,
} from "./blobStore";
import {
  findNeonShowFile,
  findNeonShowFileAnyShow,
  listNeonShowFiles,
  type NeonFileRow,
} from "./neonStore";
import { isSafeMediaName } from "./cloudMedia";
import { SHOW_STYLE_PRESETS, type ShowStyleId } from "./showStylePresets";

/** Stream a show-level asset from Blob (Vercel). Null → let the route read disk. */
export async function cloudShowAssetRedirect(
  showId: ShowStyleId,
  kind: ShowAssetKind,
  filename: string,
): Promise<NextResponse | null> {
  if (!cloudStoreEnabled()) return null;
  if (!isSafeMediaName(filename)) return null;
  let row = await findNeonShowFile({ showId, kind, filename });
  if (!row && kind === "cast") {
    row = await findNeonShowFileAnyShow({ kind, filename });
  }
  if (!row?.blob_url && !row?.blob_pathname) return null;
  const payload = await getBlobPayload(row.blob_url || row.blob_pathname);
  if (!payload) return null;
  return new NextResponse(payload.stream, {
    headers: {
      "Content-Type": payload.contentType || blobContentType(kind, filename),
      "Cache-Control": "private, max-age=120",
    },
  });
}

/**
 * Bytes for one show-level asset, for server-side work that needs the file
 * itself rather than a response to stream back. Plate compositing runs on a
 * different Vercel invocation than the approval did, so the local gallery it
 * used to read is always empty there.
 */
export async function readShowAssetBytes(
  showId: ShowStyleId,
  kind: ShowAssetKind,
  filename: string,
): Promise<Buffer | null> {
  if (!cloudStoreEnabled()) return null;
  if (!isSafeMediaName(filename)) return null;
  let row = await findNeonShowFile({ showId, kind, filename });
  if (!row && kind === "cast") {
    row = await findNeonShowFileAnyShow({ kind, filename });
  }
  if (!row?.blob_url && !row?.blob_pathname) return null;
  const payload = await getBlobPayload(row.blob_url || row.blob_pathname);
  if (!payload) return null;
  const chunks: Uint8Array[] = [];
  const reader = payload.stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  return Buffer.concat(chunks);
}

export async function cloudListShowFiles(
  showId: ShowStyleId,
  kind: BlobFileKind,
): Promise<NeonFileRow[]> {
  if (!cloudStoreEnabled()) return [];
  return listNeonShowFiles({ showId, kind });
}

function toMtime(v: NeonFileRow["mtime"]): number {
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n as number) ? (n as number) : Date.now();
}

/** WORLD gallery in the same shape as listWorldCardStatus(), read from Neon. */
export async function cloudWorldCardStatus(): Promise<
  {
    id: ShowStyleId;
    hasThumb: boolean;
    thumbs: { key: string; mtime: number; name?: string; brief?: string; placeType?: string }[];
  }[]
> {
  return Promise.all(
    SHOW_STYLE_PRESETS.map(async (p) => {
      const rows = await listNeonShowFiles({ showId: p.id, kind: "world" });
      return {
        id: p.id,
        hasThumb: rows.length > 0,
        thumbs: rows.map((r) => ({
          key: `g:${r.filename}`,
          mtime: toMtime(r.mtime),
          name: r.label_name || undefined,
          brief: r.label_brief || undefined,
          placeType: r.place_type || undefined,
        })),
      };
    }),
  );
}

/** Cast gallery in the same shape as listStyleCardStatus(), read from Neon. */
export async function cloudStyleCardStatus(): Promise<
  {
    id: ShowStyleId;
    hasThumb: boolean;
    thumbs: { key: string; mtime: number; name?: string; brief?: string }[];
  }[]
> {
  return Promise.all(
    SHOW_STYLE_PRESETS.map(async (p) => {
      const rows = await listNeonShowFiles({ showId: p.id, kind: "cast" });
      return {
        id: p.id,
        hasThumb: rows.length > 0,
        thumbs: rows.map((r) => ({
          key: `g:${r.filename}`,
          mtime: toMtime(r.mtime),
          name: r.label_name || undefined,
          brief: r.label_brief || undefined,
        })),
      };
    }),
  );
}

/** SPX shelf items in the same shape as readCrashSpxDesk().items, read from Neon. */
export async function cloudSpxItems(showId: ShowStyleId): Promise<
  { id: string; kind: "sfx" | "video"; fileName: string; label: string; note?: string; mtime: number }[]
> {
  const [sfx, video] = await Promise.all([
    listNeonShowFiles({ showId, kind: "spx_sfx" }),
    listNeonShowFiles({ showId, kind: "spx_video" }),
  ]);
  const map = (rows: NeonFileRow[], kind: "sfx" | "video") =>
    rows.map((r) => ({
      id: r.spx_id || `g:${r.filename}`,
      kind,
      fileName: r.filename,
      label: r.label_name || r.filename,
      note: r.spx_note || undefined,
      mtime: toMtime(r.mtime),
    }));
  return [...map(sfx, "sfx"), ...map(video, "video")].sort((a, b) => b.mtime - a.mtime);
}
