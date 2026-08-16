import type { MobileGenJob, MobileGenPhase } from "./mobileGenJob";

function approvedUnder(
  candidates: Record<string, { approved: boolean }[] | undefined>,
  key: string,
): boolean {
  const exact = candidates[key]?.some((c) => c.approved);
  if (exact) return true;
  const want = key.trim().toLowerCase();
  if (!want) return false;
  return Object.entries(candidates).some(
    ([name, list]) => name.trim().toLowerCase() === want && list?.some((c) => c.approved),
  );
}

/** Approved candidate fileName for a speaker or scene id — same
 * case-insensitive match allCastApproved uses, so TOMATO still finds Tomato. */
export function approvedCandidateFileName(
  candidates: Record<string, { approved: boolean; fileName: string }[] | undefined>,
  key: string,
): string | null {
  const exact = candidates[key]?.find((c) => c.approved)?.fileName?.trim();
  if (exact) return exact;
  const want = key.trim().toLowerCase();
  if (!want) return null;
  for (const [name, list] of Object.entries(candidates)) {
    if (name.trim().toLowerCase() !== want) continue;
    const hit = list?.find((c) => c.approved)?.fileName?.trim();
    if (hit) return hit;
  }
  return null;
}

export function allCastApproved(job: Pick<MobileGenJob, "speakers" | "castCandidates">): boolean {
  return job.speakers.length > 0 && job.speakers.every((s) => approvedUnder(job.castCandidates, s));
}

export function allLocationsApproved(
  job: Pick<MobileGenJob, "scenes" | "locationCandidates">,
): boolean {
  return (
    job.scenes.length > 0 &&
    job.scenes.every((s) => approvedUnder(job.locationCandidates, s.id))
  );
}

/** After the screenplay, skip pick screens whose faces/places are already chosen. */
export function phaseAfterScreenplay(
  job: Pick<MobileGenJob, "speakers" | "castCandidates" | "scenes" | "locationCandidates">,
): Extract<MobileGenPhase, "cast_images" | "location_images" | "plates"> {
  if (!allCastApproved(job)) return "cast_images";
  if (!allLocationsApproved(job)) return "location_images";
  return "plates";
}

/** More / Not this one used to replace the list, which threw away the
 * take you wanted. Keep every still; newest is last. Never delete. */
export function keepCandidateTakes<T extends { id: string; fileName: string }>(
  existing: T[] | undefined,
  incoming: T[],
): T[] {
  const out = [...(existing || [])];
  const seen = new Set(out.map((c) => (c.fileName || c.id).trim()).filter(Boolean));
  for (const c of incoming) {
    const key = (c.fileName || c.id).trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

export function latestCandidate<T>(list: T[] | undefined): T | undefined {
  if (!list?.length) return undefined;
  return list[list.length - 1];
}

/** Tweak adds to the look. It must not replace it — a few extra words
 * used to become the whole description, which is how Jo turned into a raccoon. */
export function directorNote(tweak: string | undefined, look: string | undefined): string {
  const a = (tweak || "").trim();
  const b = (look || "").trim();
  if (a && b) {
    if (a.toLowerCase().includes(b.toLowerCase())) return a;
    if (b.toLowerCase().includes(a.toLowerCase())) return b;
    return `${b}. ${a}`;
  }
  return a || b;
}
