import { EPISODE_TEMPLATE } from "./episodeTemplate";

/** Skidmarks talking-desk template — 9-stage plan, this pack's people and places filled in. */
export function skidmarksTemplateFromJob(job: {
  speakers?: string[];
  scenes?: { placeName?: string }[];
}): string {
  return buildEpisodePrompt(EPISODE_TEMPLATE, {
    character: (job.speakers || []).map((s) => s.trim()).filter(Boolean).join(", "),
    location: (job.scenes || []).map((s) => (s.placeName || "").trim()).filter(Boolean).join(", "),
  });
}

/** Same plan, filled from the show roster (desktop Copy for AI). */
export function skidmarksTemplateFromRoster(live?: {
  cast?: { name: string }[];
  places?: string[];
}): string {
  return buildEpisodePrompt(EPISODE_TEMPLATE, {
    character: (live?.cast || []).map((c) => c.name.trim()).filter(Boolean).join(", "),
    location: (live?.places || []).map((p) => p.trim()).filter(Boolean).join(", "),
  });
}

/** Pull CHARACTER / FAKE WIN / etc. off a script dump for one-click copy. */
export function parseBlueprint(body: string | null | undefined): { label: string; value: string }[] {
  const text = body ?? "";
  const labels = [
    "CHARACTER",
    "LOCATION",
    "THE FAKE WIN",
    "HOW HE LOSES IT",
    "HOW HE GETS SMASHED",
  ];
  const out: { label: string; value: string }[] = [];
  for (const label of labels) {
    const re = new RegExp(
      `^${label}:\\s*(.+?)(?=\\r?\\n(?:${labels.join("|")}|SCENE):|$)`,
      "ims",
    );
    const m = text.match(re);
    if (m?.[1]?.trim()) out.push({ label, value: m[1].trim() });
  }
  return out;
}

export type ScriptFillFields = {
  character: string;
  location: string;
  fakeWin: string;
  losesIt: string;
  getsSmashed: string;
};

function safeTrim(v: string | undefined | null): string {
  return (v ?? "").trim();
}

export function normalizeScriptFields(
  raw: Partial<ScriptFillFields> | null | undefined,
): ScriptFillFields {
  return {
    character: safeTrim(raw?.character),
    location: safeTrim(raw?.location),
    fakeWin: safeTrim(raw?.fakeWin),
    losesIt: safeTrim(raw?.losesIt),
    getsSmashed: safeTrim(raw?.getsSmashed),
  };
}

/** Merge the five fill lines into the locked episode template. */
export function buildEpisodePrompt(
  template: string,
  fields: Partial<ScriptFillFields> | null | undefined,
): string {
  const f = normalizeScriptFields(fields);
  const lines = [
    `CHARACTER: ${f.character || "[name, who they are, what real person/experience they're drawn from]"}`,
    `LOCATION: ${f.location || "[where this episode happens]"}`,
    `THE FAKE WIN: ${f.fakeWin || "[what golden gift arrives in stage 5]"}`,
    `HOW HE LOSES IT: ${f.losesIt || "[stage 7 — how it gets ripped away]"}`,
    `HOW HE GETS SMASHED: ${f.getsSmashed || "[stage 8 — the actual ending]"}`,
  ].join("\n");

  const fillStart = template.indexOf("FILL THIS IN BEFORE YOU GENERATE:");
  const outputStart = template.indexOf("OUTPUT FORMAT");
  if (fillStart === -1 || outputStart === -1) return template;

  return (
    template.slice(0, fillStart) +
    `FILL THIS IN BEFORE YOU GENERATE:\n\n${lines}\n\n---\n\n` +
    template.slice(outputStart)
  );
}
