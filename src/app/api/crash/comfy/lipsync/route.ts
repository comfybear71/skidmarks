import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import {
  comfyDownloadView,
  comfyGetJson,
  pickComfyVideoOutput,
  resolveComfyUrl,
  type ComfyHistoryOutputs,
} from "@/lib/comfyClient";
import { listComfyBeats } from "@/lib/crashComfyStack";
import { readCrashStory } from "@/lib/crashStory";
import { resolveBeatAudioPath } from "@/lib/crashStorySpeak";
import {
  clearLipsyncResultsForStyle,
  listLipsyncResultsForStyle,
  runLipsyncSmoke,
  writeLipsyncBeatResult,
} from "@/lib/lipsyncSmoke";
import { listLtxResultsForStyle, ltxFilePath } from "@/lib/ltxSmoke";
import { CRASH_DIR } from "@/lib/paths";
import { parseStyleCardId } from "@/lib/styleCardThumbs";
import type { ShowStyleId } from "@/lib/showStylePresets";
import { sortableId } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 900;
export const dynamic = "force-dynamic";

type LipsyncBody = {
  styleId?: string;
  beatId?: string;
  /** Override LTX mp4 basename under data/crash/ltx/ */
  ltxFile?: string;
  comfyUrl?: string;
  /** Pull from Comfy history by promptId (or newest lipsync_v1d) without re-queue */
  recover?: boolean;
  promptId?: string;
  /** Quarantine lipsync mp4s + drop results.json — never delete */
  clear?: boolean;
};

/** GET ?styleId= — saved lipsync pulls for Animate after refresh */
export async function GET(req: Request) {
  const styleId = (parseStyleCardId(
    new URL(req.url).searchParams.get("styleId") || "sunny_banks",
  ) || "sunny_banks") as ShowStyleId;
  const results = listLipsyncResultsForStyle(styleId);
  return NextResponse.json({ styleId, results });
}

/**
 * POST { styleId, beatId?, ltxFile?, comfyUrl?, recover?, clear? }
 * Streams NDJSON progress — mirror of Send to LTX for MuseTalk WF_lipsync_v1d.
 */
