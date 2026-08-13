import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type { ShowStyleId } from "./showStylePresets";
import type { CrashStoryDoc } from "./crashStoryTypes";
import type { BlobFileKind } from "./blobStore";

type Sql = NeonQueryFunction<false, false>;

let cached: Sql | null | undefined;

function getSql(): Sql | null {
  if (cached !== undefined) return cached;
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    cached = null;
    return null;
  }
  cached = neon(url);
  return cached;
}

export type NeonShowRow = {
  id: string;
  name: string;
};

export type NeonEpisodeRow = {
  id: string;
  show_id: string;
  name: string;
  folder_name: string;
  has_story: boolean;
  has_scene_kit: boolean;
  saved_at: string | null;
  opened_at: string | null;
  story_json: CrashStoryDoc | null;
  scene_kit_json: unknown | null;
  comfy_draft_json: unknown | null;
};

export type NeonFileRow = {
  id: string;
  episode_id: string;
  kind: BlobFileKind;
  blob_url: string;
  filename: string;
  blob_pathname: string;
};

export function episodeRowId(showId: string, folderName: string): string {
  return `${showId}/${folderName}`;
}

export function fileRowId(
  episodeId: string,
  kind: BlobFileKind,
  filename: string,
): string {
  return `${episodeId}/${kind}/${filename}`;
}

async function safeQuery<T>(fn: (sql: Sql) => Promise<T>, fallback: T): Promise<T> {
  const sql = getSql();
  if (!sql) return fallback;
  try {
    return await fn(sql);
  } catch {
    return fallback;
  }
}

export async function listNeonShows(): Promise<NeonShowRow[]> {
  return safeQuery(async (sql) => {
    const rows = await sql`SELECT id, name FROM shows ORDER BY name`;
    return rows as NeonShowRow[];
  }, []);
}

export async function upsertNeonShow(id: ShowStyleId, name: string): Promise<void> {
  const sql = getSql();
  if (!sql) return;
  await sql`
    INSERT INTO shows (id, name)
    VALUES (${id}, ${name})
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
  `;
}

export async function listNeonEpisodes(
  showId: ShowStyleId,
): Promise<NeonEpisodeRow[]> {
  return safeQuery(async (sql) => {
    const rows = await sql`
      SELECT
        id, show_id, name, folder_name, has_story, has_scene_kit,
        saved_at, opened_at, story_json, scene_kit_json, comfy_draft_json
      FROM episodes
      WHERE show_id = ${showId}
      ORDER BY saved_at DESC NULLS LAST, name ASC
    `;
    return rows as NeonEpisodeRow[];
  }, []);
}

export async function getNeonEpisode(
  showId: ShowStyleId,
  folderName: string,
): Promise<NeonEpisodeRow | null> {
  const id = episodeRowId(showId, folderName);
  return safeQuery(async (sql) => {
    const rows = await sql`
      SELECT
        id, show_id, name, folder_name, has_story, has_scene_kit,
        saved_at, opened_at, story_json, scene_kit_json, comfy_draft_json
      FROM episodes
      WHERE id = ${id}
      LIMIT 1
    `;
    return (rows[0] as NeonEpisodeRow) || null;
  }, null);
}

export async function getLatestOpenedEpisode(
  showId?: ShowStyleId,
): Promise<NeonEpisodeRow | null> {
  return safeQuery(async (sql) => {
    const rows = showId
      ? await sql`
          SELECT
            id, show_id, name, folder_name, has_story, has_scene_kit,
            saved_at, opened_at, story_json, scene_kit_json, comfy_draft_json
          FROM episodes
          WHERE show_id = ${showId} AND opened_at IS NOT NULL
          ORDER BY opened_at DESC
          LIMIT 1
        `
      : await sql`
          SELECT
            id, show_id, name, folder_name, has_story, has_scene_kit,
            saved_at, opened_at, story_json, scene_kit_json, comfy_draft_json
          FROM episodes
          WHERE opened_at IS NOT NULL
          ORDER BY opened_at DESC
          LIMIT 1
        `;
    return (rows[0] as NeonEpisodeRow) || null;
  }, null);
}

