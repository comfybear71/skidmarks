-- Per-person isolation. Existing rows stay Stuie's (NULL owner_id).
-- Guests get owner_id set on insert. Safe to run more than once.

ALTER TABLE episodes ADD COLUMN IF NOT EXISTS owner_id TEXT;
ALTER TABLE files ADD COLUMN IF NOT EXISTS owner_id TEXT;

CREATE INDEX IF NOT EXISTS episodes_owner_id_idx ON episodes (owner_id);
CREATE INDEX IF NOT EXISTS files_owner_id_idx ON files (owner_id);
