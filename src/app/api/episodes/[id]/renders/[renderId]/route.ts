import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { episodeRendersDir, getEpisode } from "@/lib/store";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string; renderId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id, renderId } = await ctx.params;
  const ep = getEpisode(id);
  if (!ep) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let fileName = "";
  for (const sc of ep.scenes) {
    for (const sh of sc.shots) {
      const r = (sh.renders || []).find((x) => x.id === renderId);
      if (r?.fileName) {
        fileName = r.fileName;
        break;
      }
    }
    if (fileName) break;
  }
  if (!fileName) {
    return NextResponse.json({ error: "Render not found" }, { status: 404 });
  }

  const full = path.join(episodeRendersDir(id), fileName);
  if (!fs.existsSync(full)) {
    return NextResponse.json({ error: "File missing" }, { status: 404 });
  }

  const buf = fs.readFileSync(full);
  const ext = path.extname(fileName).toLowerCase();
  const type =
    ext === ".webm"
      ? "video/webm"
      : ext === ".mov"
        ? "video/quicktime"
        : "video/mp4";

  return new NextResponse(buf, {
    headers: {
      "Content-Type": type,
      "Cache-Control": "no-store",
    },
  });
}
