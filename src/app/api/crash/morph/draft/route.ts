import { NextResponse } from "next/server";
import {
  appendMorphDraft,
  clearMorphDraft,
  listMorphDraft,
  removeMorphDraftItem,
  reorderMorphDraft,
} from "@/lib/morph";

export const runtime = "nodejs";
export const maxDuration = 60;

/** GET — restore tray after refresh */
export async function GET() {
  return NextResponse.json({ items: listMorphDraft() });
}

/** POST multipart files — append to tray (saved on disk) */
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const files = form.getAll("files").filter((f): f is File => f instanceof File);
    if (!files.length) {
      return NextResponse.json({ error: "No images" }, { status: 400 });
    }
    files.sort((a, b) => {
      const na = a.name.match(/(\d+)/);
      const nb = b.name.match(/(\d+)/);
      if (na && nb) {
        const d = Number(na[1]) - Number(nb[1]);
        if (d !== 0) return d;
      }
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
    });
    const buffers: { buf: Buffer; ext: string }[] = [];
    for (const file of files) {
      const buf = Buffer.from(await file.arrayBuffer());
      const name = file.name || "step.png";
      const ext = name.includes(".") ? `.${name.split(".").pop()}` : ".png";
      buffers.push({ buf, ext });
    }
    const items = appendMorphDraft(buffers);
    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

/** PUT { ids: string[] } reorder · { remove: id } · { clear: true } */
export async function PUT(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      ids?: string[];
      remove?: string;
      clear?: boolean;
    };
    if (body.clear) {
      clearMorphDraft();
      return NextResponse.json({ items: [] });
    }
    if (body.remove) {
      return NextResponse.json({ items: removeMorphDraftItem(body.remove) });
    }
    if (Array.isArray(body.ids)) {
      return NextResponse.json({ items: reorderMorphDraft(body.ids) });
    }
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
