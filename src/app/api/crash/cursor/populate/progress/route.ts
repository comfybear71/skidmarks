import { NextResponse } from "next/server";
import { readPopulateProgress } from "@/lib/cursorPopulateProgress";

export const runtime = "nodejs";

/** GET — live populate meter for CURSOR tour banner. */
export async function GET() {
  const progress = readPopulateProgress();
  if (!progress || progress.phase === "idle") {
    return NextResponse.json({
      ok: true,
      active: false,
      phase: "idle",
      current: 0,
      total: 0,
      label: "",
      pct: 0,
    });
  }
  const total = Math.max(1, progress.total);
  const pct = Math.round((progress.current / total) * 100);
  return NextResponse.json({
    ok: true,
    active: progress.phase !== "done" && progress.phase !== "error",
    ...progress,
    pct,
  });
}
