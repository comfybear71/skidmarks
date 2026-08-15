import { cloudListShowFiles } from "./cloudShelf";
import type { ShowStyleId } from "./showStylePresets";

/**
 * Cast cards already locked for a show. A series has the same faces every
 * episode — Dazza looks like Dazza in episode 40 as in episode 1 — so
 * generating four fresh candidates per speaker per episode is both slow and
 * the reason a character drifts between episodes. Approving a face already
 * writes to the show-level cast shelf; this is the read side that was missing.
 */
export type ReusableCastCard = {
  name: string;
  fileName: string;
};

/** Matched the way mobilePlates.resolveCastKeyByName matches cast: exact name
 * first, then containment either way, so "BAZZA" still finds "Ranger Bazza". */
function matches(cardName: string, speaker: string): boolean {
  const a = cardName.trim().toLowerCase();
  const b = speaker.trim().toLowerCase();
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

/**
 * One locked card per speaker, for the speakers that have one. Speakers with
 * no card are simply absent — they still get generated as normal.
 */
export async function findReusableCastCards(
  styleId: ShowStyleId,
  speakers: string[],
): Promise<Record<string, ReusableCastCard>> {
  const wanted = speakers.map((s) => s.trim()).filter(Boolean);
  if (!wanted.length) return {};

  const rows = await cloudListShowFiles(styleId, "cast").catch(() => []);
  if (!rows.length) return {};

  const cards = rows
    .map((row) => ({
      name: (row.label_name || "").trim(),
      fileName: row.filename,
    }))
    .filter((c) => c.name && c.fileName);
  if (!cards.length) return {};

  const out: Record<string, ReusableCastCard> = {};
  for (const speaker of wanted) {
    const exact = cards.find(
      (c) => c.name.trim().toLowerCase() === speaker.trim().toLowerCase(),
    );
    const hit = exact || cards.find((c) => matches(c.name, speaker));
    if (hit) out[speaker] = hit;
  }
  return out;
}
