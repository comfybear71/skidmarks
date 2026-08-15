import {
  blobContentType,
  putBlobFile,
  showAssetPathname,
} from "./blobStore";
import { upsertNeonShowFile } from "./neonStore";
import { cloudListShowFiles } from "./cloudShelf";
// Aliased: it is a plain env check, not a React hook, and the `use` prefix
// otherwise trips rules-of-hooks in every non-component file that calls it.
import { useCloudStore as cloudStoreEnabled } from "./cloudEnv";
import type { ShowStyleId } from "./showStylePresets";

/**
 * Character plates — the multi-view sheet (front / three-quarter / profile /
 * back plus expressions) that fixes a character's look for a whole series.
 *
 * Show-level, never episode-level: Dazza's sheet belongs to Sunny Banks, not
 * to one episode of it. Same path shape for every show, so Skidmarks behaves
 * exactly as Sunny Banks does.
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

/** Stable filename per character, so re-uploading replaces rather than stacks. */
export function characterPlateFilename(name: string, ext: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const dotted = ext.startsWith(".") ? ext : `.${ext}`;
  return `plate_${slug || "character"}${dotted}`;
}

export async function saveCharacterPlate(opts: {
  styleId: ShowStyleId;
  name: string;
  buffer: Buffer;
  ext: string;
  note?: string;
}): Promise<CharacterPlate> {
  const name = opts.name.trim();
  if (!name) throw new Error("Character plate needs a character name");
  if (!cloudStoreEnabled()) {
    throw new Error(
      "Character plates need cloud storage — set DATABASE_URL and BLOB_READ_WRITE_TOKEN",
    );
  }

  const filename = characterPlateFilename(name, opts.ext);
  const pathname = showAssetPathname(opts.styleId, PLATE_KIND, filename);
  const { url } = await putBlobFile({
    pathname,
    body: opts.buffer,
    contentType: blobContentType(PLATE_KIND, filename),
  });

  await upsertNeonShowFile({
    showId: opts.styleId,
    kind: PLATE_KIND,
    blobUrl: url,
    filename,
    blobPathname: pathname,
    labelName: name,
    labelBrief: opts.note?.trim() || null,
  });

  return { name, filename, url };
}

/** Every character plate held for a show. */
export async function listCharacterPlates(
  styleId: ShowStyleId,
): Promise<CharacterPlate[]> {
  const rows = await cloudListShowFiles(styleId, PLATE_KIND);
  return rows
    .map((row) => ({
      name: (row.label_name || "").trim(),
      filename: row.filename,
      url: row.blob_url || "",
    }))
    .filter((p) => p.name);
}

/** One character's plate, matched the way the plate compositor matches cast:
 * exact name first, then a containment match either way. */
export async function findCharacterPlate(
  styleId: ShowStyleId,
  name: string,
): Promise<CharacterPlate | null> {
  const wanted = name.trim().toLowerCase();
  if (!wanted) return null;
  const plates = await listCharacterPlates(styleId);
  return (
    plates.find((p) => p.name.trim().toLowerCase() === wanted) ||
    plates.find((p) => {
      const n = p.name.trim().toLowerCase();
      return n.includes(wanted) || wanted.includes(n);
    }) ||
    null
  );
}
