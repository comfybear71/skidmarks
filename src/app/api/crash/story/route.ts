import { NextResponse } from "next/server";
import {
  clearCrashStory,
  emptyStory,
  readCrashStory,
  writeCrashStory,
  type CrashStoryDoc,
} from "@/lib/crashStory";
import { syncStoryVoiceFilesFromDisk } from "@/lib/crashStorySpeak";
import { parseStyleCardId } from "@/lib/styleCardThumbs";
import { useCloudStore } from "@/lib/cloudEnv";
import { readCloudEpisodeStory, writeCloudStory } from "@/lib/cloudPack";

export const runtime = "nodejs";

/** GET ?styleId= — load story layout (seeds Sunny Banks test gag on first open). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const styleId = parseStyleCardId(url.searchParams.get("styleId"));
  if (!styleId) {
    return NextResponse.json({ error: "Need styleId" }, { status: 400 });
  }
  if (useCloudStore()) {
    const folderName = url.searchParams.get("folderName")?.trim() || "";
    if (!folderName) {
      return NextResponse.json({ ok: true, story: emptyStory(styleId) });
    }
    const cloud = await readCloudEpisodeStory(styleId, folderName);
    return NextResponse.json({ ok: true, story: cloud || emptyStory(styleId) });
  }
  let story = readCrashStory(styleId);
  const synced = syncStoryVoiceFilesFromDisk(story);
  if (synced !== story) {
    writeCrashStory(synced);
    story = synced;
  }
  return NextResponse.json({ ok: true, story });
}

/** PUT — save full story doc. */
export async function PUT(req: Request) {
  try {
    const body = (await req.json()) as { story?: CrashStoryDoc };
    const story = body.story;
    if (!story?.styleId) {
      return NextResponse.json({ error: "Need story.styleId" }, { status: 400 });
    }
    if (useCloudStore()) {
      await writeCloudStory(story);
      return NextResponse.json({ ok: true, story });
    }
    writeCrashStory(story);
    return NextResponse.json({ ok: true, story });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}

/** POST { clear: true, styleId } — blank story; park dialogue mp3s in _cleared/. */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { clear?: boolean; styleId?: string };
    if (!body.clear) {
      return NextResponse.json({ error: "Need clear: true" }, { status: 400 });
    }
    const styleId = parseStyleCardId(body.styleId ?? null);
    if (!styleId) {
      return NextResponse.json({ error: "Need styleId" }, { status: 400 });
    }
    if (useCloudStore()) {
      const blank = emptyStory(styleId);
      return NextResponse.json({
        ok: true,
        story: blank,
        moved: [],
        movedCount: 0,
        backupFile: null,
        parkedIn: "(desk cleared — cloud pack left intact)",
      });
    }
    const result = clearCrashStory(styleId);
    return NextResponse.json({
      ok: true,
      story: result.story,
      moved: result.moved,
      movedCount: result.moved.length,
      backupFile: result.backupFile,
      parkedIn: result.parkedIn,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
