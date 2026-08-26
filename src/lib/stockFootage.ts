import type { CrashStoryDoc, CrashStoryShot, ShotFootageRole } from "./crashStoryTypes";

export type { ShotFootageRole };

export type StockSearchLink = {
  id: "pexels" | "pixabay" | "coverr" | "commons";
  label: string;
  href: string;
  note: string;
};

/** Omitted / junk = hero so older packs stay on the LTX path. */
export function shotFootageRole(
  shot: Pick<CrashStoryShot, "footageRole"> | null | undefined,
): ShotFootageRole {
  return shot?.footageRole === "support" ? "support" : "hero";
}

export function isSupportShot(
  shot: Pick<CrashStoryShot, "footageRole"> | null | undefined,
): boolean {
  return shotFootageRole(shot) === "support";
}

export function findStoryShot(
  story: CrashStoryDoc | null | undefined,
  shotId: string,
): CrashStoryShot | null {
  const id = (shotId || "").trim();
  if (!story || !id) return null;
  for (const scene of story.scenes) {
    const shot = scene.shots.find((sh) => sh.id === id);
    if (shot) return shot;
  }
  return null;
}

export function storyShotIsSupport(
  story: CrashStoryDoc | null | undefined,
  shotId: string,
): boolean {
  return isSupportShot(findStoryShot(story, shotId));
}

/** Search box — typed query wins, else the shot's own words. */
export function stockSearchQuery(
  shot: Pick<CrashStoryShot, "title" | "summary" | "staging" | "stockQuery"> | null | undefined,
  typed?: string,
): string {
  const fromBox = (typed ?? shot?.stockQuery ?? "").trim();
  if (fromBox) return fromBox;
  const bits = [shot?.title, shot?.summary, shot?.staging]
    .map((s) => (s || "").trim())
    .filter(Boolean);
  return bits.join(" ").replace(/\s+/g, " ").trim();
}

export function stockSearchLinks(query: string): StockSearchLink[] {
  const q = (query || "").trim() || "cinematic b-roll";
  const enc = encodeURIComponent(q);
  return [
    {
      id: "pexels",
      label: "Pexels",
      href: `https://www.pexels.com/search/videos/${enc}/`,
      note: "Free license. Film use allowed.",
    },
    {
      id: "pixabay",
      label: "Pixabay",
      href: `https://pixabay.com/videos/search/${enc}/`,
      note: "Free. Skip Premium.",
    },
    {
      id: "coverr",
      label: "Coverr",
      href: `https://coverr.co/search?q=${enc}`,
      note: "Free video. Check the file page.",
    },
    {
      id: "commons",
      label: "Commons",
      href: `https://commons.wikimedia.org/w/index.php?search=${enc}&title=Special:MediaSearch&type=video`,
      note: "Per-file license. Prefer CC0 / CC BY.",
    },
  ];
}

/** A Windows/Mac path cannot reach Vercel. Drop the file instead. */
export function looksLikeLocalFilePath(value: string): boolean {
  const s = (value || "").trim();
  if (!s) return false;
  if (/^[a-zA-Z]:[\\/]/.test(s)) return true;
  if (s.startsWith("\\\\")) return true;
  if (s.startsWith("/Users/") || s.startsWith("/home/") || s.startsWith("/Volumes/")) return true;
  return /\.(mp4|mov|webm|mkv)$/i.test(s) && (s.includes("\\") || s.startsWith("/"));
}
