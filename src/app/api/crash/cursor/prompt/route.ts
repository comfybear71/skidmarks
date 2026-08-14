import { NextResponse } from "next/server";
import fs from "fs";
import {
  bootstrapPromptStory,
  promptArchivePreview,
} from "@/lib/cursorPromptBuild";
import { seedVoiceManifestForStyle } from "@/lib/crashVoiceSeed";
import { parseStyleCardId } from "@/lib/styleCardThumbs";
import { getShowStylePreset } from "@/lib/showStylePresets";
import {
  hydrateShowShelfManifests,
  persistCursorPackToCloud,
} from "@/lib/cursorCloudSync";

export const runtime = "nodejs";

/** GET ?styleId= — next episode number on disk (05 after 04, etc.). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const styleId = parseStyleCardId(url.searchParams.get("styleId"));
  if (!styleId) {
    return NextResponse.json({ error: "Need styleId" }, { status: 400 });
  }
  const campaignLabel = url.searchParams.get("campaignLabel") || undefined;
  if (url.searchParams.get("roster") === "1") {
    const { liveRosterForStyle, aiWriterTemplatePath } = await import(
      "@/lib/cursorAiWriterBriefServer"
    );
    const roster = liveRosterForStyle(styleId);
    return NextResponse.json({
      ok: true,
      styleId,
      styleLabel: getShowStylePreset(styleId).label,
      cast: roster.cast,
      places: roster.places,
      templateFile: aiWriterTemplatePath(styleId),
    });
  }
  if (url.searchParams.get("brief") === "1") {
    const { buildAiWriterBriefLive, aiWriterTemplatePath } = await import(
      "@/lib/cursorAiWriterBriefServer"
    );
    const templateFile = aiWriterTemplatePath(styleId);
    let brief = "";
    if (templateFile && fs.existsSync(templateFile)) {
      brief = fs.readFileSync(templateFile, "utf8").trim();
    }
    if (brief.length < 1500) {
      brief = buildAiWriterBriefLive(styleId).trim();
    }
    return NextResponse.json({
      ok: true,
      styleId,
      styleLabel: getShowStylePreset(styleId).label,
      brief,
      briefLength: brief.length,
      templateFile,
    });
  }
  const preview = promptArchivePreview(styleId, campaignLabel);
  const preset = getShowStylePreset(styleId);
  return NextResponse.json({
    ok: true,
    styleId,
    styleLabel: preset.label,
    highestNumber: preview.highestNumber,
    nextNumber: preview.nextNumber,
    nextFolderName: preview.nextFolderName,
  });
}

/** POST { styleId, script } — parse pasted script, seed story + populate config. */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      styleId?: string;
      script?: string;
    };
    const styleId = parseStyleCardId(body.styleId ?? null);
    if (!styleId) {
      return NextResponse.json({ error: "Need styleId" }, { status: 400 });
    }
    if (!body.script?.trim()) {
      return NextResponse.json({ error: "Need script text" }, { status: 400 });
    }

    // Vercel has no local shelf — mirror World/Cast names from Neon first so
    // the script's Place:/Cast: lines resolve to real gallery keys.
    await hydrateShowShelfManifests(styleId);

    const result = bootstrapPromptStory(styleId, body.script);
    seedVoiceManifestForStyle(styleId);
    await persistCursorPackToCloud({
      styleId,
      folderName: result.folderName,
      story: result.story,
      sceneKit: result.sceneKit,
    });

    return NextResponse.json({
      ok: true,
      story: result.story,
      backupFile: result.backupFile,
      campaignLabel: result.campaignLabel,
      nextNumber: result.nextNumber,
      nextFolderName: result.nextFolderName,
      folderName: result.folderName,
      kit: result.kit,
      message: `Episode queued: ${result.folderName}`,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 400 },
    );
  }
}
