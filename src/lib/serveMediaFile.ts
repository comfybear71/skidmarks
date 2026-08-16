import fs from "fs";
import { NextResponse } from "next/server";

/**
 * Serve bytes with HTTP Range support. Mobile Safari/Chrome refuse to
 * play <video> inline without a 206 response to their Range probe — every
 * mp4/mp3 route here used to always return the whole file with 200, which
 * downloads fine (curl, VLC, "Save to device") but silently fails to play
 * in the page itself.
 */
export function serveMediaBuffer(
  req: Request,
  buf: Buffer,
  contentType: string,
  extraHeaders?: Record<string, string>,
): NextResponse {
  const total = buf.length;
  const baseHeaders: Record<string, string> = {
    "Content-Type": contentType,
    "Accept-Ranges": "bytes",
    ...extraHeaders,
  };

  const range = req.headers.get("range");
  if (!range) {
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: { ...baseHeaders, "Content-Length": String(total) },
    });
  }

  const m = /^bytes=(\d*)-(\d*)$/.exec(range);
  const start = m?.[1] ? parseInt(m[1], 10) : 0;
  const end = m?.[2] ? parseInt(m[2], 10) : total - 1;
  if (!m || Number.isNaN(start) || Number.isNaN(end) || start > end || end >= total) {
    return new NextResponse(null, {
      status: 416,
      headers: { ...baseHeaders, "Content-Range": `bytes */${total}` },
    });
  }

  const slice = buf.subarray(start, end + 1);
  return new NextResponse(new Uint8Array(slice), {
    status: 206,
    headers: {
      ...baseHeaders,
      "Content-Range": `bytes ${start}-${end}/${total}`,
      "Content-Length": String(slice.length),
    },
  });
}

export function serveMediaFile(
  req: Request,
  filePath: string,
  contentType: string,
  extraHeaders?: Record<string, string>,
): NextResponse {
  return serveMediaBuffer(
    req,
    fs.readFileSync(filePath),
    contentType,
    extraHeaders,
  );
}
