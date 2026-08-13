import { NextResponse } from "next/server";
import { getEpisode, patchShotPrompts } from "@/lib/store";
import type { SavedText, SavedVoice } from "@/lib/types";

export const runtime = "nodejs";

type Ctx = {
  params: Promise<{ id: string; sceneId: string; shotId: string }>;
};

/** Persist GLOBAL + beat IMAGE/TEXT/histories without wiping plates. */
export async function POST(req: Request, ctx: Ctx) {
  const { id, sceneId, shotId } = await ctx.params;
  if (!getEpisode(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    global?: string;
    aiNudgeGlobal?: string;
    cutUnder?: string;
    resolveNotes?: string;
    script?: string;
    globalHistory?: SavedText[];
    cutUnderHistory?: SavedText[];
    resolveNotesHistory?: SavedText[];
    scriptHistory?: SavedText[];
    beats?: {
      id: string;
      label?: string;
      speaker?: string;
      platePrompt?: string;
      imageMotion?: string;
      textSegment?: string;
      imageSeconds?: number;
      textSeconds?: number;
      actionSegment?: string;
      actionSeconds?: number;
      gapAfterSeconds?: number;
      aiNudge?: string;
      voiceFile?: string;
      plateFile?: string;
      platePromptHistory?: SavedText[];
      imageMotionHistory?: SavedText[];
      textSegmentHistory?: SavedText[];
      actionSegmentHistory?: SavedText[];
      voiceHistory?: SavedVoice[];
    }[];
  };

  const episode = patchShotPrompts(id, sceneId, shotId, body);
  if (!episode) {
    return NextResponse.json({ error: "Shot not found" }, { status: 404 });
  }
  return NextResponse.json({ episode });
}
