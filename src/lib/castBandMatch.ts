/** Music video uses Artist. Skidmarks uses a tapped saved-cast chip. */
export function matchCastBand<T extends { name: string }>(
  bands: T[],
  picked: string,
): T | undefined {
  const want = picked.trim().toLowerCase();
  if (!want) return undefined;
  return bands.find((b) => b.name.trim().toLowerCase() === want);
}
