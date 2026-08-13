import { NextResponse } from "next/server";
import { listCrashLabImages } from "@/lib/crashLibrary";
import { formatCplateLabel } from "@/lib/cplateLabel";
import { useCloudStore } from "@/lib/cloudEnv";
import { listNeonFiles } from "@/lib/neonStore";

export const runtime = "nodejs";

/** GET — Crash Lab gen stills + morph draft tray for pickers elsewhere. */
export async function GET() {
  if (useCloudStore()) {
    const plates = await listNeonFiles({ kind: "plates" });
    return NextResponse.json({
      items: plates.map((f) => ({
        id: `gen:${f.filename}`,
        source: "gen",
        fileName: f.filename,
        url: `/api/crash/gen/file?name=${encodeURIComponent(f.filename)}`,
        label: formatCplateLabel(f.filename),
      })),
    });
  }
  return NextResponse.json({ items: listCrashLabImages() });
}
