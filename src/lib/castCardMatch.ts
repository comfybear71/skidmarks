/**
 * One cast card for one character — or nothing.
 *
 * The old match was `label.includes(name) || name.includes(label)` over an
 * unordered map, first hit wins. Two ways that draws a stranger:
 *
 *   1. Any label CONTAINING the name matches, so a leftover "Dazza test
 *      photoreal" or "Old Dazza v1" is a hit for "Dazza". Whichever the map
 *      yields first wins, so the same name resolves to a different person
 *      depending on shelf order — a photoreal human on one draw, someone
 *      else on the next.
 *   2. Any label CONTAINED IN the name matches, so a two-letter label
 *      swallows every character whose name contains those letters.
 *
 * Now: exact first, then singular/plural (Nuggets = Nugget), then whole-token
 * containment so "Bazza" still finds "Ranger Bazza" — and at every tier, more
 * than one candidate means we return nothing rather than guess. Failing closed
 * gives the caller's real error ("No face still for X — approve that face or
 * drop them from the shot") instead of a silent wrong character.
 */

export function castCardNameKey(raw: string): string {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Tokens with a trailing plural s dropped, so Nuggets and Nugget agree. */
export function castCardTokens(raw: string): string[] {
  return castCardNameKey(raw)
    .split(" ")
    .filter(Boolean)
    .map((t) => (t.length > 3 ? t.replace(/s$/, "") : t));
}

function onlyIndex(hits: number[]): number {
  return hits.length === 1 ? hits[0] : -1;
}

/**
 * Index of the one card that is this character, or -1 for none/ambiguous.
 * Never picks between two candidates — an ambiguous shelf is a shelf problem
 * and the caller must say so, not draw a stranger.
 */
export function pickCastCardIndexByName(labels: string[], name: string): number {
  const want = castCardNameKey(name);
  if (!want) return -1;
  const keys = labels.map(castCardNameKey);

  const exact: number[] = [];
  keys.forEach((k, i) => {
    if (k && k === want) exact.push(i);
  });
  if (exact.length) return exact[0];

  const wantTokens = castCardTokens(name);
  if (!wantTokens.length) return -1;
  const wantJoined = wantTokens.join(" ");

  const plural: number[] = [];
  keys.forEach((k, i) => {
    if (k && castCardTokens(k).join(" ") === wantJoined) plural.push(i);
  });
  if (plural.length) return onlyIndex(plural);

  // "Bazza" finds "Ranger Bazza" — whole tokens only, so "Az" cannot.
  const subset: number[] = [];
  keys.forEach((k, i) => {
    const tokens = castCardTokens(k);
    if (!tokens.length) return;
    const [shorter, longer] =
      tokens.length <= wantTokens.length ? [tokens, wantTokens] : [wantTokens, tokens];
    if (shorter.every((t) => longer.includes(t))) subset.push(i);
  });
  return onlyIndex(subset);
}
