import { NextResponse } from "next/server";
import {
  addFaceAttempt,
  getCharacter,
  referenceFilePath,
} from "@/lib/characters";
import {
  buildFacePrompt,
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
  const c = getCharacter(id);
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!imageKeyPresent()) {
    return NextResponse.json(
      {
        error:
          "Missing XAI_API_KEY. Add your xAI / Grok key to MY MOVIES\\.env (same place as ElevenLabs), then restart Studio (npm run dev).",
      },
      { status: 503 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    note?: string;
    styleRealism?: number;
    referenceIds?: string[];
  };

  const note = (body.note || "").trim();
  if (!note && c.references.length === 0) {
    return NextResponse.json(
      { error: "Need a face description and/or a reference image" },
      { status: 400 },
    );
  }

  const styleRealism = body.styleRealism ?? 60;
  const refIds = body.referenceIds?.length
    ? body.referenceIds
    : c.references.map((r) => r.id);

  const paths: string[] = [];
  for (const rid of refIds) {
    const ref = c.references.find((r) => r.id === rid);
    if (!ref) continue;
    const p = referenceFilePath(id, ref.fileName);
    if (p) paths.push(p);
  }

  const rejectHints = c.faceAttempts
    .filter((a) => a.status === "rejected" && a.reason)
    .slice(0, 5)
    .map((a) => a.reason);

  const prompt = buildFacePrompt({
    name: c.name,
    pastNote: c.pastNote,
    note,
    styleRealism,
    rejectHints,
  });

  try {
    const { buffer, ext } = await generateFaceImage({
      prompt,
      referencePaths: paths,
    });
    const result = addFaceAttempt(id, {
      note,
      buffer,
      ext,
      styleRealism,
      source: "generated",
    });
    if (!result)
      return NextResponse.json({ error: "Save failed" }, { status: 500 });
    return NextResponse.json({
      character: result.character,
      attempt: result.attempt,
      usedReferences: paths.length,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
