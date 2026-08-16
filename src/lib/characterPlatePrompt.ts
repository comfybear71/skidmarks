/** Filename + sheet layout only — no cloud/image imports, so the check
 * script can load it. Live shelf: shows/{show}/character-plates/plate_baby.jpg */

export function characterPlateFilename(name: string, ext: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const dotted = ext.startsWith(".") ? ext : `.${ext}`;
  return `plate_${slug || "character"}${dotted}`;
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
