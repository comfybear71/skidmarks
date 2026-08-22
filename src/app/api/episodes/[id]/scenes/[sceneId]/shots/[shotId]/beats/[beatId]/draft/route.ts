import { NextResponse } from "next/server";
import { getCharacter, listCharacters } from "@/lib/characters";
import {
  cleanDraft,
  DRAFT_FIELDS,
  draftSystem,
  draftUser,
  labelFor,
  type DraftField,
} from "@/lib/draftBeat";
import { getLocation } from "@/lib/locations";
import { getEpisode } from "@/lib/store";
import { askGrok, textKeyPresent } from "@/lib/textGen";
import { ensureShotBeats } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

type Ctx = {
  params: Promise<{
    id: string;
    sceneId: string;
    shotId: string;
    beatId: string;
  }>;
};

/** Draft one prompt box for one beat. Press again for a different take. */
export async function POST(req: Request, ctx: Ctx) {
  const { id, sceneId, shotId, beatId } = await ctx.params;

  if (!textKeyPresent()) {
    return NextResponse.json(
      { error: "Missing XAI_API_KEY in your environment variables" },
      { status: 503 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    field?: string;
    nudge?: string;
    /** On-screen values, so unsaved edits are used as context */
    beat?: {
      platePrompt?: string;
      imageMotion?: string;
      textSegment?: string;
      actionSegment?: string;
      speaker?: string;
      label?: string;
    };
  };

  const field = body.field as DraftField;
  if (!DRAFT_FIELDS.includes(field)) {
    return NextResponse.json({ error: "Unknown field" }, { status: 400 });
  }

  const episode = getEpisode(id);
  const scene = episode?.scenes.find((s) => s.id === sceneId);
  const shotRaw = scene?.shots.find((s) => s.id === shotId);
  if (!episode || !scene || !shotRaw) {
    return NextResponse.json({ error: "Shot not found" }, { status: 404 });
  }

  const shot = ensureShotBeats(shotRaw);
  const beatIndex = shot.beats.findIndex((b) => b.id === beatId);
  if (beatIndex < 0) {
    return NextResponse.json({ error: "Beat not found" }, { status: 404 });
  }

  // What's on screen wins over what's on disk
  const beat = { ...shot.beats[beatIndex], ...(body.beat || {}) };
  const beats = shot.beats.map((b, i) => (i === beatIndex ? beat : b));

  const location = scene.locationId ? getLocation(scene.locationId) : null;
  const room = location?.rooms.find((r) => r.id === scene.roomId) || null;

  try {
    const text = await askGrok({
      system: draftSystem(field),
      user: draftUser({
        episode,
        scene,
        shot: { ...shot, beats },
        beat,
        beatIndex,
        beatCount: beats.length,
        location,
        room,
        victim: episode.victimCharacterId
          ? getCharacter(episode.victimCharacterId)
          : null,
        lab: listCharacters(),
        cast: episode.cast || [],
        field,
        nudge: (body.nudge || "").trim(),
      }),
    });
    return NextResponse.json({
      text: cleanDraft(field, text),
      field,
      label: labelFor(field),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
