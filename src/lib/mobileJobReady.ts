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
