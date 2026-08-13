import { NextResponse } from "next/server";
import { listCharacters } from "@/lib/characters";
import {
  addLocationPlate,
  getLocation,
  locationRefPath,
} from "@/lib/locations";
import {
  buildLocationPrompt,
  generateFaceImage,
  imageKeyPresent,
} from "@/lib/imageGen";

export const runtime = "nodejs";
export const maxDuration = 120;

type Ctx = { params: Promise<{ id: string }> };

export async function GET() {
  return NextResponse.json({ imageReady: imageKeyPresent() });
}

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const l = getLocation(id);
  if (!l) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!imageKeyPresent()) {
    return NextResponse.json(
      { error: "Missing XAI_API_KEY in MY MOVIES\\.env" },
      { status: 503 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    note?: string;
    styleRealism?: number;
    roomId?: string;
  };
  const roomId = body.roomId || l.rooms[0]?.id;
  const room = l.rooms.find((r) => r.id === roomId);
  if (!room) {
    return NextResponse.json(
      { error: "Add a room first" },
      { status: 400 },
    );
  }

  const note = (body.note || "").trim();
  const styleRealism = body.styleRealism ?? 60;

  const chars = listCharacters();
  const residentNames = l.characterIds
    .map((cid) => chars.find((c) => c.id === cid)?.name)
    .filter(Boolean) as string[];

  const rejectHints = room.plateAttempts
    .filter((a) => a.status === "rejected" && a.reason)
    .slice(0, 5)
    .map((a) => a.reason);

  const refList = [...room.references, ...l.references];
  const paths = refList
    .map((r) => locationRefPath(id, r.fileName, room.id))
    .filter(Boolean) as string[];

  const lookNote = [l.lookNote, room.lookNote].filter(Boolean).join("\n");
  if (!note && !lookNote && paths.length === 0) {
    return NextResponse.json(
      { error: "Need look notes, attempt text, or a reference" },
      { status: 400 },
    );
  }

  const prompt = buildLocationPrompt({
    name: `${l.name} — ${room.name}`,
    notes: [l.notes, room.notes].filter(Boolean).join("\n"),
    lookNote,
    note,
    styleRealism,
    rejectHints,
    residentNames,
  });

  try {
    const { buffer, ext } = await generateFaceImage({
      prompt,
      referencePaths: paths.slice(0, 3),
      aspectRatio: "3:2",
    });
    const result = addLocationPlate(id, {
      roomId: room.id,
      note,
      buffer,
      ext,
      styleRealism,
      source: "generated",
    });
    if (!result)
      return NextResponse.json({ error: "Save failed" }, { status: 500 });
    return NextResponse.json({
      location: result.location,
      attempt: result.attempt,
      roomId: room.id,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
