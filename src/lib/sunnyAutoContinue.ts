import type { MobileGenJob } from "@/lib/mobileGenJob";
import { isSunnyAutoJob } from "@/lib/sunnyEpisodeCook";

/** Phone poll dies when they leave /m. Server must walk the next plate/clip. */
export function sunnyAutoShouldContinue(
  job: Pick<MobileGenJob, "styleId" | "sunnyAuto" | "phase">,
): boolean {
  if (!isSunnyAutoJob(job)) return false;
  return job.phase === "plates" || job.phase === "animate";
}
