# Cloud asset map — everything to Blob + Neon (no PC)

Goal: the deployed Vercel app reads/writes **all** media from Vercel Blob and **all**
metadata/prompts/JSON from Neon. No dependency on the local `MY MOVIES` tree at runtime.

This document is the naming/filepath contract:
1. what asset types exist,
2. where each currently lives on disk (the source of truth today),
3. where each must live in Blob,
4. the Neon rows that must back it,
5. what is already wired vs still missing.

Legend: `{showId}` = `skidmarks | sunny_banks | deepfake | doc | music_video | photoreal`.
`{folder}` = episode/pack folder name (e.g. `CURSOR_SUNNY_BANKS_2`). `{ts}` = 17‑digit timestamp.

---

## 1. Already wired to Blob + Neon (keep as‑is)

Blob pathname (`src/lib/blobStore.ts` `blobPathname`):
`shows/{showId}/episodes/{folder}/{kind}/{filename}` with `kind ∈ {plates, audio, mp4}`.

Neon (`sql/001_init.sql`, `src/lib/neonStore.ts`):
- `shows(id, name)` — `id = {showId}`.
- `episodes(id, show_id, name, folder_name, has_story, has_scene_kit, saved_at, opened_at, story_json, scene_kit_json, comfy_draft_json)` — `id = {showId}/{folder}`.
- `files(id, episode_id, kind, blob_url, filename, blob_pathname)` — `id = {episodeId}/{kind}/{filename}`, `kind ∈ {plates, audio, mp4}`.

| Asset | Disk source (pack) | Blob path | Filename convention | Neon |
|-------|--------------------|-----------|---------------------|------|
| Shot plates / cast plates / logos | `{folder}/plates/*` | `shows/{showId}/episodes/{folder}/plates/{file}` | `cplate_{ts}_{tag}.png` (also `cgen_*`, `ctweak_*`, `cup_*`, `bg_*`) | `files` kind `plates` |
| Dialogue audio | `{folder}/audio/*` | `shows/{showId}/episodes/{folder}/audio/{file}` | `{NN}_{BB}_{Speaker}_{line-slug}.mp3` (`dialogueFileName`) | `files` kind `audio` |
| LTX / lipsync video | `{folder}/mp4/`, `/ltx/`, `/lipsync/` | `shows/{showId}/episodes/{folder}/mp4/{file}` | `*.mp4` | `files` kind `mp4` |
| Story / scene kit / comfy draft / episode meta | `{folder}/_RECIPE/{story,scene-kit,comfy-draft,episode}.json` | — (JSON, not Blob) | — | `episodes.story_json / scene_kit_json / comfy_draft_json / name` |

Prompts + segment prompts are **already** persisted to Neon: they live inside `story_json`
(beat `platePrompt`, `imageMotion`, `textSegment`, `global`, etc.) and `comfy_draft_json`
(per‑beat `imageMotion` / `segmentText`, `global`). No separate table needed for prompts.

---

## 2. NOT wired to cloud yet (the gap — disk‑only today, 404 on Vercel)

These render locally but are never uploaded and have no Neon rows. They must be added.

### 2a. WORLD / place images
- Disk: `data/crash/world-cards/{showId}/{file}` + `data/crash/world-cards/{showId}/manifest.json`
- Manifest shape: `{ "g:{file}": { name, brief, placeType } }`
- Story reference: `scene.worldThumbKey = "g:{file}"` (`src/lib/crashStoryTypes.ts`)
- Served by `GET /api/crash/world-cards/file?styleId=&thumb=g:{file}` (disk read only)
- Filename: freeform basename — generated `place_{ts}.png` or keeper names like `dirty_dog_pub.png`

### 2b. Cast / style‑card faces
- Disk: `data/crash/style-cards/{showId}/{file}` + `manifest.json`
- Manifest shape: `{ "g:{file}": { name, brief } }`
- Reference: `g:{file}` keys; pack copy under `{folder}/images/characters/`
- Served by `GET /api/crash/style-cards/file` (disk only)
- Filename: `thumb_{ts}.png` (generated) / `upload_{ts}.png` (uploaded)

### 2c. SFX — shelf (per show)
- Disk: `data/crash/spx/{showId}/sfx/{file}`, `data/crash/spx/{showId}/video/{file}` + `manifest.json`
- Manifest shape: array of `{ id, kind, fileName, label, note?, mtime }` (id like `spx_…`)
- Story reference: `sfx.spxId` (`src/lib/crashStoryTypes.ts` `CrashStorySfx`)
- Served by `GET /api/crash/spx/file?styleId=&kind=sfx|video&file=` (disk only)
- Filename: `sfx_{ts}.mp3`, `video_{ts}.{mp4|webm|mov}`

