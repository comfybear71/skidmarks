/**
 * One look for a free music-video film. Theme is any topic — nature, space,
 * first world war, polar bears, timber night. Colour and type ride with it
 * so every Support search stays on that film, not a random b-roll lottery.
 *
 * Does not cook. Does not change Hero / LTX. Search sites stay free-license.
 */

export type StockLook = {
  /** Any topic — "nature", "space", "first world war", "polar bears". */
  theme: string;
  /** Grade words — "mud brown grain", "cold blue ice", "deep black sky". */
  colour: string;
  /** Shot kinds — "forest river aerial", "stars nebula", "trenches archival". */
  types: string;
};

export const EMPTY_STOCK_LOOK: StockLook = {
  theme: "",
  colour: "",
  types: "",
};

function clipWords(raw: unknown, max = 80): string {
  return String(raw || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export function parseStockLook(raw: unknown): StockLook {
  const rec = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    theme: clipWords(rec.theme),
    colour: clipWords(rec.colour ?? rec.color),
    types: clipWords(rec.types ?? rec.type, 120),
  };
}

export function stockLookIsOn(look: StockLook | null | undefined): boolean {
  if (!look) return false;
  return Boolean(look.theme || look.colour || look.types);
}

/** Fold label — the theme, or a dash when the lock is off. */
export function stockLookFoldLabel(look: StockLook | null | undefined): string {
  const theme = (look?.theme || "").trim();
  return theme || "off";
}

/**
 * Theme + colour + type first, then this shot's extra words.
 * Empty look = the shot query only (same as before).
 */
export function composeStockSearchQuery(
  look: StockLook | null | undefined,
  shotQuery: string,
): string {
  const bits = [look?.theme, look?.colour, look?.types, shotQuery]
    .map((s) => (s || "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const bit of bits) {
    const key = bit.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(bit);
  }
  return out.join(" ").trim();
}
