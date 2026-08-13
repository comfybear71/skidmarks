import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { buildCrashGenLook, generateFaceImage, imageKeyPresent } from "@/lib/imageGen";
import { CRASH_DIR } from "@/lib/paths";
import {
  DEFAULT_SHOW_STYLE,
  type ShowStyleId,
} from "@/lib/showStylePresets";
import { sortableId } from "@/lib/types";
import { crashGenDir } from "@/lib/crashActivePack";

export const runtime = "nodejs";
export const maxDuration = 120;

function clampRealism(n: unknown): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return 60;
  return Math.max(0, Math.min(100, Math.round(v)));
}

function genDir() {
  return crashGenDir();
}

/**
 * POST { prompt, aspectRatio?, refName? }
 * - No refName: fresh still from words.
 * - With refName: edit that stock still (clothes / face / hat / fatter…).
 */
export async function POST(req: Request) {
  try {
    if (!imageKeyPresent()) {
      return NextResponse.json(
        { error: "Missing XAI_API_KEY in MY MOVIES\\.env" },
        { status: 400 },
      );
    }
    const body = (await req.json().catch(() => ({}))) as {
      prompt?: string;
      aspectRatio?: string;
      refName?: string;
      styleId?: string;
      styleRealism?: number;
    };
    const user = (body.prompt || "").trim();
    if (!user) {
      return NextResponse.json({ error: "Need a prompt" }, { status: 400 });
    }
    const styleId = (body.styleId || DEFAULT_SHOW_STYLE) as ShowStyleId;
    const look = buildCrashGenLook(styleId, clampRealism(body.styleRealism));

    const refName = (body.refName || "").trim();
    if (refName) {
      if (refName.includes("..") || refName.includes("/") || refName.includes("\\")) {
        return NextResponse.json({ error: "Bad ref" }, { status: 400 });
      }
      const refPath = path.join(genDir(), refName);
      if (!fs.existsSync(refPath)) {
        return NextResponse.json(
          { error: "Stock image missing — drop or Generate one first" },
          { status: 404 },
        );
      }

      const full = [
        `Same person as the attached image — ${user}`,
        look,
        "Gentle change only. Keep the same face identity, pose and framing unless the change above asks otherwise. Do not turn them into someone else. Do not add extra people. No writing, no captions, no watermarks.",
      ].join("\n\n");

      const { buffer, ext } = await generateFaceImage({
        prompt: full,
        referencePaths: [refPath],
      });

      const id = sortableId("ctweak");
      const fileName = `${id}${ext.startsWith(".") ? ext : `.${ext}`}`;
      fs.writeFileSync(path.join(genDir(), fileName), buffer);

      return NextResponse.json({
        ok: true,
        id,
        fileName,
        tweaked: true,
        url: `/api/crash/gen/file?name=${encodeURIComponent(fileName)}`,
      });
    }

    const full = `${user}\n\n${look}`;
    const { buffer, ext } = await generateFaceImage({
      prompt: full,
      referencePaths: [],
      aspectRatio: body.aspectRatio || "16:9",
    });

    const id = sortableId("cgen");
    const fileName = `${id}${ext.startsWith(".") ? ext : `.${ext}`}`;
    fs.writeFileSync(path.join(genDir(), fileName), buffer);

    return NextResponse.json({
      ok: true,
      id,
      fileName,
      tweaked: false,
      url: `/api/crash/gen/file?name=${encodeURIComponent(fileName)}`,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
