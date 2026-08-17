import { DEFAULT_DESK_ID, lastJobKeyForDesk, normalizeDeskId } from "./mobileDesk";

/** How /m finds the episode after a refresh. Query string wins so a
 * bookmark still opens the same tree on a new phone. */
export const MOBILE_LAST_JOB_KEY = "skidmarks.mobile.lastJobId";

export function readResumedJobId(
  search: string,
  storage?: { getItem(key: string): string | null },
  deskId?: string,
): string {
  const q = search.startsWith("?") ? search.slice(1) : search;
  const fromUrl = new URLSearchParams(q).get("job")?.trim() || "";
  if (fromUrl) return fromUrl;
  const desk = normalizeDeskId(deskId || "");
  if (deskId) {
    const keyed = (storage?.getItem(lastJobKeyForDesk(desk)) || "").trim();
    if (keyed) return keyed;
    // Untagged cookie is Stuie's leftover — Mum must not inherit it.
    if (desk === DEFAULT_DESK_ID) {
      return (storage?.getItem(MOBILE_LAST_JOB_KEY) || "").trim();
    }
    return "";
  }
  return (storage?.getItem(MOBILE_LAST_JOB_KEY) || "").trim();
}

export function writeResumedJobId(
  storage: { setItem(key: string, value: string): void },
  jobId: string,
  deskId: string,
): void {
  const id = jobId.trim();
  if (!id) return;
  const desk = normalizeDeskId(deskId);
  storage.setItem(lastJobKeyForDesk(desk), id);
  // Keep the old unscoped key for Stuie bookmarks only.
  if (desk === DEFAULT_DESK_ID) storage.setItem(MOBILE_LAST_JOB_KEY, id);
}
