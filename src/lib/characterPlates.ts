import fs from "fs";
import path from "path";
import {
  blobContentType,
  putBlobFile,
  showAssetPathname,
} from "./blobStore";
import { findNeonShowFile, upsertNeonShowFile } from "./neonStore";
import { cloudListShowFiles } from "./cloudShelf";
// Aliased: it is a plain env check, not a React hook, and the `use` prefix
// otherwise trips rules-of-hooks in every non-component file that calls it.
import { useCloudStore as cloudStoreEnabled } from "./cloudEnv";
import { CRASH_DIR } from "./paths";
import { buildCrashGenLook } from "./imageGen";
import { getShowStylePreset, type ShowStyleId } from "./showStylePresets";
import {
  characterPlateFilename,
  characterPlateLayout,
  characterPlateOverwriteError,
  characterPlateSlug,
} from "./characterPlatePrompt";

export {
  characterPlateFilename,
  characterPlateLayout,
  characterPlateOverwriteError,
  characterPlateSlug,
} from "./characterPlatePrompt";

/**
 * Character plates — the multi-view sheet (front / three-quarter / profile /
 * back plus expressions) that fixes a character's look for a whole series.
 *
 * Show-level, never episode-level: Baby's sheet belongs to Skidmarks, not
 * to one episode. Blob path: shows/{show}/character-plates/plate_{slug}.ext
 *
 * Deliberately NOT the `cast` kind. A cast card is a single figure handed to
 * plateCastIntoGen as an identity reference; a sheet holds several copies of
 * the same character and would invite the duplicates the plate prompt
 * explicitly forbids. Both describe one character, only one is safe as a
 * compositor reference.
 */
const PLATE_KIND = "character_plate" as const;

export type CharacterPlate = {
  /** Character name this sheet belongs to — how it is looked up. */
  name: string;
  filename: string;
  url: string;
};

export type CharacterPlateJobRow = {
  fileName: string;
  status: "pending" | "done" | "error";
  error?: string;
};

export function characterPlateDir(styleId: ShowStyleId): string {
  return path.join(CRASH_DIR, "character-plates", styleId);
}

export function characterPlateFileUrl(styleId: ShowStyleId, filename: string): string {
  return (
    `/api/crash/character-plates/file?styleId=${encodeURIComponent(styleId)}` +
    `&file=${encodeURIComponent(filename)}`
  );
}

export function resolveCharacterPlatePath(
  styleId: ShowStyleId,
  filename: string,
): string | null {
  const f = filename.trim();
  if (!f || f.includes("..") || f.includes("/") || f.includes("\\")) return null;
  const p = path.join(characterPlateDir(styleId), f);
  return fs.existsSync(p) ? p : null;
}

function localManifestPath(styleId: ShowStyleId): string {
  return path.join(characterPlateDir(styleId), "manifest.json");
}

