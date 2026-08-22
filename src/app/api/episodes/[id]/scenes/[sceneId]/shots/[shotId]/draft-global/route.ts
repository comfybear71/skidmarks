import { NextResponse } from "next/server";
import {
  cleanGlobalDraft,
  draftGlobalSystem,
  draftGlobalUser,
} from "@/lib/draftBeat";
import { getEpisode } from "@/lib/store";
import { askGrok, textKeyPresent } from "@/lib/textGen";
import { ensureShotBeats } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

type Ctx = {
  params: Promise<{ id: string; sceneId: string; shotId: string }>;
};

/** Draft GLOBAL (the once-per-queue lip-sync line) for this shot. */
export async function POST(req: Request, ctx: Ctx) {
  const { id, sceneId, shotId } = await ctx.params;

  if (!textKeyPresent()) {
    return NextResponse.json(
      { error: "Missing XAI_API_KEY in your environment variables" },
      { status: 503 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    nudge?: string;
    /** On-screen value, so an unsaved edit is used as context */
    global?: string;
  };

  const episode = getEpisode(id);
  const scene = episode?.scenes.find((s) => s.id === sceneId);
  const shotRaw = scene?.shots.find((s) => s.id === shotId);
  if (!episode || !scene || !shotRaw) {
    return NextResponse.json({ error: "Shot not found" }, { status: 404 });
  }

  const shot = ensureShotBeats(shotRaw);
  const withOnScreen = {
    ...shot,
    global: body.global !== undefined ? body.global : shot.global,
  };

  try {
    const text = await askGrok({
      system: draftGlobalSystem(),
      user: draftGlobalUser({
        episode,
        scene,
        shot: withOnScreen,
        nudge: (body.nudge || "").trim(),
      }),
    });
    return NextResponse.json({
      text: cleanGlobalDraft(text),
      label: "GLOBAL",
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
