/** How /m finds the episode after a refresh. Query string wins so a
 * bookmark still opens the same tree on a new phone. */
export const MOBILE_LAST_JOB_KEY = "skidmarks.mobile.lastJobId";

export function readResumedJobId(
  search: string,
  storage?: { getItem(key: string): string | null },
): string {
  const q = search.startsWith("?") ? search.slice(1) : search;
  const fromUrl = new URLSearchParams(q).get("job")?.trim() || "";
  if (fromUrl) return fromUrl;
  return (storage?.getItem(MOBILE_LAST_JOB_KEY) || "").trim();
}
