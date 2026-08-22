import { NextResponse } from "next/server";
import { addCastFace, castRefPath, getCastMember } from "@/lib/episodeCast";
import { buildFacePrompt, generateFaceImage, imageKeyPresent } from "@/lib/imageGen";
import { getEpisode } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 120;

type Ctx = { params: Promise<{ id: string; castId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { id, castId } = await ctx.params;
  if (!getEpisode(id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  const m = getCastMember(id, castId);
  if (!m) return NextResponse.json({ error: "Cast not found" }, { status: 404 });

  if (!imageKeyPresent()) {
    return NextResponse.json(
      { error: "Missing XAI_API_KEY in your environment variables" },
      { status: 503 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    note?: string;
    styleRealism?: number;
    referenceIds?: string[];
  };
  const note = (body.note || m.roleNote || "").trim();

  const refIds = body.referenceIds?.length
    ? body.referenceIds
    : m.references.map((r) => r.id);
  const referencePaths: string[] = [];
  for (const rid of refIds) {
    const ref = m.references.find((r) => r.id === rid);
    if (!ref) continue;
    const p = castRefPath(id, castId, ref.fileName);
    if (p) referencePaths.push(p);
  }

  if (!note && referencePaths.length === 0) {
    return NextResponse.json(
      { error: "Need a look / role note, or a reference image" },
      { status: 400 },
    );
  }

  const styleRealism = body.styleRealism ?? 60;
  const rejectHints = m.faceAttempts
    .filter((a) => a.status === "rejected" && a.reason)
    .slice(0, 5)
    .map((a) => a.reason);

  const prompt = buildFacePrompt({
    name: m.name,
    pastNote: m.roleNote,
    note,
    styleRealism,
    rejectHints,
  });

  try {
    const { buffer, ext } = await generateFaceImage({
      prompt,
      referencePaths,
    });
    const result = addCastFace(id, castId, {
      note,
      buffer,
      ext,
      styleRealism,
      source: "generated",
    });
    if (!result)
      return NextResponse.json({ error: "Save failed" }, { status: 500 });
    return NextResponse.json({
      episode: result.episode,
      attempt: result.attempt,
      usedReferences: referencePaths.length,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
