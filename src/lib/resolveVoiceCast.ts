import type { SwapResultLabel } from "./swapCards";

export type VoiceCastRow = { key: string; name?: string; brief?: string };

/** "Andrew + Margot · place · date" → ["Andrew", "Margot"] */
export function castNamesFromPlateLabel(label?: string): string[] {
  if (!label?.trim()) return [];
  const who = label.split("·")[0]?.trim() || "";
  if (!who) return [];
  return who
    .split("+")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Episode tray cast; swap faces only when tray empty (unless trayOnly). */
export function resolveVoiceCast(opts: {
  swapResults: Record<string, SwapResultLabel>;
  targetGenFile: string;
  episodeCast?: VoiceCastRow[];
  /** Voice panel — drag faces in; never auto-fill from deep-fake swaps. */
  trayOnly?: boolean;
}): VoiceCastRow[] {
  const episode = dedupeCast(opts.episodeCast ?? []);
  if (opts.trayOnly) return episode;

  const plate = opts.targetGenFile;
  const fromSwap = plate
    ? Object.values(opts.swapResults)
        .filter(
          (s) =>
            s.castKey &&
            s.target.kind === "gen" &&
            s.target.fileName === plate,
        )
        .map((s) => ({ key: s.castKey, name: s.castName }))
    : [];

  const swapped = dedupeCast(fromSwap);
  if (swapped.length) return swapped;
  return episode;
}

function dedupeCast(rows: VoiceCastRow[]): VoiceCastRow[] {
  const seen = new Set<string>();
  const out: VoiceCastRow[] = [];
  for (const row of rows) {
    const id = row.key || row.name?.toLowerCase() || "";
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(row);
  }
  return out;
}

/** Preview = last swap on the selected plate, else the plate itself. */
export function pickVoiceHeroStill(opts: {
  presetId: string;
  swapResults: Record<string, SwapResultLabel>;
  swapVersion: number;
  targetGenFile: string;
  voiceCast: VoiceCastRow[];
}): { src: string; title: string } | null {
  const plate = opts.targetGenFile;
  if (!plate) return null;

  for (let i = opts.voiceCast.length - 1; i >= 0; i -= 1) {
    const swap = opts.swapResults[opts.voiceCast[i]?.key ?? ""];
    if (
      swap?.resultFile &&
      swap.target.kind === "gen" &&
      swap.target.fileName === plate
    ) {
      return {
        src: `/api/crash/swap/file?styleId=${encodeURIComponent(opts.presetId)}&file=${encodeURIComponent(swap.resultFile)}&v=${opts.swapVersion}`,
        title: "Deep fake still",
      };
    }
  }

  return {
    src: `/api/crash/gen/file?name=${encodeURIComponent(plate)}`,
    title: "Plated composite",
  };
}
