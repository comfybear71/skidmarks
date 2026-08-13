import { NextResponse } from "next/server";
import {
  readCrashLabImage,
  type CrashLabImageSource,
} from "@/lib/crashLibrary";
import { addReference, getCharacter } from "@/lib/characters";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** POST { source: "gen" | "draft", fileName, label? } — copy Crash Lab still into character refs. */
export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!getCharacter(id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    source?: CrashLabImageSource;
    fileName?: string;
    label?: string;
  };
  const source = body.source;
  const fileName = (body.fileName || "").trim();
  if ((source !== "gen" && source !== "draft") || !fileName) {
    return NextResponse.json({ error: "Need source + fileName" }, { status: 400 });
  }

  const file = readCrashLabImage(source, fileName);
  if (!file)
    return NextResponse.json({ error: "Image not found" }, { status: 404 });

  const label =
    body.label?.trim() ||
    (source === "gen" ? "Crash Lab gen" : "Crash Lab morph");
  const result = addReference(id, {
    buffer: file.buffer,
    ext: file.ext,
    label,
  });
  if (!result)
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  return NextResponse.json(result);
}
