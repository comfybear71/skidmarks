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
  /** The words saved with the face. A card reused without them is why a
   * character drifts: the next episode gets the picture and nothing else. */
  look: string;
};

function toMtime(v: number | string | null | undefined): number {
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n as number) ? (n as number) : 0;
}

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

  // listNeonShowFiles orders oldest-first; a name can carry more than one
  // row (a bad approval re-approved correctly later, a retake, etc.) and
  // the newest upload for that name is always the one that should win —
  // sort newest-first so .find() below never locks onto a stale face.
  const cards = rows
    .map((row) => {
      const name = (row.label_name || "").trim();
      const brief = (row.label_brief || "").trim();
      return {
        name,
        fileName: row.filename,
        // Older rows stored the name in label_brief; that is not a look.
        look: brief && brief.toLowerCase() !== name.toLowerCase() ? brief : "",
        mtime: toMtime(row.mtime),
      };
    })
    .filter((c) => c.name && c.fileName)
    .sort((a, b) => b.mtime - a.mtime);
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
