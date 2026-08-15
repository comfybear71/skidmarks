import path from "path";
import { NextResponse } from "next/server";
import { parseStyleCardId } from "@/lib/styleCardThumbs";
import { saveCharacterPlate } from "@/lib/characterPlates";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST multipart: file, styleId, name, note? — store one character's
 * multi-view sheet on the show's shelf.
 *
 * name is required rather than inferred from the filename: the plate is
 * looked up by character name later, and a sheet filed under the wrong name
 * is worse than one that was never uploaded.
 */
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    const styleId = parseStyleCardId(String(form.get("styleId") || ""));
    const name = String(form.get("name") || "").trim();
    const note = String(form.get("note") || "").trim();

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Need an image file" }, { status: 400 });
    }
    if (!styleId) {
      return NextResponse.json({ error: "Need a valid styleId" }, { status: 400 });
    }
    if (!name) {
      return NextResponse.json(
        { error: "Need the character name this plate belongs to" },
        { status: 400 },
      );
    }

    const ext =
      path.extname(file.name || "").toLowerCase() ||
      (file.type.includes("jpeg") || file.type.includes("jpg")
        ? ".jpg"
        : file.type.includes("webp")
          ? ".webp"
          : ".png");

    const plate = await saveCharacterPlate({
      styleId,
      name,
      note,
      ext,
      buffer: Buffer.from(await file.arrayBuffer()),
    });

    return NextResponse.json({ ok: true, plate });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
