import { NextResponse } from "next/server";
import { exportComfyBundle } from "@/lib/crashComfyExport";
import {
  bootstrapCursorStory,
  crashStoryIsPopulated,
  readCrashStory,
} from "@/lib/crashStory";
import { seedVoiceManifestForStyle } from "@/lib/crashVoiceSeed";
import { CURSOR_TOUR_STYLE } from "@/lib/cursorPopulateConfig";
import { parseStyleCardId } from "@/lib/styleCardThumbs";
import type { CrashStoryDoc } from "@/lib/crashStoryTypes";

export const runtime = "nodejs";

function storyHasArchiveContent(story: CrashStoryDoc): boolean {
  if (story.campaignLabel?.trim()) return true;
  if (story.intro.logoFile || story.outro.logoFile) return true;
  for (const sc of story.scenes) {
    for (const sh of sc.shots) {
      if (sh.plateFile) return true;
      if (sh.beats.some((b) => b.text.trim() || b.voiceFile)) return true;
    }
  }
  return false;
}

/** GET ?styleId= — is the Cursor gag already built (plates on disk)? */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const styleId = parseStyleCardId(url.searchParams.get("styleId"));
  if (!styleId) {
    return NextResponse.json({ error: "Need styleId" }, { status: 400 });
  }
  return NextResponse.json({
    ok: true,
    populated: crashStoryIsPopulated(styleId),
    story: readCrashStory(styleId),
  });
}

/** POST { styleId? } — backup current story, seed fresh Cursor gag (skip if populated). */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      styleId?: string;
      force?: boolean;
    };
    const styleId = parseStyleCardId(body.styleId || CURSOR_TOUR_STYLE);
    if (!styleId) {
      return NextResponse.json({ error: "Need styleId" }, { status: 400 });
    }

    if (!body.force && crashStoryIsPopulated(styleId)) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        story: readCrashStory(styleId),
        message: "Story already built — kept existing plates",
      });
    }

    let archivedTo: string | null = null;
    if (body.force) {
      const existing = readCrashStory(styleId);
      if (storyHasArchiveContent(existing)) {
        const exported = exportComfyBundle({ story: existing, styleId });
        archivedTo = exported.archiveRootRelative;
      }
    }

    const { story, backupFile, gagLabel, error: bootstrapErr } =
      bootstrapCursorStory(styleId);
    if (bootstrapErr) {
      return NextResponse.json({ ok: false, error: bootstrapErr }, { status: 409 });
    }
    seedVoiceManifestForStyle(styleId);
    return NextResponse.json({
      ok: true,
      story,
      backupFile,
      archivedTo,
      gagLabel,
      message: archivedTo
        ? `Previous gag saved to ${archivedTo} — fresh: ${gagLabel || "new story"}`
        : gagLabel
          ? `Fresh episode seeded: ${gagLabel}`
          : backupFile
            ? `Previous story copied to ${backupFile}`
            : "Fresh story seeded",
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
