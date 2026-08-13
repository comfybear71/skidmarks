import path from "path";
import { NextResponse } from "next/server";
import { parseStyleCardId } from "@/lib/styleCardThumbs";
import { saveSwapResult, saveSwapTargetUpload, type SwapTargetRef } from "@/lib/swapCards";

export const runtime = "nodejs";

/** POST multipart — target upload OR swap result import */
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const mode = String(form.get("mode") || "import");
    const styleId = parseStyleCardId(String(form.get("styleId") || ""));
    const file = form.get("file");

    if (!styleId) {
      return NextResponse.json({ error: "Need styleId" }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Need file" }, { status: 400 });
    }

    const ext =
      path.extname(file.name || "").toLowerCase() ||
      (file.type.includes("jpeg") ? ".jpg" : file.type.includes("webp") ? ".webp" : ".png");
    const buf = Buffer.from(await file.arrayBuffer());

    if (mode === "target") {
      const { fileName } = saveSwapTargetUpload(styleId, buf, ext);
      const target: SwapTargetRef = { kind: "upload", fileName };
      return NextResponse.json({ ok: true, target, fileName });
    }

    const castKey = String(form.get("castKey") || "").trim();
    const castName = String(form.get("castName") || "").trim();
    const sourceKey = String(form.get("sourceKey") || "").trim();
    const targetKind = String(form.get("targetKind") || "");
    if (!castKey || !castName || !sourceKey) {
      return NextResponse.json({ error: "Need castKey, castName, sourceKey" }, { status: 400 });
    }

    let target: SwapTargetRef;
    if (targetKind === "world") {
      target = {
        kind: "world",
        styleId,
        thumbKey: String(form.get("targetThumbKey") || ""),
      };
    } else if (targetKind === "gen") {
      target = { kind: "gen", fileName: String(form.get("targetGenFile") || "") };
    } else if (targetKind === "upload") {
      target = { kind: "upload", fileName: String(form.get("targetUploadFile") || "") };
    } else {
      return NextResponse.json({ error: "Need targetKind" }, { status: 400 });
    }

    const label = saveSwapResult({
      styleId,
      castKey,
      castName,
      sourceKey,
      target,
      resultBuffer: buf,
      ext,
      engine: "manual-import",
    });

    return NextResponse.json({
      ok: true,
      label,
      url: `/api/crash/swap/file?styleId=${encodeURIComponent(styleId)}&file=${encodeURIComponent(label.resultFile)}&t=${Date.now()}`,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
