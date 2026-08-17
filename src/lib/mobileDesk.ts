/** Whose phone this is. Mum and Stuie were sharing one last-job cookie,
 * so opening /m on her iPad pulled his episode (and the other way around). */

export const DEFAULT_DESK_ID = "stuie";

export const MOBILE_DESK_KEY = "skidmarks.mobile.desk";
export const MOBILE_DESKS_KEY = "skidmarks.mobile.desks";
export const MOBILE_DESK_EVENT = "skidmarks-mobile-desk";

export const BUILTIN_DESKS: { id: string; label: string }[] = [
  { id: "stuie", label: "Stuie" },
  { id: "mum", label: "Mum" },
];

export function normalizeDeskId(raw: string | undefined | null): string {
  const slug = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  return slug || DEFAULT_DESK_ID;
}

export function jobDeskId(job: { deskId?: string } | null | undefined): string {
  return normalizeDeskId(job?.deskId || DEFAULT_DESK_ID);
}

export function deskLabel(id: string): string {
  const want = normalizeDeskId(id);
  const builtin = BUILTIN_DESKS.find((d) => d.id === want);
  if (builtin) return builtin.label;
  return want.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function lastJobKeyForDesk(deskId: string): string {
  return `skidmarks.mobile.lastJobId.${normalizeDeskId(deskId)}`;
}

export function readDeskId(storage?: { getItem(key: string): string | null }): string {
  return normalizeDeskId(storage?.getItem(MOBILE_DESK_KEY) || DEFAULT_DESK_ID);
}

export function readKnownDesks(storage?: { getItem(key: string): string | null }): string[] {
  const seen = new Set<string>(BUILTIN_DESKS.map((d) => d.id));
  try {
    const raw = storage?.getItem(MOBILE_DESKS_KEY) || "[]";
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (typeof item === "string" && item.trim()) seen.add(normalizeDeskId(item));
      }
    }
  } catch {
    /* keep builtins */
  }
  return [...seen];
}

export function writeDeskId(
  storage: { getItem(key: string): string | null; setItem(key: string, value: string): void },
  deskId: string,
): string {
  const id = normalizeDeskId(deskId);
  const desks = readKnownDesks(storage);
  if (!desks.includes(id)) desks.push(id);
  storage.setItem(MOBILE_DESK_KEY, id);
  storage.setItem(MOBILE_DESKS_KEY, JSON.stringify(desks));
  return id;
}
