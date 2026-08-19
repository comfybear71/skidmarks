/** Client-safe Blob folder path for Scratch history. Not a Blob SDK import. */

import type { ScratchBenchRun } from "./types";

export type ScratchBlobKind = "plates" | "mp4";

export function scratchBlobFolderPath(
  styleId: string,
  folder: string,
  kind: ScratchBlobKind,
): string {
  const show = (styleId || "").trim();
  const pack = (folder || "").trim();
  if (!show || !pack) return "";
  return `shows/${show}/episodes/${pack}/${kind}/`;
}

export function scratchMediaFileFromUrl(url?: string): string {
  if (!url) return "";
  try {
    const u = new URL(url, "https://local.invalid");
    return (u.searchParams.get("name") || "").trim();
  } catch {
    return "";
  }
}

export function scratchBlobFolderForRun(
  run: Pick<ScratchBenchRun, "kind" | "styleId" | "mediaFolder" | "plateUrl" | "clipUrl">,
  fallback?: { styleId?: string; folder?: string },
): { path: string; href: string } | null {
  const styleId = (run.styleId || fallback?.styleId || "").trim();
  const folder = (run.mediaFolder || fallback?.folder || "").trim();
  const kind: ScratchBlobKind = run.kind === "clip" ? "mp4" : "plates";
  const path = scratchBlobFolderPath(styleId, folder, kind);
  if (!path) return null;
  const href = (kind === "mp4" ? run.clipUrl : run.plateUrl) || run.plateUrl || run.clipUrl || "";
  return { path, href };
}
