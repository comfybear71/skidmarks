import path from "path";
import { NextResponse } from "next/server";
import {
  parseStyleCardId,
  saveUploadAsStyleCard,
} from "@/lib/styleCardThumbs";
import { rosterEntryByName } from "@/lib/styleCharacterRoster";

export const runtime = "nodejs";

/** POST multipart: file, styleId, name? — add face PNG to style-cards gallery. */
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    const styleId = parseStyleCardId(String(form.get("styleId") || ""));
    const nameHint = String(form.get("name") || "").trim();
    const briefHint = String(form.get("brief") || "").trim();

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Need an image file" }, { status: 400 });
    }
    if (!styleId) {
      return NextResponse.json(
        { error: "Pick a show style in Script desk first" },
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

    const baseName = path
      .basename(file.name || "", ext)
      .replace(/[_-]+/g, " ")
      .trim();
    const rosterName =
      (nameHint
        ? rosterEntryByName(styleId, nameHint)?.name ?? nameHint
        : undefined) ||
      (baseName ? rosterEntryByName(styleId, baseName)?.name : undefined) ||
      (baseName
        ? rosterEntryByName(
            styleId,
            baseName.replace(/\b\w/g, (c) => c.toUpperCase()),
          )?.name
        : undefined);

    const { thumbPath, thumbKey, label } = saveUploadAsStyleCard({
      buffer: Buffer.from(await file.arrayBuffer()),
      ext,
      styleId,
      name: rosterName,
      brief: briefHint || undefined,
    });

    return NextResponse.json({
      ok: true,
      styleId,
      thumbPath,
      thumbKey,
      label,
      url: `/api/crash/style-cards/file?styleId=${encodeURIComponent(styleId)}&thumb=${encodeURIComponent(thumbKey)}&t=${Date.now()}`,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
