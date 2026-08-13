import { NextResponse } from "next/server";
import { cloudEnvReady, useCloudStore } from "@/lib/cloudEnv";
import { uploadPackToCloud } from "@/lib/uploadPackToCloud";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * POST { styleId, folderName, dryRun? }
 * Copies one local pack into Blob + Neon. Default is dry-run (no upload).
 * Run from local Studio — Vercel has no Desktop folders.
 */
export async function POST(req: Request) {
  try {
    if (useCloudStore()) {
      return NextResponse.json(
        { error: "Upload from local Studio on your PC, not from Vercel." },
        { status: 400 },
      );
    }
    if (!cloudEnvReady()) {
      return NextResponse.json(
        { error: "Need DATABASE_URL and BLOB_READ_WRITE_TOKEN on this PC." },
        { status: 400 },
      );
    }
    const body = (await req.json().catch(() => ({}))) as {
      styleId?: string;
      folderName?: string;
      dryRun?: boolean;
    };
    const styleId = String(body.styleId || "").trim();
    const folderName = String(body.folderName || "").trim();
    if (!styleId || !folderName) {
      return NextResponse.json(
        { error: "Need styleId and folderName" },
        { status: 400 },
      );
    }
    const dryRun = body.dryRun !== false;
    const result = await uploadPackToCloud({ styleId, folderName, dryRun });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
