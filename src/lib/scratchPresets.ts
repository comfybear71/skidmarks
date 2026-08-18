/**
 * Scratch position presets — builtins from the campaign + crowd set,
 * customs in localStorage so you can edit and add your own.
 */

import { plateLtxCampaignScenarios, campaignStagingForId } from "./mobilePlateLtxCampaign";

export const SCRATCH_PRESET_GROUPS = [
  "Frame",
  "Body",
  "Holding",
  "Wearing",
  "Weather / edge",
  "Crowd / multi",
  "Mine",
] as const;

export type ScratchPresetGroup = (typeof SCRATCH_PRESET_GROUPS)[number];

export type ScratchPreset = {
  id: string;
  group: ScratchPresetGroup;
  label: string;
  /** Staging with {{name}} {{place}} {{cast}} tokens. */
  template: string;
  builtin?: boolean;
};

const STORAGE_KEY = "skidmarks.scratch.presets.v1";

const BUILTIN_GROUP_IDS: Record<Exclude<ScratchPresetGroup, "Mine">, string[]> = {
  Frame: ["mcu-phone", "wide-full", "tight-face", "over-shoulder", "walk-in"],
  Body: ["sitting", "standing", "running", "sprawl", "dance", "leaning", "steps", "crouch", "handstand"],
  Holding: ["beer-cig", "pie"],
  Wearing: [
    "clothes-dress",
    "clothes-underwear",
    "clothes-partial",
    "clothes-nude",
    "clothes-man-partial",
    "clothes-man-nude",
  ],
  "Weather / edge": ["raining", "wash-hair"],
  "Crowd / multi": ["crowd-two-shot", "crowd-surround", "crowd-pile"],
};

const WEARING_TEMPLATES: Record<string, { label: string; template: string }> = {
  "clothes-partial": {
    label: "Partial nude",
    template:
      "Adult {{name}}, partial nudity at {{place}} — topless or underwear only. Change the clothes from the face card. Same face, this body, not the outfit on the reference. Natural body, not a catalogue pose.",
  },
  "clothes-nude": {
    label: "Nude",
    template:
      "Adult {{name}}, fully nude at {{place}}. Change the clothes from the face card. Same face, hair, age and body. Ignore the outfit on the face card. Natural proportions, unposed. No text or watermarks.",
  },
  "clothes-man-partial": {
    label: "Man partial",
    template:
      "Adult man {{name}}, partial nudity at {{place}} — shirtless, underwear only or bare. Adult male chest. Change the clothes from the face card. Same face, this male body, not the tee. Do not redraw as a woman. Natural body, not a catalogue pose.",
  },
  "clothes-man-nude": {
    label: "Man nude",
    template:
      "Adult man {{name}}, fully nude at {{place}}. Adult male body — bare chest, male groin, no clothes. Same face, hair, age as the face card. Ignore the tee, shorts and undies on the face card. Do not redraw as a woman. Natural proportions, unposed. Adults only, no one under 21. No text or watermarks.",
  },
};

const CROWD_TEMPLATES: Record<string, { label: string; template: string }> = {
  "crowd-two-shot": {
    label: "Two-shot",
    template:
      "{{cast}} in a tight two-shot at {{place}}. Only {{cast}} in frame, no one else appears. {{name}} is nearest the camera, speaking. Others stay in frame beside them, reacting. Same faces as the face cards. Do not invent extras.",
  },
  "crowd-surround": {
    label: "Surround",
    template:
      "{{cast}} crowded around each other at {{place}}. Only {{cast}} in frame, no one else appears. {{name}} is in the middle, prominent. Others flank and lean in — hands, shoulders, close. Same faces as the face cards. Do not invent extras.",
  },
  "crowd-pile": {
    label: "Pile / tangle",
    template:
      "{{cast}} piled together at {{place}}. Only {{cast}} in frame, no one else appears. {{name}} is prominent in the pile. Others are pressed in close — tangled bodies, using each other and the place. Same faces as the face cards. Do not invent extras.",
  },
};

