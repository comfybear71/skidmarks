/** Client-safe labels for the Open episode picker. */

export type MobileEpisodeListItem = {
  id: string;
  prompt: string;
  folderName: string;
  phase: string;
  updatedAt: string;
  speakers: string[];
  styleId?: string;
  placeCount?: number;
};

export function episodeListTitle(job: Pick<MobileEpisodeListItem, "prompt" | "folderName" | "id">): string {
  const vibe = (job.prompt || "").trim().replace(/\s+/g, " ");
  if (vibe) return vibe.length > 72 ? `${vibe.slice(0, 71)}…` : vibe;
  const folder = (job.folderName || "").trim();
  if (folder) return folder;
  return `Episode ${job.id.slice(-6)}`;
}

export function episodePhaseLabel(phase: string): string {
  switch ((phase || "").trim()) {
    case "cast_build":
      return "Cast";
    case "location_build":
      return "Places";
    case "cast_images":
      return "Faces";
    case "location_images":
      return "Place stills";
    case "plates":
      return "Plates";
    case "review":
      return "Review";
    case "animate":
      return "Animate";
    case "stitch":
      return "Stitch";
    case "done":
      return "Done";
    case "error":
      return "Error";
    default:
      return phase || "—";
  }
}

export function episodeUpdatedLabel(iso: string): string {
  const t = Date.parse(iso || "");
  if (!Number.isFinite(t)) return "";
  const sec = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (sec < 60) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 86400 * 14) return `${Math.floor(sec / 86400)}d ago`;
  try {
    return new Date(t).toLocaleDateString();
  } catch {
    return "";
  }
}
