import fs from "fs";
import { NextResponse } from "next/server";
import {
  episodePackDir,
  listCrashLabEpisodes,
  openCrashLabEpisode,
  saveCrashLabEpisode,
} from "@/lib/crashLabEpisodes";
import { deleteNeonEpisode } from "@/lib/neonStore";
import { deleteBlobFiles } from "@/lib/blobStore";
import { parseStyleCardId } from "@/lib/styleCardThumbs";
import { crashLabShowFolderName } from "@/lib/showArchivePaths";
import { readActivePack } from "@/lib/crashActivePack";
// Aliased: a plain env check, not a React hook — the `use` prefix
// otherwise trips rules-of-hooks at every call site in this route.
import { useCloudStore as cloudStoreEnabled } from "@/lib/cloudEnv";
import {
  cloudActivePack,
  listCloudEpisodes,
  openCloudEpisode,
  readCloudStory,
  saveCloudEpisodeMeta,
} from "@/lib/cloudPack";
import { emptyStory } from "@/lib/crashStory";

export const runtime = "nodejs";

/** GET ?styleId= — list packs under that show's _CRASH_LAB only.
 *  GET ?active=1 — last opened episode (so Chrome can't sit on the wrong show). */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    if (url.searchParams.get("active") === "1") {
      const styleId = parseStyleCardId(url.searchParams.get("styleId"));
      if (cloudStoreEnabled()) {
        return NextResponse.json({
          pack: await cloudActivePack(styleId || undefined),
        });
      }
      const pack = readActivePack();
      if (styleId && pack && pack.styleId !== styleId) {
        return NextResponse.json({ pack: null });
      }
      return NextResponse.json({ pack });
    }
    const styleId = parseStyleCardId(url.searchParams.get("styleId") || "skidmarks");
    if (!styleId) {
      return NextResponse.json({ error: "Need styleId" }, { status: 400 });
    }
    if (cloudStoreEnabled()) {
      return NextResponse.json({
        episodes: await listCloudEpisodes(styleId),
        root: `shows/${styleId}/episodes`,
      });
    }
    return NextResponse.json({
      episodes: listCrashLabEpisodes(styleId),
      root: `MY MOVIES\\${crashLabShowFolderName(styleId)}\\_CRASH_LAB`,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

/**
 * POST { action: "save"|"open", styleId?, label?, folderName? }
 * Copy-only into / from that show's _CRASH_LAB\{Episode name}\
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      action?: string;
      styleId?: string;
      label?: string;
      folderName?: string;
      comfyDraft?: {
        global?: string;
        beats?: Record<string, { imageMotion?: string; segmentText?: string }>;
      };
    };
    const action = String(body.action || "").trim();

    if (action === "save") {
      const styleId = parseStyleCardId(body.styleId || null);
      if (!styleId) {
        return NextResponse.json({ error: "Need styleId" }, { status: 400 });
      }
      if (cloudStoreEnabled()) {
        const story = (await readCloudStory(styleId)) || emptyStory(styleId);
        const label =
          body.label?.trim() || story.campaignLabel || "Untitled episode";
        const folderName = body.folderName?.trim() || label;
        const saved = await saveCloudEpisodeMeta({
          styleId,
          folderName,
          label,
          story,
          comfyDraft: body.comfyDraft
            ? {
                global: String(body.comfyDraft.global || ""),
                beats: (body.comfyDraft.beats || {}) as Record<
                  string,
                  { imageMotion: string; segmentText: string }
                >,
              }
            : null,
        });
        return NextResponse.json({
          ok: true,
          episode: saved,
          path: saved.path,
        });
      }
      const saved = saveCrashLabEpisode({
        styleId,
        label: body.label?.trim() || undefined,
        folderName: body.folderName?.trim() || undefined,
        asNewVersion: (body as { asNewVersion?: boolean }).asNewVersion === true,
        comfyDraft: body.comfyDraft
          ? {
              global: String(body.comfyDraft.global || ""),
              beats: (body.comfyDraft.beats || {}) as Record<
                string,
                { imageMotion: string; segmentText: string }
              >,
            }
          : null,
      });
      return NextResponse.json({
        ok: true,
        episode: saved,
        path: `MY MOVIES\\${crashLabShowFolderName(styleId)}\\_CRASH_LAB\\${saved.folderName}`,
      });
    }

    if (action === "open") {
      const folderName = String(body.folderName || "").trim();
      const styleId = parseStyleCardId(body.styleId || null);
      if (!folderName) {
        return NextResponse.json({ error: "Need folderName" }, { status: 400 });
      }
      if (!styleId) {
        return NextResponse.json({ error: "Need styleId" }, { status: 400 });
      }
      if (cloudStoreEnabled()) {
        const opened = await openCloudEpisode({ folderName, styleId });
        return NextResponse.json({
          ok: true,
          story: opened.story,
          sceneKit: opened.sceneKit,
          comfyDraft: opened.comfyDraft,
          ltxCount: opened.ltxCount,
          ltxResults: opened.ltxResults,
          lipsyncCount: opened.lipsyncCount,
          meta: opened.meta,
          backupFile: opened.backupFile,
        });
      }
      const opened = openCrashLabEpisode({ folderName, styleId });
      return NextResponse.json({
        ok: true,
        story: opened.story,
        sceneKit: opened.sceneKit,
        comfyDraft: opened.comfyDraft,
        ltxCount: opened.ltxCount,
        lipsyncCount: opened.lipsyncCount,
        meta: opened.meta,
        backupFile: opened.backupFile,
      });
    }

    return NextResponse.json(
      { error: 'action must be "save" or "open"' },
      { status: 400 },
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

/**
 * DELETE ?styleId=&folderName= — remove one episode pack for good. No
 * confirmation short of this call itself, so the client is responsible for
 * asking first; this endpoint just does it.
 */
export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const styleId = parseStyleCardId(url.searchParams.get("styleId"));
    const folderName = (url.searchParams.get("folderName") || "").trim();
    if (!styleId) {
      return NextResponse.json({ error: "Need styleId" }, { status: 400 });
    }
    if (!folderName) {
      return NextResponse.json({ error: "Need folderName" }, { status: 400 });
    }

    if (cloudStoreEnabled()) {
      const { blobPathnames } = await deleteNeonEpisode(styleId, folderName);
      await deleteBlobFiles(blobPathnames);
      return NextResponse.json({ ok: true, blobFilesRemoved: blobPathnames.length });
    }

    const dir = episodePackDir(folderName, styleId);
    if (!dir || !fs.existsSync(dir)) {
      return NextResponse.json({ error: "Episode not found" }, { status: 404 });
    }
    fs.rmSync(dir, { recursive: true, force: true });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
