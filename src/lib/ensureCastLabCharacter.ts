import fs from "fs";
import path from "path";
import {
  addFaceAttempt,
  addReference,
  createCharacter,
  listCharacters,
} from "./characters";
import { matchLabCharacter } from "./matchLabCharacter";
import { resolveStyleCardThumbPath } from "./styleCardThumbs";
import type { ShowStyleId } from "./showStylePresets";

/** Silent back-end setup — Stuie never sees "create in Lab first". */
export function ensureCastLabCharacter(opts: {
  styleId: ShowStyleId;
  castKey: string;
  name: string;
}): { characterId: string; created: boolean } {
  const name = opts.name.trim();
  if (!name) throw new Error("Need cast name");

  const hit = matchLabCharacter(listCharacters(), name);
  if (hit) return { characterId: hit.id, created: false };

  const c = createCharacter({
    name,
    lookNote: `Deep fake — ${opts.styleId}`,
  });

  const thumbPath =
    opts.castKey && !opts.castKey.startsWith("name:")
      ? resolveStyleCardThumbPath(opts.styleId, opts.castKey)
      : null;
  if (thumbPath && fs.existsSync(thumbPath)) {
    const buf = fs.readFileSync(thumbPath);
    const ext = path.extname(thumbPath) || ".png";
    addReference(c.id, { buffer: buf, ext, label: "Face lock" });
    addFaceAttempt(c.id, {
      buffer: buf,
      ext,
      note: "Deep fake source",
      styleRealism: 100,
      source: "upload",
    });
  }

  return { characterId: c.id, created: true };
}
