import { NextResponse } from "next/server";
import { importWorldCardIntoLocation } from "@/lib/crashSceneKitImport";

export const runtime = "nodejs";

/** POST — copy a Crash world-card place into Location Lab. */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      styleId?: string;
      thumbKey?: string;
      locationId?: string;
      roomId?: string;
      name?: string;
      characterIds?: string[];
      approve?: boolean;
    };
    const result = importWorldCardIntoLocation({
      styleId: String(body.styleId || ""),
      thumbKey: String(body.thumbKey || ""),
      locationId: body.locationId,
      roomId: body.roomId,
      name: body.name,
      characterIds: body.characterIds,
      approve: body.approve,
    });
    return NextResponse.json({
      ok: true,
      location: result.location,
      roomId: result.roomId,
      attemptId: result.attemptId,
      createdLocation: result.createdLocation,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 400 },
    );
  }
}
