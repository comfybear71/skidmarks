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
  episode_id: string | null;
  show_id?: string | null;
  kind: BlobFileKind;
  blob_url: string;
  filename: string;
  blob_pathname: string;
  label_name?: string | null;
  label_brief?: string | null;
  place_type?: string | null;
  slot?: string | null;
  spx_id?: string | null;
  spx_note?: string | null;
  mtime?: number | string | null;
};

/** Show-level (shelf) file id — no episode. */
export function showFileRowId(
  showId: string,
  kind: BlobFileKind,
  filename: string,
): string {
  return `${showId}/${kind}/${filename}`;
}

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

/**
 * Delete an episode and everything scoped to it. files.episode_id has
 * ON DELETE CASCADE (sql/001_init.sql), so removing the episode row also
 * removes its plates/audio/mp4 rows — this only has to fetch their blob
 * pathnames first, since cascade doesn't touch Blob storage.
 */
export async function deleteNeonEpisode(
  showId: ShowStyleId,
  folderName: string,
): Promise<{ blobPathnames: string[] }> {
  const sql = getSql();
  if (!sql) return { blobPathnames: [] };
  const id = episodeRowId(showId, folderName);
  const fileRows = (await sql`
    SELECT blob_pathname FROM files WHERE episode_id = ${id}
  `) as { blob_pathname: string | null }[];
  await sql`DELETE FROM episodes WHERE id = ${id}`;
  return {
    blobPathnames: fileRows.map((r) => r.blob_pathname).filter((p): p is string => Boolean(p)),
  };
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
  try {
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
  } catch (e) {
    // files.episode_id FK rejects an id with no matching episodes row —
    // mobileMediaFolder(job) hands cast_build/location_build candidate
    // uploads the job id as a stand-in folder before any real pack exists,
    // so this is the normal case there, not an edge case. The row still
    // matters (cloudBlobRedirect's by-filename lookup is the only
    // cross-instance fallback for location candidate images on Vercel) —
    // retry unscoped rather than losing it to a swallowed error.
    const msg = e instanceof Error ? e.message : String(e);
    if (!/foreign key|violates/i.test(msg)) throw e;
    const fallbackId = `_prebuild/${row.kind}/${row.filename}`;
    await sql`
      INSERT INTO files (id, episode_id, kind, blob_url, filename, blob_pathname)
      VALUES (
        ${fallbackId}, NULL, ${row.kind}, ${row.blobUrl},
        ${row.filename}, ${row.blobPathname}
      )
      ON CONFLICT (id) DO UPDATE SET
        blob_url = EXCLUDED.blob_url,
        blob_pathname = EXCLUDED.blob_pathname
    `;
  }
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

export async function deleteNeonFiles(ids: string[]): Promise<void> {
  const sql = getSql();
  if (!sql) return;
  for (const id of ids) {
    const key = String(id || "").trim();
    if (!key) continue;
    await sql`DELETE FROM files WHERE id = ${key}`;
  }
}

export async function upsertNeonShowFile(row: {
  showId: ShowStyleId;
  kind: BlobFileKind;
  blobUrl: string;
  filename: string;
  blobPathname: string;
  labelName?: string | null;
  labelBrief?: string | null;
  placeType?: string | null;
  slot?: string | null;
  spxId?: string | null;
  spxNote?: string | null;
}): Promise<void> {
  const sql = getSql();
  if (!sql) return;
  const id = showFileRowId(row.showId, row.kind, row.filename);
  await sql`
    INSERT INTO files (
      id, episode_id, show_id, kind, blob_url, filename, blob_pathname,
      label_name, label_brief, place_type, slot, spx_id, spx_note
    )
    VALUES (
      ${id}, NULL, ${row.showId}, ${row.kind}, ${row.blobUrl},
      ${row.filename}, ${row.blobPathname},
      ${row.labelName ?? null}, ${row.labelBrief ?? null}, ${row.placeType ?? null},
      ${row.slot ?? null}, ${row.spxId ?? null}, ${row.spxNote ?? null}
    )
    ON CONFLICT (id) DO UPDATE SET
      blob_url = EXCLUDED.blob_url,
      blob_pathname = EXCLUDED.blob_pathname,
      label_name = COALESCE(EXCLUDED.label_name, files.label_name),
      label_brief = COALESCE(EXCLUDED.label_brief, files.label_brief),
      place_type = COALESCE(EXCLUDED.place_type, files.place_type),
      slot = COALESCE(EXCLUDED.slot, files.slot),
      spx_id = COALESCE(EXCLUDED.spx_id, files.spx_id),
      spx_note = COALESCE(EXCLUDED.spx_note, files.spx_note)
  `;
}

export async function listNeonShowFiles(opts: {
  showId: ShowStyleId;
  kind: BlobFileKind;
}): Promise<NeonFileRow[]> {
  return safeQuery(async (sql) => {
    const rows = await sql`
      SELECT id, episode_id, show_id, kind, blob_url, filename, blob_pathname,
        label_name, label_brief, place_type, slot, spx_id, spx_note,
        (EXTRACT(EPOCH FROM created_at) * 1000)::bigint AS mtime
      FROM files
      WHERE show_id = ${opts.showId} AND kind = ${opts.kind} AND episode_id IS NULL
      ORDER BY created_at ASC, filename ASC
    `;
    return rows as NeonFileRow[];
  }, []);
}

export async function findNeonShowFile(opts: {
  showId: ShowStyleId;
  kind: BlobFileKind;
  filename: string;
}): Promise<NeonFileRow | null> {
  return safeQuery(async (sql) => {
    const rows = await sql`
      SELECT id, episode_id, show_id, kind, blob_url, filename, blob_pathname,
        label_name, label_brief, place_type, slot, spx_id, spx_note
      FROM files
      WHERE show_id = ${opts.showId} AND kind = ${opts.kind}
        AND filename = ${opts.filename} AND episode_id IS NULL
      LIMIT 1
    `;
    return (rows[0] as NeonFileRow) || null;
  }, null);
}

/** Cast thumbs are unique timestamps; a desk may ask the wrong show. */
export async function findNeonShowFileAnyShow(opts: {
  kind: BlobFileKind;
  filename: string;
}): Promise<NeonFileRow | null> {
  return safeQuery(async (sql) => {
    const rows = await sql`
      SELECT id, episode_id, show_id, kind, blob_url, filename, blob_pathname,
        label_name, label_brief, place_type, slot, spx_id, spx_note
      FROM files
      WHERE kind = ${opts.kind} AND filename = ${opts.filename}
        AND episode_id IS NULL
      ORDER BY created_at DESC
      LIMIT 1
    `;
    return (rows[0] as NeonFileRow) || null;
  }, null);
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

export async function saveMobileJobRow(id: string, data: unknown): Promise<void> {
  await safeQuery(async (sql) => {
    await sql`
      INSERT INTO mobile_jobs (id, data, updated_at)
      VALUES (${id}, ${JSON.stringify(data)}, now())
      ON CONFLICT (id) DO UPDATE SET data = ${JSON.stringify(data)}, updated_at = now()
    `;
    return null;
  }, null);
}

export async function readMobileJobRow<T>(id: string): Promise<T | null> {
  return safeQuery(async (sql) => {
    const rows = await sql`SELECT data FROM mobile_jobs WHERE id = ${id} LIMIT 1`;
    return (rows[0]?.data as T) ?? null;
  }, null);
}
