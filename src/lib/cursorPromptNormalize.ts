import type { ShowStyleId } from "./showStylePresets";

const DEFAULT_SPEAKERS = [
  "Nuggets",
  "Shazza",
  "Dazza",
  "Ranger Bazza",
  "Nan",
  "CrackWhore Darryl",
  "Kim the Gypsy KUNT",
  "Garry Crump",
  "Jesus.exe",
  "DAP",
  "True crime investigator",
  "Ancient historian",
];

/** Client-safe — breaks Google one-line paste apart before PROMPT parse. */
export function normalizePromptScript(
  raw: string,
  extraSpeakers: string[] = [],
): string {
  let t = raw.replace(/\r\n/g, "\n").trim();
  if (!t) return t;

  t = t.replace(/\s*(---\s*SHOT\s+\d+\s*---)\s*/gi, "\n\n$1\n");

  for (const f of ["EPISODE", "GAG", "Title", "Place", "Cast", "Plate", "SFX"]) {
    t = t.replace(new RegExp(`(?<!\\n)(${f}:\\s*)`, "gi"), "\n$1");
  }

  const speakers = new Set([...DEFAULT_SPEAKERS, ...extraSpeakers]);
  for (const name of speakers) {
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    t = t.replace(new RegExp(`(?<!\\n)(${esc}: )`, "g"), "\n$1");
  }

  return t.replace(/^\n+/, "").replace(/\n{3,}/g, "\n\n").trim();
}

/** @deprecated styleId unused — kept for call-site compat */
export function normalizePromptScriptForStyle(
  raw: string,
  _styleId?: ShowStyleId,
  extraSpeakers: string[] = [],
): string {
  return normalizePromptScript(raw, extraSpeakers);
}