export async function POST(req: Request) {
  let body: LipsyncBody;
  try {
    body = (await req.json()) as LipsyncBody;
  } catch {
    return NextResponse.json({ error: "Bad JSON body" }, { status: 400 });
  }

  const styleId = (parseStyleCardId(body.styleId || "sunny_banks") ||
    "sunny_banks") as ShowStyleId;

  if (body.clear) {
    try {
      const result = clearLipsyncResultsForStyle(
        styleId,
        body.beatId?.trim() || undefined,
      );
      return NextResponse.json({
        ok: true,
        styleId,
        beatId: body.beatId || null,
        cleared: result.cleared,
        moved: result.moved,
        parkedIn: "data/crash/lipsync/_cleared/",
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
      const promptId = (body.promptId || "").trim();
      let vid: {
        filename: string;
        subfolder: string;
        type: string;
        promptId?: string;
      } | null = null;

      if (promptId) {
        const hist = (await comfyGetJson(
          resolved.url,
          `/history/${promptId}`,
          { timeoutMs: 60_000 },
        )) as Record<string, { outputs?: Record<string, ComfyHistoryOutputs> }>;
        const entry = hist[promptId];
        const outputs = entry?.outputs || {};
        const all: Array<{
          filename: string;
          subfolder: string;
          type: string;
        }> = [];
        for (const nodeOut of Object.values(outputs)) {
          if (!nodeOut || typeof nodeOut !== "object") continue;
          for (const val of Object.values(nodeOut)) {
            if (!Array.isArray(val)) continue;
            for (const raw of val) {
              const f = raw as {
                filename?: string;
                subfolder?: string;
                type?: string;
              };
              if (!f.filename || !/\.(mp4|webm)$/i.test(f.filename)) continue;
              if (!/lipsync_v1d|MuseTalkCrop/i.test(f.filename)) continue;
              all.push({
                filename: f.filename,
                subfolder: f.subfolder || "",
                type: f.type || "output",
              });
            }
          }
        }
        const main =
          all.find((f) => /lipsync_v1d/i.test(f.filename)) ||
          pickComfyVideoOutput(outputs);
        if (main) {
          vid = { ...main, promptId };
        }
      }

      if (!vid) {
        // Fallback: newest history entry with lipsync_v1d
        const hist = (await comfyGetJson(resolved.url, "/history", {
          timeoutMs: 60_000,
        })) as Record<
          string,
          { outputs?: Record<string, ComfyHistoryOutputs> }
        >;
        const ids = Object.keys(hist).reverse();
        for (const id of ids.slice(0, 40)) {
          const outputs = hist[id]?.outputs || {};
          for (const nodeOut of Object.values(outputs)) {
            if (!nodeOut || typeof nodeOut !== "object") continue;
            for (const val of Object.values(nodeOut)) {
              if (!Array.isArray(val)) continue;
              for (const raw of val) {
                const f = raw as {
                  filename?: string;
                  subfolder?: string;
                  type?: string;
                };
                if (
                  f.filename &&
                  /lipsync_v1d/i.test(f.filename) &&
                  /\.(mp4|webm)$/i.test(f.filename)
                ) {
                  vid = {
                    filename: f.filename,
                    subfolder: f.subfolder || "",
                    type: f.type || "output",
                    promptId: id,
                  };
                  break;
                }
              }
              if (vid) break;
            }
            if (vid) break;
          }
          if (vid) break;
        }
      }

      if (!vid) {
        return NextResponse.json(
          {
            error:
              "No lipsync_v1d mp4 on Comfy to pull — run Lipsync first, or check Comfy output",
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
      const outDir = path.join(CRASH_DIR, "lipsync");
      fs.mkdirSync(outDir, { recursive: true });
      const safeBase = vid.filename.replace(/[^\w.-]+/g, "_");
      const outName = `${sortableId("lipsync")}_${safeBase}`;
      const hasVidExt = /\.(mp4|webm|mov|mkv)$/i.test(outName);
      const localMp4 = path.join(
        outDir,
        hasVidExt ? outName : `${outName}.mp4`,
      );
      fs.writeFileSync(localMp4, buf);
      const url = `/api/crash/comfy/lipsync/file?name=${encodeURIComponent(path.basename(localMp4))}`;
      writeLipsyncBeatResult({
        styleId,
        beatId: row.beatId,
        file: path.basename(localMp4),
        url,
        promptId: vid.promptId || "recover",
        at: new Date().toISOString(),
      });
      return NextResponse.json({
        ok: true,
        step: "done",
        message: "Done",
        beatId: row.beatId,
        url,
        file: path.basename(localMp4),
        promptId: vid.promptId || "recover",
      });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : String(e) },
        { status: 500 },
      );
    }
  }

  // Resolve LTX mp4 for this beat
  let ltxFile = (body.ltxFile || "").trim();
  if (!ltxFile) {
    const ltxHits = listLtxResultsForStyle(styleId).filter(
      (r) => r.beatId === row.beatId,
    );
    ltxFile = ltxHits[0]?.file || "";
  }
  if (!ltxFile) {
    return NextResponse.json(
      {
        error: `Beat ${row.beatId} has no LTX mp4 — Send to LTX first, then Lipsync`,
      },
      { status: 400 },
    );
  }
  const videoPath = ltxFilePath(ltxFile);
  if (!videoPath) {
    return NextResponse.json(
      { error: `LTX file not on disk: ${ltxFile}` },
      { status: 400 },
    );
  }

  const audioPath = resolveBeatAudioPath(
    styleId,
    row.beatId,
    row.voiceFile,
  );
  if (!audioPath || !fs.existsSync(audioPath)) {
    return NextResponse.json(
      { error: `Beat ${row.beatId} has no mp3 on disk` },
      { status: 400 },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = async (obj: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
        await new Promise((r) => setImmediate(r));
      };
      try {
        await send({
          step: "resolving",
          message: "Finding Comfy…",
          beatId: row.beatId,
        });
        const result = await runLipsyncSmoke({
          videoPath,
          audioPath,
          speaker: row.speaker,
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
