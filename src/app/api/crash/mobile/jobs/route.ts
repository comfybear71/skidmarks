import { NextResponse } from "next/server";
import { listMobileGenJobs } from "@/lib/mobileGenJob";
import { DEFAULT_DESK_ID, normalizeDeskId } from "@/lib/mobileDesk";

export const runtime = "nodejs";

/** GET ?desk=mum — this desk's jobs only. Untagged rows are Stuie's. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const desk = normalizeDeskId(url.searchParams.get("desk") || DEFAULT_DESK_ID);
  const jobs = await listMobileGenJobs(desk);
  return NextResponse.json({
    ok: true,
    desk,
    jobs: jobs.map((j) => ({
      id: j.id,
      prompt: j.prompt,
      folderName: j.folderName,
      phase: j.phase,
      updatedAt: j.updatedAt,
      speakers: j.speakers,
    })),
  });
}
