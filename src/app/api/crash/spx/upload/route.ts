import { NextResponse } from "next/server";
import { addCrashSpxUpload, type CrashSpxKind } from "@/lib/crashSpx";
import { parseStyleCardId } from "@/lib/styleCardThumbs";

export const runtime = "nodejs";

/** POST multipart — file, styleId, kind=sfx|video, label?, note? */
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const styleId = parseStyleCardId(String(form.get("styleId") || ""));
    const kind = String(form.get("kind") || "") as CrashSpxKind;
    const file = form.get("file");
    const label = String(form.get("label") || "").trim();
    const note = String(form.get("note") || "").trim();

    if (!styleId) {
      return NextResponse.json({ error: "Need styleId" }, { status: 400 });
    }
    if (kind !== "sfx" && kind !== "video") {
      return NextResponse.json({ error: "kind must be sfx or video" }, { status: 400 });
    }
    if (!(file instanceof File) || file.size < 1) {
      return NextResponse.json({ error: "Need a file" }, { status: 400 });
    }

    const ext = (file.name.match(/\.[^.]+$/)?.[0] || "").toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());
    const item = addCrashSpxUpload({
      styleId,
      kind,
      buffer,
      ext: ext || (kind === "sfx" ? ".mp3" : ".mp4"),
      label: label || file.name.replace(/\.[^.]+$/, ""),
      note: note || undefined,
    });

    return NextResponse.json({
      ok: true,
      item,
      url: `/api/crash/spx/file?styleId=${encodeURIComponent(styleId)}&kind=${kind}&file=${encodeURIComponent(item.fileName)}&t=${Date.now()}`,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