function stripNum(label: string): string {
  return label.replace(/^\d+\s+/, "");
}

function builtinPresets(): ScratchPreset[] {
  const labels = new Map(plateLtxCampaignScenarios().map((s) => [s.id, stripNum(s.label)]));
  const out: ScratchPreset[] = [];
  for (const [group, ids] of Object.entries(BUILTIN_GROUP_IDS) as [Exclude<ScratchPresetGroup, "Mine">, string[]][]) {
    for (const id of ids) {
      if (group === "Crowd / multi") {
        const row = CROWD_TEMPLATES[id];
        if (!row) continue;
        out.push({ id, group, label: row.label, template: row.template, builtin: true });
        continue;
      }
      if (group === "Wearing" && WEARING_TEMPLATES[id]) {
        const row = WEARING_TEMPLATES[id];
        out.push({ id, group, label: row.label, template: row.template, builtin: true });
        continue;
      }
      const label = labels.get(id) || id;
      let template = "";
      try {
        template = campaignStagingForId(id, "{{name}}", "{{place}}");
      } catch {
        template = "{{name}} at {{place}}.";
      }
      out.push({ id, group, label, template, builtin: true });
    }
  }
  return out;
}

function readCustoms(): ScratchPreset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ScratchPreset[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((p) => p && typeof p.id === "string" && typeof p.template === "string")
      .map((p) => ({
        id: p.id,
        group: (SCRATCH_PRESET_GROUPS.includes(p.group as ScratchPresetGroup) ? p.group : "Mine") as ScratchPresetGroup,
        label: String(p.label || "Custom").trim() || "Custom",
        template: String(p.template || ""),
        builtin: false,
      }));
  } catch {
    return [];
  }
}

function writeCustoms(customs: ScratchPreset[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(customs.map(({ id, group, label, template }) => ({ id, group, label, template }))),
    );
  } catch {
    /* private mode */
  }
}

export function loadScratchPresets(): ScratchPreset[] {
  const builtins = builtinPresets();
  const customs = readCustoms();
  const overridden = new Set(customs.map((c) => c.id));
  return [...builtins.filter((b) => !overridden.has(b.id)), ...customs];
}

export function applyScratchPresetTemplate(
  template: string,
  opts: { name: string; place: string; cast?: string[] },
): string {
  const name = (opts.name || "Character").trim() || "Character";
  const place = (opts.place || "this place").trim() || "this place";
  const cast = (opts.cast || []).map((n) => n.trim()).filter(Boolean);
  const castStr = cast.length ? cast.join(", ") : name;
  return template
    .replaceAll("{{name}}", name)
    .replaceAll("{{place}}", place)
    .replaceAll("{{cast}}", castStr);
}

export function upsertScratchPreset(preset: ScratchPreset): ScratchPreset[] {
  const next: ScratchPreset = {
    id: preset.id.trim() || `custom_${Date.now().toString(36)}`,
    group: preset.group || "Mine",
    label: preset.label.trim() || "Custom",
    template: preset.template,
    builtin: false,
  };
  const customs = readCustoms().filter((c) => c.id !== next.id);
  customs.push(next);
  writeCustoms(customs);
  return loadScratchPresets();
}

/** Save over a builtin id as a custom override, or update an existing custom. */
export function saveScratchPresetFromPrompt(opts: {
  id?: string;
  group: ScratchPresetGroup;
  label: string;
  template: string;
}): ScratchPreset[] {
  const id = (opts.id || "").trim() || `mine_${Date.now().toString(36)}`;
  return upsertScratchPreset({
    id,
    group: opts.group,
    label: opts.label,
    template: opts.template,
  });
}

export function deleteScratchPreset(id: string): ScratchPreset[] {
  writeCustoms(readCustoms().filter((c) => c.id !== id));
  return loadScratchPresets();
}

export function newScratchPresetId(): string {
  return `mine_${Date.now().toString(36)}`;
}
