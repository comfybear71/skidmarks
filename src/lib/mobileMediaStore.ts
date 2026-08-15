/**
 * Blob-backed media for the mobile pipeline — plates, voice mp3s, and
 * animate clips are generated to Vercel's per-request scratch disk, but the
 * mobile run's later phases (a shot's plate made in "plates" is read again
 * in "animate"; a clip made in "animate" is read again in "stitch") land in
 * separate serverless invocations that don't share that disk. Mirrors every
 * generated file up to Vercel Blob right after it's written (uploadMobileMedia,
 * same blobPathname/Neon-file-row shape scripts/upload_pack_to_cloud.mjs uses
 * for the desktop backfill), and pulls a file back down into local scratch
 * on demand when a later request needs it but doesn't have it locally
 * (resolveMobileMedia). No-ops off Vercel/cloud — local Studio always has
 * the real file already.
 */
import fs from "fs";
import path from "path";
import { useCloudStore } from "./cloudEnv";
import {
  blobContentType,
  blobPathname,
  getBlobPayload,
  putBlobFile,
  type BlobFileKind,
} from "./blobStore";
import { episodeRowId, upsertNeonFile } from "./neonStore";
import type { ShowStyleId } from "./showStylePresets";

export async function uploadMobileMedia(opts: {
  styleId: ShowStyleId;
  folderName: string;
  kind: BlobFileKind;
  localPath: string;
}): Promise<void> {
  if (!useCloudStore()) return;
  if (!fs.existsSync(opts.localPath)) return;
  const fileName = path.basename(opts.localPath);
  const body = fs.readFileSync(opts.localPath);
  const put = await putBlobFile({
    pathname: blobPathname(opts.styleId, opts.folderName, opts.kind, fileName),
    body,
    contentType: blobContentType(opts.kind, fileName),
  });
  await upsertNeonFile({
    episodeId: episodeRowId(opts.styleId, opts.folderName),
    kind: opts.kind,
    blobUrl: put.url,
    filename: fileName,
    blobPathname: put.pathname,
  });
}

/**
 * Local disk first (same container as generation, no round-trip needed);
 * else pull the bytes down from Blob into destPath. Returns null when the
 * file exists nowhere (never generated, or a real error upstream).
 */
export async function resolveMobileMedia(opts: {
  styleId: ShowStyleId;
  folderName: string;
  kind: BlobFileKind;
  fileName: string;
  destPath: string;
}): Promise<string | null> {
  if (fs.existsSync(opts.destPath)) return opts.destPath;
  if (!useCloudStore()) return null;
  const payload = await getBlobPayload(
    blobPathname(opts.styleId, opts.folderName, opts.kind, opts.fileName),
  );
  if (!payload) return null;
  const buf = Buffer.from(await new Response(payload.stream).arrayBuffer());
  fs.mkdirSync(path.dirname(opts.destPath), { recursive: true });
  fs.writeFileSync(opts.destPath, buf);
  return opts.destPath;
}
