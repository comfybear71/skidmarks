<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

Skidmarks Studio ("planner") is a single local-first Next.js 16 (Turbopack, React 19) app. There is one service.

- Run the dev server with `npm run dev` (see `package.json`); it binds `0.0.0.0:3737`. Lint is `npm run lint`, production build is `npm run build`. No database or external service is required to boot: app state persists to the git-ignored `data/` folder (created lazily on first write), so `/`, `/lab`, `/locations`, and the JSON APIs under `/api/*` work with no env vars.
- All external keys in `.env.example` (ElevenLabs, XAI/Grok, RunPod/Comfy, Neon `DATABASE_URL`, Vercel Blob) are optional and only needed to actually run generation jobs (voice, image, video). Leave them blank for normal UI/data development.
- `src/lib/paths.ts` resolves `MOVIES_ROOT` two levels above the repo (the real PC keeps `Skidmarks/episodes` there). That folder does not exist in the cloud VM, so the Crash Lab episode shelves on `/` list empty — this is expected, not a bug.
- Dev gotcha: a compile error anywhere reachable from `/crash` surfaces as a Turbopack global overlay, so unrelated `/api/*` routes also return the 500 error page until the error is fixed or the dev server is restarted.
- Storage split: locally (and in this VM) everything reads/writes disk under `DATA_DIR` (`./data`, git-ignored). The deployed Vercel app uses the cloud store only when `process.env.VERCEL` + `DATABASE_URL` + `BLOB_READ_WRITE_TOKEN` are all set (`src/lib/cloudEnv.ts` `useCloudStore()`); media then lives in Vercel Blob and metadata/JSON in Neon (see `sql/001_init.sql`, `src/lib/neonStore.ts`, `src/lib/blobStore.ts`).
- Vercel filesystem: `/var/task` is read-only, so `DATA_DIR` is redirected to `os.tmpdir()` when `process.env.VERCEL` is set (`src/lib/paths.ts`). Disk writes there are per-invocation scratch only; anything that must persist on Vercel has to go through Blob + Neon.
- Cloud pipeline gap (important for "media on Vercel" work): only `plates | audio | mp4` are wired to Blob/Neon (`BlobFileKind`, `files.kind`). WORLD/place images (`data/crash/world-cards`), cast/style-card faces (`data/crash/style-cards`), and SFX (`data/crash/spx`, `data/crash/story/*/sfx`) are served from local disk only and are NOT uploaded to the cloud, so they render locally but 404 on Vercel until that pipeline is extended.
- Uploads to cloud happen only from the local Studio via `POST /api/crash/cloud/upload` (blocked when `useCloudStore()` is true), reading pack folders from the `MY MOVIES` tree; there is no in-VM/Vercel path to ingest that source media.
