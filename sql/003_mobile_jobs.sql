-- Skidmarks Studio — mobile Auto Studio job state.
-- The checkpointed run document for /api/crash/mobile/* — a long run spans
-- many short requests, and on Vercel each request can land on a different
-- serverless instance with its own scratch /tmp, so local-disk storage
-- (fine for local Studio) silently loses the job between calls. Safe to
-- run more than once.

CREATE TABLE IF NOT EXISTS mobile_jobs (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
