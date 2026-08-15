-- Character plates: multi-view character sheets (front / three-quarter /
-- profile / back plus expressions), stored per show rather than per episode.
--
-- Deliberately a separate kind from 'cast'. A cast card is a single figure fed
-- to the plate compositor as an identity reference; a sheet holds several
-- copies of the same character and must never be handed over as one, or the
-- compositor draws the doubles it is explicitly told to avoid. Same show-level
-- shape as the other shelves: show_id set, episode_id NULL.
--
-- Blob path: shows/{show_id}/character-plates/{filename}
-- Applied by: node scripts/apply_neon_migration.mjs (idempotent).

ALTER TABLE files DROP CONSTRAINT IF EXISTS files_kind_check;
ALTER TABLE files ADD CONSTRAINT files_kind_check CHECK (
  kind IN (
    'plates', 'audio', 'mp4',
    'world', 'cast', 'spx_sfx', 'spx_video', 'story_sfx', 'placeholder',
    'character_plate'
  )
);

-- One plate per character per show — re-uploading a character's sheet replaces
-- it rather than stacking duplicates the resolver would have to choose between.
CREATE UNIQUE INDEX IF NOT EXISTS files_character_plate_name_idx
  ON files (show_id, label_name)
  WHERE kind = 'character_plate' AND label_name IS NOT NULL;
