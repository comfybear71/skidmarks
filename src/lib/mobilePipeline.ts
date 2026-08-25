/**
 * Stitch is out. Every look finishes on ordered unstitched mp4s.
 * Generate video / LTX still runs. Do not flip this back on.
 */
export const MOBILE_STITCH_MOVIES = false;

export function bounceStuckStitch(opts: {
  phase: string;
  error?: string;
}): "review" | null {
  if (MOBILE_STITCH_MOVIES) return null;
  if (opts.phase === "stitch") return "review";
  return null;
}

export function phaseAfterAnimateQueue(pendingLeft: boolean): "animate" | "stitch" | "review" {
  if (pendingLeft) return "animate";
  return MOBILE_STITCH_MOVIES ? "stitch" : "review";
}

export function phaseAfterErrorResume(pendingLeft: boolean): "animate" | "stitch" | "review" {
  if (pendingLeft) return "animate";
  return MOBILE_STITCH_MOVIES ? "stitch" : "review";
}