### 2d. SFX — story‑attached (per episode)
- Disk: `data/crash/story/{showId}/sfx/{sfxId}.{mp3|wav|m4a|ogg}`
- Story reference: `sfx.audioFile` + `sfx.id` (id like `sfx_1_1`, `sfx_intro_theme`)
- Served by `GET /api/crash/story/sfx?styleId=&sfxId=` (disk only)

### 2e. Placeholders (preset slots)
- Disk: `data/crash/placeholders/{showId}/{cast|places}/{id}.png`
- Served by `GET /api/crash/placeholders/file` (disk only)

### 2f. Character Lab / Location Lab (legacy surfaces, if kept online)
- Characters: `data/characters/*` (faces/voices) — `src/lib/characters.ts`
- Locations: `data/locations/{id}/rooms/{roomId}/plates/*`, `refs/*` — `src/lib/locations.ts`

---

## 3. Target Blob layout for the gap assets

Show‑level shelves are shared across episodes, so they sit under the show, not an episode:

| Asset | Blob path | Filename |
|-------|-----------|----------|
| WORLD image | `shows/{showId}/world-cards/{file}` | keep basename; story key stays `g:{file}` |
| Cast face | `shows/{showId}/style-cards/{file}` | `thumb_{ts}.png` / `upload_{ts}.png` |
| SFX shelf sound | `shows/{showId}/spx/sfx/{file}` | `sfx_{ts}.mp3` |
| SFX shelf video | `shows/{showId}/spx/video/{file}` | `video_{ts}.{ext}` |
| Placeholder | `shows/{showId}/placeholders/{cast\|places}/{file}` | `{id}.png` |
| Story SFX (per episode) | `shows/{showId}/episodes/{folder}/sfx/{file}` | `{sfxId}.{ext}` |

Keeping the story references unchanged (`g:{file}` for world/cast, `spxId`/`audioFile` for SFX)
means only the **resolver** changes (disk → Blob), not the stored JSON.

---

## 4. Target Neon schema additions

Show‑level assets have no episode, and the label/name/prompt metadata (today in on‑disk
`manifest.json`) must move into Neon so nothing depends on the PC.

Proposed (extends `files`, backward compatible):
- Add `show_id TEXT NOT NULL REFERENCES shows(id)`.
- Make `episode_id` **nullable** (show‑level rows have no episode).
- Broaden the kind check: `kind IN ('plates','audio','mp4','world','cast','spx_sfx','spx_video','placeholder','story_sfx')`.
- Add label/meta columns (or one `meta JSONB`): `label_name`, `label_brief`, `place_type`,
  `spx_id`, `spx_label`, `spx_note`, `slot` (cast/places for placeholders).
- Row id conventions:
  - show‑level: `{showId}/{kind}/{filename}`
  - episode‑level: `{showId}/{folder}/{kind}/{filename}` (unchanged for plates/audio/mp4)

This replaces `world-cards/manifest.json`, `style-cards/manifest.json`, and `spx/manifest.json`
with Neon rows, so names/labels are served online.

---

## 5. Implementation checklist (pipeline extension)

Small, contained changes — no rewrite of the UI:
1. `src/lib/blobStore.ts` — extend `BlobFileKind` + add show‑level `blobPathname` variant.
2. `sql/001_init.sql` + `scripts/apply_neon_migration.mjs` — apply the schema in §4.
3. `src/lib/neonStore.ts` — `upsert/list` for show‑level files + label columns.
4. `src/lib/uploadPackToCloud.ts` — also upload `images/places`, `images/characters`,
   shelf `spx/*`, story `sfx/*`, placeholders; write their Neon rows + labels.
5. Resolvers (add a Blob branch when `useCloudStore()`), each currently disk‑only:
   - `world-cards/file`, `style-cards/file`, `spx/file`, `story/sfx`, `placeholders/file`.
6. Write paths (already routed to `/tmp` on Vercel by `src/lib/paths.ts`) should, when
   `useCloudStore()`, also push new gens to Blob + Neon so they persist (gen stills, new SFX,
   new world/cast cards, new mp4s) — this is what makes "next episodes / generated images"
   independent of the PC.

---

## 6. How to produce the exact "missing files" list

The list of **required** paths/names is above. To diff **what already exists in Blob/Neon vs
what is missing**, this agent needs read access from the VM:
- Add `DATABASE_URL` and `BLOB_READ_WRITE_TOKEN` as **Cursor secrets** for this agent
  (they are currently only set in Vercel's env, which the VM cannot see).

With those, the diff is:
- Blob inventory: `list({ prefix: "shows/{showId}/" })` per show (`listBlobPrefix`).
- Neon inventory: `SELECT ... FROM files` / `episodes`.
- Missing = every path in §1–§3 that the app references (story `worldThumbKey`, `plateFile`,
  `voiceFile`, `spxId`, `sfx.audioFile`, cast keys) but that has no Blob object / Neon row.
