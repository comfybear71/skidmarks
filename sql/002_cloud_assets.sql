-- Skidmarks Studio — cloud-native assets.
-- Extends `files` so WORLD images, cast faces, SFX, and placeholders live in
-- Blob + Neon (not just plates/audio/mp4). Additive + idempotent: the existing
-- deployed app (which only writes plates/audio/mp4 with an episode_id) keeps working.

-- Show-level shelf assets (world/cast/spx) have no episode.
ALTER TABLE files ALTER COLUMN episode_id DROP NOT NULL;
ALTER TABLE files ADD COLUMN IF NOT EXISTS show_id TEXT REFERENCES shows (id) ON DELETE CASCADE;

-- Human labels / metadata that used to live in on-disk manifest.json files.
ALTER TABLE files ADD COLUMN IF NOT EXISTS label_name TEXT;
ALTER TABLE files ADD COLUMN IF NOT EXISTS label_brief TEXT;
ALTER TABLE files ADD COLUMN IF NOT EXISTS place_type TEXT;
ALTER TABLE files ADD COLUMN IF NOT EXISTS slot TEXT;
ALTER TABLE files ADD COLUMN IF NOT EXISTS spx_id TEXT;
ALTER TABLE files ADD COLUMN IF NOT EXISTS spx_note TEXT;

-- Widen the kind whitelist.
ALTER TABLE files DROP CONSTRAINT IF EXISTS files_kind_check;
ALTER TABLE files ADD CONSTRAINT files_kind_check CHECK (
  kind IN (
    'plates', 'audio', 'mp4',
    'world', 'cast', 'spx_sfx', 'spx_video', 'story_sfx', 'placeholder'
  )
);

-- Backfill show_id for existing episode-scoped rows.
UPDATE files f
SET show_id = e.show_id
FROM episodes e
WHERE f.episode_id = e.id AND f.show_id IS NULL;

CREATE INDEX IF NOT EXISTS files_show_kind_idx ON files (show_id, kind);
CREATE INDEX IF NOT EXISTS files_show_kind_filename_idx ON files (show_id, kind, filename);
