/**
 * Sunny Banks place stills for the create-episode gate.
 * Cloud = Neon world rows. Local = on-disk world cards + preset names.
 */
import { useCloudStore } from "./cloudEnv";
import { cloudWorldCardStatus } from "./cloudShelf";
import { getShowStylePreset } from "./showStylePresets";
import { listWorldCardStatus } from "./worldCardThumbs";

export type SunnyShelfPlace = { name: string; thumbKey: string };

export async function listSunnyShelfPlaces(): Promise<SunnyShelfPlace[]> {
  const preset = getShowStylePreset("sunny_banks");
  const out: SunnyShelfPlace[] = [];
  const seen = new Set<string>();
  const add = (name: string, thumbKey = "") => {
    const n = name.trim();
    if (!n) return;
    const key = n.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ name: n, thumbKey: thumbKey.trim() });
  };

  const cards = useCloudStore() ? await cloudWorldCardStatus() : listWorldCardStatus();
  const sunny = cards.find((c) => c.id === "sunny_banks");
  for (const t of sunny?.thumbs || []) {
    add(t.name || "", t.key || "");
  }
  for (const p of preset.presetPlaces) add(p.name);
  return out;
}
