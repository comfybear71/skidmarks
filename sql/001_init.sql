-- Skidmarks Studio — Neon (three tables). Paste in Neon SQL Editor if needed.
-- Safe to run more than once.

CREATE TABLE IF NOT EXISTS shows (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS episodes (
  id TEXT PRIMARY KEY,
  show_id TEXT NOT NULL REFERENCES shows (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  folder_name TEXT NOT NULL,
  has_story BOOLEAN NOT NULL DEFAULT false,
  has_scene_kit BOOLEAN NOT NULL DEFAULT false,
  saved_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  story_json JSONB,
  scene_kit_json JSONB,
  comfy_draft_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  episode_id TEXT NOT NULL REFERENCES episodes (id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('plates', 'audio', 'mp4')),
  blob_url TEXT NOT NULL,
  filename TEXT NOT NULL,
  blob_pathname TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (episode_id, kind, filename)
);

CREATE INDEX IF NOT EXISTS episodes_show_id_idx ON episodes (show_id);
CREATE INDEX IF NOT EXISTS episodes_opened_at_idx ON episodes (opened_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS files_episode_id_idx ON files (episode_id);
CREATE INDEX IF NOT EXISTS files_filename_idx ON files (filename);
CREATE INDEX IF NOT EXISTS files_kind_filename_idx ON files (kind, filename);
