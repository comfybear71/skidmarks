import fs from "fs";
import { NextResponse } from "next/server";
import { readCrashStory } from "@/lib/crashStory";
import { resolveBeatAudioPath, synthesizeStoryBeat } from "@/lib/crashStorySpeak";
import { parseStyleCardId } from "@/lib/styleCardThumbs";
import { cloudBlobRedirect, isSafeMediaName } from "@/lib/cloudMedia";

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

    const result = await synthesizeStoryBeat({
      styleId,
      beatId,
      speaker,
      text,
    });

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

  const voiceFile =
    url.searchParams.get("f")?.trim() ||
    url.searchParams.get("voiceFile")?.trim() ||
    undefined;

  const cloudName =
    (voiceFile && isSafeMediaName(voiceFile) && voiceFile) ||
    (isSafeMediaName(`${beatId}.mp3`) ? `${beatId}.mp3` : "");
  if (cloudName) {
    const cloud = await cloudBlobRedirect("audio", cloudName);
    if (cloud) return cloud;
  }

  let filePath = resolveBeatAudioPath(styleId, beatId, voiceFile);
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
