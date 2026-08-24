import {
  EPISODE_CONSTRUCTION_BLANK,
  EPISODE_CONSTRUCTION_EXAMPLE,
  EPISODE_TEMPLATE_RULES,
} from "./episodeTemplate";

function fillConstructionLine(text: string, key: string, value: string): string {
  const v = value.trim();
  if (!v) return text;
  const re = new RegExp(`(\\* \\[${key}\\]:).*`, "m");
  return text.replace(re, `$1 ${v}`);
}

/** Fill this pack's people and places into the blank construction script only. */
export function fillConstructionBlank(
  blank: string,
  fields: { character?: string; location?: string; title?: string; genreStyle?: string },
): string {
  let out = blank;
  out = fillConstructionLine(out, "EP_TITLE", fields.title || "");
  out = fillConstructionLine(out, "GENRE_STYLE", fields.genreStyle || "");
  out = fillConstructionLine(out, "CAST_MAIN", fields.character || "");
  out = fillConstructionLine(out, "ENV_SETS", fields.location || "");
  return out;
}

function packFields(job: {
  speakers?: string[];
  scenes?: { placeName?: string }[];
  folderName?: string;
}): { character: string; location: string; title: string } {
  return {
    character: (job.speakers || []).map((s) => s.trim()).filter(Boolean).join(", "),
    location: (job.scenes || []).map((s) => (s.placeName || "").trim()).filter(Boolean).join(", "),
    title: (job.folderName || "").trim(),
  };
}

/** Blank construction only — this pack's cast and places filled in. */
export function skidmarksBlankFromJob(job: {
  speakers?: string[];
  scenes?: { placeName?: string }[];
  folderName?: string;
}): string {
  const fields = packFields(job);
  return fillConstructionBlank(EPISODE_CONSTRUCTION_BLANK, {
    character: fields.character,
    location: fields.location,
    title: fields.title,
    genreStyle: "PURE_3D",
  });
}

function skidmarksDocument(fields: { character?: string; location?: string; title?: string }): string {
  const blank = fillConstructionBlank(EPISODE_CONSTRUCTION_BLANK, {
    character: fields.character,
    location: fields.location,
    title: fields.title,
    genreStyle: "PURE_3D",
  });
  return `${EPISODE_TEMPLATE_RULES}

------------------------------

${blank}

------------------------------

${EPISODE_CONSTRUCTION_EXAMPLE}`;
}

/** Skidmarks talking-desk template — rules + blank construction + Little Red example. */
export function skidmarksTemplateFromJob(job: {
  speakers?: string[];
  scenes?: { placeName?: string }[];
  folderName?: string;
}): string {
  return skidmarksDocument(packFields(job));
}

/** Same plan, filled from the show roster (desktop Copy for AI). */
export function skidmarksTemplateFromRoster(live?: {
  cast?: { name: string }[];
  places?: string[];
}): string {
  return skidmarksDocument({
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

/** Merge pack people/places into the Skidmarks construction template. */
export function buildEpisodePrompt(
  template: string,
  fields: Partial<ScriptFillFields> | null | undefined,
): string {
  const f = normalizeScriptFields(fields);
  if (template.includes("## MASTER EPISODE CONSTRUCTION TEMPLATE")) {
    return skidmarksDocument({
      character: f.character,
      location: f.location,
    });
  }
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
