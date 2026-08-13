import { NextResponse } from "next/server";
import { listWanFxPlates, WAN_FX_PLATES_DIR } from "@/lib/wanFxPaths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — stills in `_XX_SPX\_PLATES` for the boom picker */
export async function GET() {
  const plates = listWanFxPlates();
  return NextResponse.json({
    dir: WAN_FX_PLATES_DIR,
    count: plates.length,
    plates: plates.map((p) => ({
      name: p.name,
      mtime: p.mtime,
      size: p.size,
      url: `/api/crash/wan/plates/file?name=${encodeURIComponent(p.name)}`,
    })),
  });
}
