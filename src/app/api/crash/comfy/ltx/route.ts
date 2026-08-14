import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import {
  comfyDownloadView,
  comfyLtxMissingVideoError,
  resolveComfyLtxVideoToPull,
  resolveComfyUrl,
} from "@/lib/comfyClient";
import {
  beatDraftFields,
  CRASH_COMFY_DEFAULT_GLOBAL,
  listComfyBeats,
  type ComfyDraft,
} from "@/lib/crashComfyStack";
import { readCrashStory } from "@/lib/crashStory";
import { resolveBeatAudioPath } from "@/lib/crashStorySpeak";
import {
  clearLtxResultsForStyle,
  listLtxResultsForStyle,
  runLtxSmoke,
  writeLtxBeatResult,
} from "@/lib/ltxSmoke";
import { CRASH_DIR } from "@/lib/paths";
import { parseStyleCardId } from "@/lib/styleCardThumbs";
import type { ShowStyleId } from "@/lib/showStylePresets";
import { sortableId } from "@/lib/types";
import { useCloudStore } from "@/lib/cloudEnv";
import { cloudLtxResultsForStyle } from "@/lib/cloudPack";

export const runtime = "nodejs";
export const maxDuration = 900;
export const dynamic = "force-dynamic";

type LtxBody = {
  styleId?: string;
  beatId?: string;
  plateFile?: string;
  imageMotion?: string;
  segmentText?: string;
  global?: string;
  comfyUrl?: string;
  guideStrength?: number;
  /** Pull newest video/LTX_Director from Comfy without re-queueing */
  recover?: boolean;
  /** Quarantine LTX mp4s + drop results.json for this show (or one beat) — never delete */
  clear?: boolean;
};

/** GET ?styleId=&folderName= — pack mp4s mapped onto story beats */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const styleId = (parseStyleCardId(
    url.searchParams.get("styleId") || "sunny_banks",
  ) || "sunny_banks") as ShowStyleId;
  const folderName = url.searchParams.get("folderName")?.trim() || "";
  if (useCloudStore()) {
    const results = await cloudLtxResultsForStyle(
      styleId,
      folderName || undefined,
    );
    return NextResponse.json({ styleId, results });
  }
  const results = listLtxResultsForStyle(styleId);
  return NextResponse.json({ styleId, results });
}

/**
 * POST { styleId, beatId?, plateFile?, imageMotion?, segmentText?, global?, comfyUrl? }
 * Streams NDJSON progress lines, then a final { step:"done", ... } or { step:"error", error }.
 * Early validation failures still return plain JSON (not a stream).
 *
 * recover:true → probe video/LTX_Director on Comfy and pull (no new queue).
 */
