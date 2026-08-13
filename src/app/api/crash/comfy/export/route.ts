import { NextResponse } from "next/server";
import { exportComfyBundle, readStoryJsonFile } from "@/lib/crashComfyExport";
import { readCrashStory } from "@/lib/crashStory";
import { parseStyleCardId } from "@/lib/styleCardThumbs";
import type { ShowStyleId } from "@/lib/showStylePresets";

export const runtime = "nodejs";

/** POST { styleId?, storyPath?, folderName? } — export Comfy folder with stack.txt + files */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      styleId?: string;
      storyPath?: string;
      folderName?: string;
    };

    const styleId = (parseStyleCardId(body.styleId || "sunny_banks") ||
      "sunny_banks") as ShowStyleId;

    const story = body.storyPath
      ? readStoryJsonFile(body.storyPath)
      : readCrashStory(styleId);

    const result = exportComfyBundle({
      story,
      styleId: (story.styleId as ShowStyleId) || styleId,
      folderName: body.folderName?.trim() || undefined,
    });

    return NextResponse.json({
      ok: true,
      ...result,
      message: `Exported → ${result.outRootRelative}`,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
