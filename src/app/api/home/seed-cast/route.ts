import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { putBlobFile, blobContentType } from "@/lib/blobStore";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET — one-time (idempotent, safe to re-run) push of the home page's
 * cast cutouts from public/skid-cast/ up to Blob storage, at a fixed
 * pathname per file (addRandomSuffix:false in putBlobFile), so the URLs
 * are predictable and can be hardcoded on the client without a round
 * trip. Visit this once after a deploy that adds/changes cast images.
 */
export async function GET() {
  const dir = path.join(process.cwd(), "public", "skid-cast");
  let files: string[];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith(".webp"));
  } catch (e) {
    return NextResponse.json(
      { error: `Can't read ${dir}: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    );
  }
  if (!files.length) {
    return NextResponse.json({ error: `No .webp files in ${dir}` }, { status: 404 });
  }

  const results: { file: string; url?: string; error?: string }[] = [];
  for (const file of files) {
    try {
      const body = fs.readFileSync(path.join(dir, file));
      const put = await putBlobFile({
        pathname: `home/skid-cast/${file}`,
        body,
        contentType: blobContentType("cast", file),
        allowOverwrite: true,
      });
      results.push({ file, url: put.url });
    } catch (e) {
      results.push({ file, error: e instanceof Error ? e.message : String(e) });
    }
  }

  const ok = results.filter((r) => r.url).length;
  const failed = results.filter((r) => r.error);
  return NextResponse.json({ ok, failed: failed.length, results });
}
