import path from "path";
import { NextResponse } from "next/server";
import {
  parseWorldCardId,
  saveUploadAsWorldCard,
} from "@/lib/worldCardThumbs";
import type { WorldPlaceTypeId } from "@/lib/worldPlaceTypes";

export const runtime = "nodejs";

/** POST multipart: file, styleId, name?, brief? — add empty BG place to world gallery. */
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    const styleId = parseWorldCardId(String(form.get("styleId") || ""));
    const nameHint = String(form.get("name") || "").trim();
    const briefHint = String(form.get("brief") || "").trim();
    const placeType = String(
      form.get("placeType") || "social_public",
    ) as WorldPlaceTypeId;

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

    const preferred = path.basename(file.name || "").replace(/[^\w.\-]/g, "");
    const { thumbPath, thumbKey, label } = saveUploadAsWorldCard({
      buffer: Buffer.from(await file.arrayBuffer()),
      ext,
      styleId,
      preferredFileName: preferred || undefined,
      name: nameHint || undefined,
      brief: briefHint || undefined,
      placeType,
    });

    return NextResponse.json({
      ok: true,
      styleId,
      thumbPath,
      thumbKey,
      label,
      url: `/api/crash/world-cards/file?styleId=${encodeURIComponent(styleId)}&thumb=${encodeURIComponent(thumbKey)}&t=${Date.now()}`,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
