import { isSunnyAutoJob } from "@/lib/sunnyEpisodeCook";

/** Phone poll dies when they leave /m. Server must walk the next plate/clip. */
export function sunnyAutoShouldContinue(job: {
  styleId: string;
  sunnyAuto?: boolean;
  phase: string;
}): boolean {
  if (!isSunnyAutoJob(job)) return false;
  return job.phase === "plates" || job.phase === "animate";
}