export async function upsertNeonEpisode(row: {
  showId: ShowStyleId;
  folderName: string;
  name: string;
  hasStory?: boolean;
  hasSceneKit?: boolean;
  storyJson?: unknown | null;
  sceneKitJson?: unknown | null;
  comfyDraftJson?: unknown | null;
  markOpened?: boolean;
}): Promise<void> {
  const sql = getSql();
  if (!sql) return;
  const id = episodeRowId(row.showId, row.folderName);
  const now = new Date().toISOString();
  const story = row.storyJson != null ? JSON.stringify(row.storyJson) : null;
  const kit = row.sceneKitJson != null ? JSON.stringify(row.sceneKitJson) : null;
  const draft =
    row.comfyDraftJson != null ? JSON.stringify(row.comfyDraftJson) : null;
  const opened = row.markOpened ? now : null;
  await sql`
    INSERT INTO episodes (
      id, show_id, name, folder_name, has_story, has_scene_kit,
      saved_at, opened_at, story_json, scene_kit_json, comfy_draft_json
    )
    VALUES (
      ${id}, ${row.showId}, ${row.name}, ${row.folderName},
      ${row.hasStory ?? false}, ${row.hasSceneKit ?? false},
      ${now}, ${opened},
      ${story}::jsonb, ${kit}::jsonb, ${draft}::jsonb
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      has_story = EXCLUDED.has_story,
      has_scene_kit = EXCLUDED.has_scene_kit,
      saved_at = EXCLUDED.saved_at,
      opened_at = COALESCE(EXCLUDED.opened_at, episodes.opened_at),
      story_json = COALESCE(EXCLUDED.story_json, episodes.story_json),
      scene_kit_json = COALESCE(EXCLUDED.scene_kit_json, episodes.scene_kit_json),
      comfy_draft_json = COALESCE(EXCLUDED.comfy_draft_json, episodes.comfy_draft_json)
  `;
}

export async function markEpisodeOpened(
  showId: ShowStyleId,
  folderName: string,
): Promise<void> {
  const sql = getSql();
  if (!sql) return;
  const id = episodeRowId(showId, folderName);
  const now = new Date().toISOString();
  await sql`UPDATE episodes SET opened_at = ${now} WHERE id = ${id}`;
}

export async function upsertNeonFile(row: {
  episodeId: string;
  kind: BlobFileKind;
  blobUrl: string;
  filename: string;
  blobPathname: string;
}): Promise<void> {
  const sql = getSql();
  if (!sql) return;
  const id = fileRowId(row.episodeId, row.kind, row.filename);
  await sql`
    INSERT INTO files (id, episode_id, kind, blob_url, filename, blob_pathname)
    VALUES (
      ${id}, ${row.episodeId}, ${row.kind}, ${row.blobUrl},
      ${row.filename}, ${row.blobPathname}
    )
    ON CONFLICT (id) DO UPDATE SET
      blob_url = EXCLUDED.blob_url,
      blob_pathname = EXCLUDED.blob_pathname
  `;
}

export async function listNeonFiles(opts: {
  episodeId?: string;
  kind?: BlobFileKind;
}): Promise<NeonFileRow[]> {
  return safeQuery(async (sql) => {
    if (opts.episodeId && opts.kind) {
      const rows = await sql`
        SELECT id, episode_id, kind, blob_url, filename, blob_pathname
        FROM files
        WHERE episode_id = ${opts.episodeId} AND kind = ${opts.kind}
        ORDER BY filename
      `;
      return rows as NeonFileRow[];
    }
    if (opts.episodeId) {
      const rows = await sql`
        SELECT id, episode_id, kind, blob_url, filename, blob_pathname
        FROM files
        WHERE episode_id = ${opts.episodeId}
        ORDER BY kind, filename
      `;
      return rows as NeonFileRow[];
    }
    if (opts.kind) {
      const rows = await sql`
        SELECT id, episode_id, kind, blob_url, filename, blob_pathname
        FROM files
        WHERE kind = ${opts.kind}
        ORDER BY created_at DESC
      `;
      return rows as NeonFileRow[];
    }
    const rows = await sql`
      SELECT id, episode_id, kind, blob_url, filename, blob_pathname
      FROM files
      ORDER BY created_at DESC
    `;
    return rows as NeonFileRow[];
  }, []);
}

export async function findNeonFile(opts: {
  kind: BlobFileKind;
  filename: string;
  episodeId?: string;
}): Promise<NeonFileRow | null> {
  return safeQuery(async (sql) => {
    if (opts.episodeId) {
      const rows = await sql`
        SELECT id, episode_id, kind, blob_url, filename, blob_pathname
        FROM files
        WHERE episode_id = ${opts.episodeId}
          AND kind = ${opts.kind}
          AND filename = ${opts.filename}
        LIMIT 1
      `;
      return (rows[0] as NeonFileRow) || null;
    }
    const rows = await sql`
      SELECT id, episode_id, kind, blob_url, filename, blob_pathname
      FROM files
      WHERE kind = ${opts.kind} AND filename = ${opts.filename}
      ORDER BY created_at DESC
      LIMIT 1
    `;
    return (rows[0] as NeonFileRow) || null;
  }, null);
}
