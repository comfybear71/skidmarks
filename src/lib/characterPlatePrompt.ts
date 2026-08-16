/** Filename + sheet layout only — no cloud/image imports, so the check
 * script can load it. Live shelf: shows/{show}/character-plates/plate_baby.jpg */

/** Same slug the file is stored under — "Ranger Bazza" and "RANGER BAZZA"
 * are one character; "Jo" is not "Crazy Jo". */
export function characterPlateSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function characterPlateFilename(name: string, ext: string): string {
  const dotted = ext.startsWith(".") ? ext : `.${ext}`;
  return `plate_${characterPlateSlug(name) || "character"}${dotted}`;
}

/** Client-safe URL for the tree. Do not import characterPlates.ts from
 * a client component — that file pulls in fs / imageGen. */
export function characterPlateFileUrl(styleId: string, filename: string): string {
  return (
    `/api/crash/character-plates/file?styleId=${encodeURIComponent(styleId)}` +
    `&file=${encodeURIComponent(filename)}`
  );
}

/** Why a write must stop. Null means go ahead. Isolated so the check
 * script can cover Baby-stays-Baby without touching Blob. */
export function characterPlateOverwriteError(opts: {
  name: string;
  filename: string;
  replace?: boolean;
  existingFilename?: string | null;
  localExists?: boolean;
  cloudExists?: boolean;
}): string | null {
  if (opts.replace) return null;
  if (opts.existingFilename) {
    return `${opts.name} already has a character plate (${opts.existingFilename}) — will not overwrite`;
  }
  if (opts.localExists) {
    return `${opts.filename} is already on the local shelf — will not overwrite`;
  }
  if (opts.cloudExists) {
    return `${opts.filename} is already on the series shelf — will not overwrite`;
  }
  return null;
}

/** Skidmarks = four waist-up views. Sunny / cartoon slider = full-body plus heads. Never mix. */
export function characterPlateLayout(opts: {
  styleId: string;
  name: string;
  look?: string;
  lookLock: string;
  styleRealism: number;
}): string {
  const name = opts.name.trim() || "this character";
  const who = (opts.look || "").trim();
  const sunny = opts.styleId === "sunny_banks" || opts.styleRealism <= 35;
  const layout = sunny
    ? [
        `CHARACTER PLATE of ${name} only — the same person, never a cousin.`,
        "One wide sheet. Top row, left to right, four FULL-BODY views: front, three-quarter, profile, back. Same height, even studio light, plain background.",
        "Bottom row: two head-and-shoulders of that same person — a rest face and one other expression that still looks like them.",
        "Same clothes, hair, age and props in every full-body view.",
      ]
    : [
        `CHARACTER PLATE of ${name} only — the same person, never a cousin.`,
        "One wide sheet, left to right, four WAIST-UP views: front, three-quarter, profile, back. Same height, even studio light, plain grey background.",
        "Same face, hair, clothes, age and body in every view.",
      ];
  return [
    ...layout,
    who ? `${name} is: ${who}` : "",
    "Use the provided start image as the identity lock — this is that exact person.",
    opts.lookLock,
    "Exactly one character. No extra people. No text, labels, name tags, captions, subtitles or watermarks.",
  ]
    .filter(Boolean)
    .join("\n\n");
}
