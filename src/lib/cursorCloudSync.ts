/**
 * CURSOR / PROMPT ↔ cloud store bridge.
 *
 * CURSOR and PROMPT build a new episode (story + scene-kit) using plain
 * synchronous disk-reading helpers (readWorldCardManifest, liveCastKeys,
 * cursorCastKeys) to resolve place/cast names to gallery keys, then persist
 * the result with writeCrashStory / writeSceneKitDiskDraft / writeActivePack
 * — all local-disk-only. On Vercel that disk is scratch (os.tmpdir()), so
 * none of it survives past the request.
 *
 * Two helpers close that gap without touching the shared resolver/writer
 * functions used by local Studio:
 *
 * - hydrateShowShelfManifests(): before CURSOR/PROMPT resolve names, mirror
 *   this show's World + Cast shelf rows from Neon into scratch-disk
 *   manifest.json files (same shape the local reader expects), so the
 *   existing synchronous resolvers just work.
 * - persistCursorPackToCloud(): after CURSOR/PROMPT build the episode shell,
 *   also save it to Neon (story_json + scene_kit_json) and mark it the open
 *   episode, mirroring what writeActivePack()/writeCrashStory() do locally.
 *
 * Both are no-ops when not running with the cloud store live.
 */
import fs from "fs";
import { useCloudStore } from "./cloudEnv";
import { listNeonShowFiles, markEpisodeOpened } from "./neonStore";
import { saveCloudEpisodeMeta } from "./cloudPack";
import {
  worldCardGalleryDir,
  worldCardManifestPath,
  type WorldCardThumbLabel,
} from "./worldCardThumbs";
import {
  styleCardGalleryDir,
  styleCardManifestPath,
  type StyleCardThumbLabel,
} from "./styleCardThumbs";
import type { WorldPlaceTypeId } from "./worldPlaceTypes";
import type { ShowStyleId } from "./showStylePresets";
import type { CrashStoryDoc } from "./crashStoryTypes";

/**
 * Mirror this show's World + Cast shelf labels from Neon into scratch disk
 * so CURSOR/PROMPT's synchronous name→key resolvers resolve real places and
 * cast on Vercel. No-op on local Studio (always reads real disk already).
 */
export async function hydrateShowShelfManifests(
  styleId: ShowStyleId,
): Promise<void> {
  if (!useCloudStore()) return;

  const [worldRows, castRows] = await Promise.all([
    listNeonShowFiles({ showId: styleId, kind: "world" }),
    listNeonShowFiles({ showId: styleId, kind: "cast" }),
  ]);

  if (worldRows.length) {
    const manifest: Record<string, WorldCardThumbLabel> = {};
    for (const row of worldRows) {
      manifest[`g:${row.filename}`] = {
        name: row.label_name || "",
        brief: row.label_brief || "",
        placeType: (row.place_type || "") as WorldPlaceTypeId,
      };
    }
    fs.mkdirSync(worldCardGalleryDir(styleId), { recursive: true });
    fs.writeFileSync(
      worldCardManifestPath(styleId),
      JSON.stringify(manifest, null, 2) + "\n",
    );
  }

  if (castRows.length) {
    const manifest: Record<string, StyleCardThumbLabel> = {};
    for (const row of castRows) {
      manifest[`g:${row.filename}`] = {
        name: row.label_name || "",
        brief: row.label_brief || "",
      };
    }
    fs.mkdirSync(styleCardGalleryDir(styleId), { recursive: true });
    fs.writeFileSync(
      styleCardManifestPath(styleId),
      JSON.stringify(manifest, null, 2) + "\n",
    );
  }
}

/**
 * After CURSOR/PROMPT build a new episode shell, also persist it to Neon
 * (story + scene-kit) and mark it the open episode — mirrors writeActivePack()
 * + writeCrashStory() + writeSceneKitDiskDraft() for local Studio. No-op when
 * not running with the cloud store live.
 *
 * Does NOT persist generated media (plates/voices/SFX) — Populate still
 * writes those to local/scratch disk only; that's separate follow-up work.
 */
export async function persistCursorPackToCloud(opts: {
  styleId: ShowStyleId;
  folderName: string;
  story: CrashStoryDoc;
  sceneKit?: unknown | null;
}): Promise<void> {
  if (!useCloudStore()) return;
  await saveCloudEpisodeMeta({
    styleId: opts.styleId,
    folderName: opts.folderName,
    label: opts.story.campaignLabel?.trim() || opts.folderName,
    story: opts.story,
    sceneKit: opts.sceneKit ?? null,
  });
  await markEpisodeOpened(opts.styleId, opts.folderName);
}
