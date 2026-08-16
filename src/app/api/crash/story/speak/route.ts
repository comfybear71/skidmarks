import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { readCrashStory } from "@/lib/crashStory";
import { resolveBeatAudioPath, synthesizeStoryBeat } from "@/lib/crashStorySpeak";
import { parseStyleCardId } from "@/lib/styleCardThumbs";
import { cloudBlobRedirect, isSafeMediaName } from "@/lib/cloudMedia";
import { useCloudStore } from "@/lib/cloudEnv";
import { cloudActivePack } from "@/lib/cloudPack";
import { hydrateMobilePackOnDisk, readMobileStory, writeMobileStory } from "@/lib/mobileStoryStore";
import { resolveMobileMedia, uploadMobileMedia } from "@/lib/mobileMediaStore";
import { storyDialogueDir } from "@/lib/crashStoryLocations";

export const runtime = "nodejs";
export const maxDuration = 60;

/** POST — Gen mp3 for one story beat line. */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      styleId?: string;
      beatId?: string;
      speaker?: string;
      text?: string;
    };
    const styleId = parseStyleCardId(body.styleId || null);
    const beatId = String(body.beatId || "").trim();
    const speaker = String(body.speaker || "").trim();
    const text = String(body.text || "").trim();

    if (!styleId || !beatId) {
      return NextResponse.json(
        { error: "Need styleId and beatId" },
        { status: 400 },
      );
    }

    const pack = useCloudStore() ? await cloudActivePack(styleId) : null;
    if (pack?.folderName) {
      await hydrateMobilePackOnDisk(styleId, pack.folderName);
      await readMobileStory(styleId, pack.folderName);
    }

    const result = await synthesizeStoryBeat({
      styleId,
      beatId,
      speaker,
      text,
    });

    if (pack?.folderName && result.story.scenes?.length) {
      await writeMobileStory(result.story, pack.folderName);
      const localPath =
        resolveBeatAudioPath(styleId, beatId, result.voiceFile) ||
        path.join(storyDialogueDir(styleId), result.voiceFile);
      await uploadMobileMedia({
        styleId,
        folderName: pack.folderName,
        kind: "audio",
        localPath,
      });
    }

    return NextResponse.json({
      ok: true,
      voiceFile: result.voiceFile,
      story: result.story,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}

/** GET ?styleId=&beatId= — play story line mp3. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const styleId = parseStyleCardId(url.searchParams.get("styleId"));
  const beatId = String(url.searchParams.get("beatId") || "").trim();

  if (!styleId || !beatId) {
    return NextResponse.json({ error: "Need styleId and beatId" }, { status: 400 });
  }

  // Three client call sites sent this as "t" — a name this handler never
  // read — so every one of them always fell back to guessing the filename
  // was "<beatId>.mp3" instead of using the real voiceFile. Fixed at the
  // callers; accepted here too so a future caller using "t" fails the same
  // way the others did, not silently.
  const voiceFile =
    url.searchParams.get("f")?.trim() ||
    url.searchParams.get("voiceFile")?.trim() ||
    url.searchParams.get("t")?.trim() ||
    undefined;

  const cloudName =
    (voiceFile && isSafeMediaName(voiceFile) && voiceFile) ||
    (isSafeMediaName(`${beatId}.mp3`) ? `${beatId}.mp3` : "");
  if (cloudName) {
    const cloud = await cloudBlobRedirect("audio", cloudName, req);
    if (cloud) return cloud;
  }

  let filePath = resolveBeatAudioPath(styleId, beatId, voiceFile);
  if (!filePath && cloudName && useCloudStore()) {
    const pack = await cloudActivePack(styleId);
    if (pack?.folderName) {
      filePath = await resolveMobileMedia({
        styleId,
        folderName: pack.folderName,
        kind: "audio",
        fileName: cloudName,
        destPath: path.join(storyDialogueDir(styleId), cloudName),
      });
    }
  }
  if (!filePath) {
    try {
      const story = readCrashStory(styleId);
      for (const sc of story.scenes) {
        for (const sh of sc.shots) {
          const beat = sh.beats.find((b) => b.id === beatId);
          if (beat?.voiceFile) {
            filePath = resolveBeatAudioPath(styleId, beatId, beat.voiceFile);
            break;
          }
        }
        if (filePath) break;
      }
    } catch {
      /* ignore */
    }
  }

  if (!filePath) {
    return NextResponse.json({ error: "Audio missing — hit Gen mp3" }, { status: 404 });
  }

  return new NextResponse(fs.readFileSync(filePath), {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "private, max-age=60",
    },
  });
}
