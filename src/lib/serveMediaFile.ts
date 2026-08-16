import fs from "fs";
import { NextResponse } from "next/server";

/**
 * Serve a local file with HTTP Range support. Mobile Safari/Chrome refuse to
 * play <video> inline without a 206 response to their Range probe — every
 * mp4/mp3 route here used to always return the whole file with 200, which
 * downloads fine (curl, VLC, "Save to device") but silently fails to play
 * in the page itself.
 */
export function serveMediaFile(
  req: Request,
  filePath: string,
  contentType: string,
  extraHeaders?: Record<string, string>,
): NextResponse {
  const stat = fs.statSync(filePath);
  const total = stat.size;
  const baseHeaders: Record<string, string> = {
    "Content-Type": contentType,
    "Accept-Ranges": "bytes",
    ...extraHeaders,
  };

  const range = req.headers.get("range");
  if (!range) {
    const buf = fs.readFileSync(filePath);
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

  const chunkSize = end - start + 1;
  const fd = fs.openSync(filePath, "r");
  const buf = Buffer.alloc(chunkSize);
  fs.readSync(fd, buf, 0, chunkSize, start);
  fs.closeSync(fd);

  return new NextResponse(new Uint8Array(buf), {
    status: 206,
    headers: {
      ...baseHeaders,
      "Content-Range": `bytes ${start}-${end}/${total}`,
      "Content-Length": String(chunkSize),
    },
  });
}
