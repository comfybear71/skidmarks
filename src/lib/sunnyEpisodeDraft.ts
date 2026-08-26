/** Gag + script on the Sunny Banks create card. Refresh must not wipe them. */
export const SUNNY_DRAFT_BRIEF_KEY = "skidmarks.sunny.draftBrief";
export const SUNNY_DRAFT_SCRIPT_KEY = "skidmarks.sunny.draftScript";

export function readSunnyEpisodeDraft(storage?: {
  getItem(key: string): string | null;
}): { brief: string; script: string } {
  if (!storage) return { brief: "", script: "" };
  return {
    brief: (storage.getItem(SUNNY_DRAFT_BRIEF_KEY) || "").trim(),
    script: storage.getItem(SUNNY_DRAFT_SCRIPT_KEY) || "",
  };
}

export function writeSunnyEpisodeDraft(
  storage: { setItem(key: string, value: string): void },
  brief: string,
  script: string,
): void {
  storage.setItem(SUNNY_DRAFT_BRIEF_KEY, brief);
  storage.setItem(SUNNY_DRAFT_SCRIPT_KEY, script);
}
