import { NextResponse } from "next/server";
import { retireCplate } from "@/lib/cplateManifest";

export const runtime = "nodejs";

/** POST { fileName } — hide plate from dropdown (moves to gen/retired/, not deleted) */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { fileName?: string };
    const fileName = String(body.fileName || "").trim();
    if (!fileName) {
      return NextResponse.json({ error: "Need fileName" }, { status: 400 });
    }
    if (!retireCplate(fileName)) {
      return NextResponse.json({ error: "Plate not found or invalid name" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, fileName });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