function readLocalManifest(styleId: ShowStyleId): Record<string, { name: string }> {
  const p = localManifestPath(styleId);
  if (!fs.existsSync(p)) return {};
  try {
    const raw = JSON.parse(fs.readFileSync(p, "utf8")) as Record<string, { name: string }>;
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

function writeLocalManifest(
  styleId: ShowStyleId,
  filename: string,
  name: string,
): void {
  const dir = characterPlateDir(styleId);
  fs.mkdirSync(dir, { recursive: true });
  const manifest = readLocalManifest(styleId);
  manifest[filename] = { name };
  fs.writeFileSync(localManifestPath(styleId), JSON.stringify(manifest, null, 2));
}

export function buildCharacterPlatePrompt(opts: {
  styleId: ShowStyleId;
  name: string;
  look?: string;
  styleRealism?: number;
}): string {
  const realism =
    Number.isFinite(opts.styleRealism)
      ? Math.max(0, Math.min(100, Math.round(opts.styleRealism as number)))
      : getShowStylePreset(opts.styleId).defaultRealism;
  return characterPlateLayout({
    styleId: opts.styleId,
    name: opts.name,
    look: opts.look,
    lookLock: buildCrashGenLook(opts.styleId, realism),
    styleRealism: realism,
  });
}

export async function saveCharacterPlate(opts: {
  styleId: ShowStyleId;
  name: string;
  buffer: Buffer;
  ext: string;
  note?: string;
  /** Default false — a series sheet is not replaced by a later pick or a test. */
  replace?: boolean;
}): Promise<CharacterPlate> {
  const name = opts.name.trim();
  if (!name) throw new Error("Character plate needs a character name");

  const filename = characterPlateFilename(name, opts.ext);
  const dir = characterPlateDir(opts.styleId);
  const localPath = path.join(dir, filename);
  const existing = opts.replace ? null : await findCharacterPlate(opts.styleId, name);
  const cloudRow =
    !opts.replace && cloudStoreEnabled()
      ? await findNeonShowFile({
          showId: opts.styleId,
          kind: PLATE_KIND,
          filename,
        })
      : null;
  const blocked = characterPlateOverwriteError({
    name,
    filename,
    replace: opts.replace,
    existingFilename: existing?.filename || null,
    localExists: fs.existsSync(localPath),
    cloudExists: Boolean(cloudRow),
  });
  if (blocked) throw new Error(blocked);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(localPath, opts.buffer);
  writeLocalManifest(opts.styleId, filename, name);

  let url = characterPlateFileUrl(opts.styleId, filename);
  if (cloudStoreEnabled()) {
    const pathname = showAssetPathname(opts.styleId, PLATE_KIND, filename);
    const put = await putBlobFile({
      pathname,
      body: opts.buffer,
      contentType: blobContentType(PLATE_KIND, filename),
      allowOverwrite: !!opts.replace,
    });
    await upsertNeonShowFile({
      showId: opts.styleId,
      kind: PLATE_KIND,
      blobUrl: put.url,
      filename,
      blobPathname: put.pathname,
      labelName: name,
      labelBrief: opts.note?.trim() || null,
    });
    url = put.url;
  }

  return { name, filename, url };
}

function localPlates(styleId: ShowStyleId): CharacterPlate[] {
  const manifest = readLocalManifest(styleId);
  return Object.entries(manifest)
    .map(([filename, meta]) => ({
      name: (meta.name || "").trim(),
      filename,
      url: characterPlateFileUrl(styleId, filename),
    }))
    .filter((p) => p.name && resolveCharacterPlatePath(styleId, p.filename));
}

/** Every character plate held for a show. */
export async function listCharacterPlates(
  styleId: ShowStyleId,
): Promise<CharacterPlate[]> {
  const cloud = cloudStoreEnabled()
    ? (await cloudListShowFiles(styleId, PLATE_KIND).catch(() => [])).map((row) => ({
        name: (row.label_name || "").trim(),
        filename: row.filename,
        url: row.blob_url || characterPlateFileUrl(styleId, row.filename),
      }))
    : [];
  const byName = new Map<string, CharacterPlate>();
  for (const p of [...localPlates(styleId), ...cloud]) {
    if (p.name) byName.set(p.name.trim().toLowerCase(), p);
  }
  return [...byName.values()];
}

/** One character's plate. Match the file slug, not a loose contains —
 * "Jo" must not pick up Crazy Jo, and "Ranger Bazza" must still find
 * a shelf row labelled RANGER BAZZA. */
export async function findCharacterPlate(
  styleId: ShowStyleId,
  name: string,
): Promise<CharacterPlate | null> {
  const wanted = characterPlateSlug(name);
  if (!wanted) return null;
  const plates = await listCharacterPlates(styleId);
  return (
    plates.find((p) => characterPlateSlug(p.name) === wanted) ||
    plates.find((p) => characterPlateSlug(p.filename.replace(/^plate_|\.[^.]+$/g, "")) === wanted) ||
    null
  );
}
