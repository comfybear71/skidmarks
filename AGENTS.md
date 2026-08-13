<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

Skidmarks Studio ("planner") is a single local-first Next.js 16 (Turbopack, React 19) app. There is one service.

- Run the dev server with `npm run dev` (see `package.json`); it binds `0.0.0.0:3737`. Lint is `npm run lint`, production build is `npm run build`. No database or external service is required to boot: app state persists to the git-ignored `data/` folder (created lazily on first write), so `/`, `/lab`, `/locations`, and the JSON APIs under `/api/*` work with no env vars.
- All external keys in `.env.example` (ElevenLabs, XAI/Grok, RunPod/Comfy, Neon `DATABASE_URL`, Vercel Blob) are optional and only needed to actually run generation jobs (voice, image, video). Leave them blank for normal UI/data development.
- `src/lib/paths.ts` resolves `MOVIES_ROOT` two levels above the repo (the real PC keeps `Skidmarks/episodes` there). That folder does not exist in the cloud VM, so the Crash Lab episode shelves on `/` list empty — this is expected, not a bug.
- Known pre-existing bug (not an environment issue): the flagship Crash Lab route `/crash` and `npm run build` both fail because `src/lib/crashDeskHydrate.ts` imports `comfyDefaultGlobal`, which is not exported by `src/lib/crashComfyStack.ts` (it exports the constant `CRASH_COMFY_DEFAULT_GLOBAL`). Any work on Crash Lab needs this import fixed first.
- Dev gotcha: once you hit the broken `/crash` route, the Turbopack dev server surfaces that compile error as a global overlay, so subsequent requests (including unrelated `/api/*` routes) return the 500 error page until the import is fixed or the dev server is restarted.
