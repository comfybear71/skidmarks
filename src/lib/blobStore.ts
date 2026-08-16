import { del, get, list, put } from "@vercel/blob";

/** Episode-scoped media (uploaded per pack) + show-level shelf assets. */
export type BlobFileKind =
  | "plates"
  | "audio"
  | "mp4"
  | "world"
  | "cast"
  | "spx_sfx"
  | "spx_video"
  | "story_sfx"
  | "placeholder"
  | "character_plate";

/** Show-level shelves shared across episodes (not tied to one episode). */
export type ShowAssetKind =
  | "world"
  | "cast"
  | "spx_sfx"
  | "spx_video"
  /** Multi-view character sheet — front/three-quarter/profile/back plus
   * expressions. The show's continuity reference, kept separate from `cast`
   * because a cast card is a single figure used as an identity reference and
   * a sheet is not safe to hand a plate compositor as one. */
  | "character_plate";

const AUDIO_KINDS = new Set<BlobFileKind>(["audio", "spx_sfx", "story_sfx"]);
const VIDEO_KINDS = new Set<BlobFileKind>(["mp4", "spx_video"]);

function blobToken(): string {
  const t = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!t) throw new Error("BLOB_READ_WRITE_TOKEN missing");
  return t;
}

export function blobPathname(
  showId: string,
  episodeFolder: string,
  kind: BlobFileKind,
  filename: string,
): string {
  return `shows/${showId}/episodes/${episodeFolder}/${kind}/${filename}`;
}

/** Show-level shelf path (no episode). Mirrors the local disk layout. */
export function showAssetPathname(
  showId: string,
  kind: ShowAssetKind,
  filename: string,
): string {
  const seg =
    kind === "world"
      ? "world-cards"
      : kind === "cast"
        ? "style-cards"
        : kind === "character_plate"
          ? "character-plates"
          : kind === "spx_sfx"
            ? "spx/sfx"
            : "spx/video";
  return `shows/${showId}/${seg}/${filename}`;
}

export function blobContentType(kind: BlobFileKind, filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  if (AUDIO_KINDS.has(kind)) {
    if (ext === "wav") return "audio/wav";
    if (ext === "ogg") return "audio/ogg";
    if (ext === "m4a") return "audio/mp4";
    return "audio/mpeg";
  }
  if (VIDEO_KINDS.has(kind)) {
    if (ext === "webm") return "video/webm";
    if (ext === "mov") return "video/quicktime";
    return "video/mp4";
  }
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return "image/png";
}

export async function putBlobFile(opts: {
  pathname: string;
  body: Buffer;
  contentType: string;
  /** Default true for episode media. Character plates pass false unless
   * the caller is an explicit replace (Baby stays Baby). */
  allowOverwrite?: boolean;
}): Promise<{ url: string; pathname: string }> {
  const result = await put(opts.pathname, opts.body, {
    access: "public",
    token: blobToken(),
    contentType: opts.contentType,
    addRandomSuffix: false,
    allowOverwrite: opts.allowOverwrite !== false,
  });
  return { url: result.url, pathname: result.pathname };
}

export async function listBlobPrefix(prefix: string): Promise<
  { url: string; pathname: string }[]
> {
  const out: { url: string; pathname: string }[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({
      prefix,
      token: blobToken(),
      cursor,
    });
    for (const b of page.blobs) {
      out.push({ url: b.url, pathname: b.pathname });
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return out;
}

/** Delete blob objects by pathname/url. Best effort — the Neon row is the
 * source of truth for what exists; a failed delete here leaves an orphaned
 * object in storage, not a broken app. */
export async function deleteBlobFiles(pathnames: string[]): Promise<void> {
  if (!pathnames.length) return;
  try {
    await del(pathnames, { token: blobToken() });
  } catch {
    /* orphaned object, not a functional problem */
  }
}

/** Read blob bytes on the server. Never send the token to the browser. */
export async function getBlobPayload(
  urlOrPathname: string,
): Promise<{ stream: ReadableStream<Uint8Array>; contentType: string } | null> {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!urlOrPathname) return null;
  for (const access of ["public", "private"] as const) {
    try {
      const result = await get(urlOrPathname, { access, token });
      if (result?.statusCode === 200 && result.stream) {
        return {
          stream: result.stream,
          contentType: result.blob.contentType || "application/octet-stream",
        };
      }
    } catch {
      /* try the other access mode */
    }
  }
  if (!/^https?:\/\//i.test(urlOrPathname)) return null;
  try {
    const headers: HeadersInit = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(urlOrPathname, { headers, cache: "no-store" });
    if (!res.ok || !res.body) return null;
    return {
      stream: res.body,
      contentType: res.headers.get("content-type") || "application/octet-stream",
    };
  } catch {
    return null;
  }
}
