import {
  HOME_OWNER_ID,
  STUDIO_SESSION_COOKIE,
  homeOwnerId,
  isHomeOwner,
  studioUsersConfigured,
} from "./studioUsers";
import { readSessionCookie, verifyStudioSession } from "./studioSession";

/**
 * Blob / Neon namespace. Home owner (first STUDIO_USERS email, or Stuie
 * when the env is empty) keeps the live unprefixed paths:
 *   shows/{show}/episodes/{folder}/...
 * Everyone else writes under:
 *   users/{id}/shows/{show}/episodes/{folder}/...
 * so Mum cannot overwrite or delete Stuie's packs.
 */

export function ownerStoragePrefix(ownerId: string | undefined | null): string {
  if (isHomeOwner(ownerId)) return "";
  const id = String(ownerId || "").trim();
  if (!id) return "";
  return `users/${id}/`;
}

export function ownedEpisodeRowId(
  showId: string,
  folderName: string,
  ownerId: string | undefined | null,
): string {
  const folder = folderName.trim();
  if (isHomeOwner(ownerId)) return `${showId}/${folder}`;
  return `${String(ownerId).trim()}/${showId}/${folder}`;
}

export function ownedShowFileRowId(
  showId: string,
  kind: string,
  filename: string,
  ownerId: string | undefined | null,
): string {
  const base = `${showId}/${kind}/${filename}`;
  if (isHomeOwner(ownerId)) return base;
  return `${String(ownerId).trim()}/${base}`;
}

export function jobOwnerId(job: { ownerId?: string; deskId?: string } | null | undefined): string {
  return (job?.ownerId || job?.deskId || HOME_OWNER_ID).trim() || HOME_OWNER_ID;
}

/** True when this job is allowed to be read/written by the signed-in person. */
export function jobBelongsToOwner(
  job: { ownerId?: string; deskId?: string } | null | undefined,
  ownerId: string | undefined | null,
): boolean {
  if (!job) return false;
  const current = String(ownerId || "").trim();
  if (!current) return false;
  const stamped = String(job.ownerId || "").trim();
  const desk = String(job.deskId || "").trim();
  if (isHomeOwner(current)) {
    if (!stamped) return !desk || isHomeOwner(desk);
    return isHomeOwner(stamped) || stamped === current;
  }
  if (stamped) return stamped === current;
  return desk === current;
}

/**
 * Who this request is. Cookie only — never trust x-studio-owner from the
 * client (that would let Mum send Stuie's id and read his packs).
 *
 * Empty STUDIO_USERS → Stuie (local PC / this VM, no login).
 * STUDIO_USERS set + no cookie → null (do not fall back to Stuie's data).
 * Scripts outside a Next request → home, so PC backfill still writes his tree.
 */
export async function boundStudioOwner(): Promise<string | null> {
  if (!studioUsersConfigured()) return homeOwnerId();
  try {
    const { cookies } = await import("next/headers");
    const jar = await cookies();
    const token = jar.get(STUDIO_SESSION_COOKIE)?.value || "";
    const sess = await verifyStudioSession(token);
    return sess?.id || null;
  } catch {
    return homeOwnerId();
  }
}

export async function ownerFromRequest(req: Request): Promise<string | null> {
  if (!studioUsersConfigured()) return homeOwnerId();
  const token = readSessionCookie(req.headers.get("cookie"));
  const sess = await verifyStudioSession(token);
  return sess?.id || null;
}

/** Shared WORLD/CAST folders on disk are Stuie's. Guests must not fall
 * through to them after a Neon miss — that is how places bleed. */
export async function mayReadHomeDiskShelf(): Promise<boolean> {
  if (!studioUsersConfigured()) return true;
  const owner = await boundStudioOwner();
  return Boolean(owner && isHomeOwner(owner));
}
