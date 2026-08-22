-- Saved cast groups ("bands") — a named list of member names on a show,
-- so a music-video cast (e.g. "THE JACK ASH BAND") can be added to a new
-- episode in one tap instead of re-picking each face. Members are matched
-- back to the show's existing 'cast' shelf rows by name at apply time —
-- this table stores the grouping only, not new face images.

CREATE TABLE IF NOT EXISTS cast_bands (
  show_id TEXT NOT NULL REFERENCES shows (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  members JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (show_id, name)
);