export async function POST(req: Request) {
  let body: LtxBody;
  try {
    body = (await req.json()) as LtxBody;
  } catch {
    return NextResponse.json({ error: "Bad JSON body" }, { status: 400 });
  }

  const styleId = (parseStyleCardId(body.styleId || "sunny_banks") ||
    "sunny_banks") as ShowStyleId;

  if (body.clear) {
    try {
      const result = clearLtxResultsForStyle(
        styleId,
        body.beatId?.trim() || undefined,
      );
      return NextResponse.json({
        ok: true,
        styleId,
        beatId: body.beatId || null,
        cleared: result.cleared,
        moved: result.moved,
        parkedIn: "data/crash/ltx/_cleared/",
      });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : String(e) },
        { status: 500 },
      );
    }
  }

  const story = readCrashStory(styleId);
  const rows = listComfyBeats(story);
  const row =
    (body.beatId ? rows.find((r) => r.beatId === body.beatId) : null) ||
    rows.find((r) => r.plateFile) ||
    rows[0];

  if (!row) {
    return NextResponse.json(
      { error: "No beats in story — fill Story first" },
      { status: 400 },
    );
  }

  if (body.recover) {
    try {
      const resolved = await resolveComfyUrl(body.comfyUrl);
      if (!resolved.ok) {
        return NextResponse.json({ error: resolved.error }, { status: 502 });
      }
      // History SaveVideo outputs first (real name/subfolder/type), then /view probe
      const found = await resolveComfyLtxVideoToPull(resolved.url);
      const vid = found.video;
      if (!vid) {
        return NextResponse.json(
          {
            error: comfyLtxMissingVideoError(found),
          },
          { status: 404 },
        );
      }
      const buf = await comfyDownloadView({
        baseUrl: resolved.url,
        filename: vid.filename,
        subfolder: vid.subfolder,
        type: vid.type,
      });
      const outDir = path.join(CRASH_DIR, "ltx");
      fs.mkdirSync(outDir, { recursive: true });
      // Keep extension; strip only unsafe path chars (trailing _ before .mp4 stays)
      const safeBase = vid.filename.replace(/[^\w.-]+/g, "_");
      const outName = `${sortableId("ltx")}_${safeBase}`;
      const hasVidExt = /\.(mp4|webm|mov|mkv)$/i.test(outName);
      const localMp4 = path.join(
        outDir,
        hasVidExt ? outName : `${outName}.mp4`,
      );
      fs.writeFileSync(localMp4, buf);
      const url = `/api/crash/comfy/ltx/file?name=${encodeURIComponent(path.basename(localMp4))}`;
      writeLtxBeatResult({
        styleId,
        beatId: row.beatId,
        file: path.basename(localMp4),
        url,
        promptId: vid.promptId || "recover",
        at: new Date().toISOString(),
      });
      const comfyFile = vid.subfolder
        ? `${vid.subfolder}/${vid.filename}`
        : vid.filename;
      return NextResponse.json({
        ok: true,
        step: "done",
        message: "Done",
        beatId: row.beatId,
        url,
        file: path.basename(localMp4),
        comfyFile,
        via: found.via,
      });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : String(e) },
        { status: 500 },
      );
    }
  }

  const plateFile = (body.plateFile || row.plateFile || "").trim();
  if (!plateFile) {
    return NextResponse.json(
      { error: `Beat ${row.beatId} has no plate — drop a still first` },
      { status: 400 },
    );
  }

  const platePath = path.join(CRASH_DIR, "gen", plateFile);
  if (!fs.existsSync(platePath)) {
    return NextResponse.json(
      { error: `Plate not on disk: ${plateFile}` },
      { status: 400 },
    );
  }

  // Browser draft is not on the server — send IMAGE/SEGMENT/GLOBAL from the panel
  const draft: ComfyDraft = {
    global: body.global?.trim() || CRASH_COMFY_DEFAULT_GLOBAL,
    beats: {},
  };
  const fields = beatDraftFields(row, draft);
  const imageMotion = body.imageMotion?.trim() || fields.imageMotion;
  const segmentText = body.segmentText?.trim() || fields.segmentText;
  const globalPrompt = body.global?.trim() || CRASH_COMFY_DEFAULT_GLOBAL;

  if (!imageMotion && !segmentText) {
    return NextResponse.json(
      {
        error:
          "IMAGE motion and SEGMENT TEXT are both empty — fill one before Send to LTX",
      },
      { status: 400 },
    );
  }
  if (!globalPrompt) {
    return NextResponse.json(
      { error: "GLOBAL is empty — Reset GLOBAL, then Send" },
      { status: 400 },
    );
  }

  const audioPath = resolveBeatAudioPath(
    styleId,
    row.beatId,
    row.voiceFile,
  );

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = async (obj: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
        // Let Node flush the chunk so the browser sees steps live
        await new Promise((r) => setImmediate(r));
      };
      try {
        await send({
          step: "resolving",
          message: "Finding Comfy…",
          beatId: row.beatId,
        });
        const result = await runLtxSmoke({
          platePath,
          audioPath,
          imageMotion,
          segmentText,
          globalPrompt,
          guideStrength: body.guideStrength ?? 0.45,
          comfyUrl: body.comfyUrl,
          styleId,
          beatId: row.beatId,
          onProgress: (ev) => {
            void send({
              beatId: row.beatId,
              shotTitle: row.shotTitle,
              ...ev,
            });
          },
        });
        await send({
          step: "done",
          message: "Done",
          beatId: row.beatId,
          shotTitle: row.shotTitle,
          ...result,
        });
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        await send({
          step: "error",
          message: error,
          error,
          beatId: row.beatId,
          shotTitle: row.shotTitle,
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
