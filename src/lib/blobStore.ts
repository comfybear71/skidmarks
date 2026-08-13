import { list, put } from "@vercel/blob";

export type BlobFileKind = "plates" | "audio" | "mp4";

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

export function blobContentType(kind: BlobFileKind, filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  if (kind === "audio") {
    if (ext === "wav") return "audio/wav";
    if (ext === "ogg") return "audio/ogg";
    return "audio/mpeg";
  }
  if (kind === "mp4") return "video/mp4";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return "image/png";
}

export async function putBlobFile(opts: {
  pathname: string;
  body: Buffer;
  contentType: string;
}): Promise<{ url: string; pathname: string }> {
  const result = await put(opts.pathname, opts.body, {
    access: "public",
    token: blobToken(),
    contentType: opts.contentType,
    addRandomSuffix: false,
    allowOverwrite: true,
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
