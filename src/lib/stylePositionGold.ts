/**
 * /m GOLD positioning — one proven still example per look.
 * Not Scratch's Gold prompts menu (stills + clips). This is sit / frame /
 * only-that-person for the current style (skidmarks, sunny_banks, …).
 *
 * Skidmarks uses compileScriptedPosition (talking-plate default, bed lock).
 * Other looks keep the MCU + alone shape and change the sit / perform line.
 * Look lock stays on the compositor — do not paste Sunny cel / Skidmarks 3D
 * into this box (that is how looks bleed).
 */

import { compileScriptedPosition } from "./mobilePlateScript";
import {
  SHOW_STYLE_PRESETS,
  getShowStylePreset,
  type ShowStyleId,
} from "./showStylePresets";

export type StylePositionGold = {
  styleId: ShowStyleId;
  /** Human look name — Skidmarks, Sunny Banks, … */
  label: string;
  /** One-line "for what" on the GOLD button title. */
  forWhat: string;
  /** Body with {{name}} {{place}}. Skidmarks apply uses compileScriptedPosition. */
  template: string;
};

function mcu(middle: string, hands = "Empty hands. No phone."): string {
  return [
    "Medium close-up of {{name}} at {{place}}. Upper chest and face fill the frame.",
    middle,
    hands,
    "Only {{name}} in frame. No other people.",
  ].join(" ");
}

const ROWS: Record<ShowStyleId, Pick<StylePositionGold, "forWhat" | "template">> = {
  skidmarks: {
    forWhat: "Skidmarks talking-plate MCU — sit, mouth clear, only that person",
    template: mcu(
      "{{name}} is sitting at {{place}}, weight grounded. Facing camera, mouth clear.",
      "Empty hands in her lap. No phone.",
    ),
  },
  sunny_banks: {
    forWhat: "Sunny Banks gag plate — MCU in the park, only that person",
    template: mcu(
      "{{name}} is in the scene at {{place}}, weight grounded. Facing camera, mouth clear.",
    ),
  },
  music_video: {
    forWhat: "Music video performance MCU — hero in frame, no crowd",
    template: mcu(
      "{{name}} is performing at {{place}}, weight grounded. Facing camera, mouth clear.",
      "Empty hands unless a mic or instrument is the lock. No phone. No crowd.",
    ),
  },
  doc: {
    forWhat: "Documentary talking-head — interview MCU, only the subject",
    template: mcu(
      "{{name}} is seated for interview at {{place}}, weight grounded. Facing camera, mouth clear.",
    ),
  },
  deepfake: {
    forWhat: "Deep fake blocking plate — MCU, locked identity, only that person",
    template: mcu(
      "{{name}} is sitting at {{place}}, weight grounded. Facing camera, mouth clear.",
    ),
  },
  photoreal: {
    forWhat: "Photoreal cinematic MCU — only that person",
    template: mcu(
      "{{name}} is sitting at {{place}}, weight grounded. Facing camera, mouth clear.",
    ),
  },
};

export function stylePositionGold(styleId: ShowStyleId): StylePositionGold {
  const preset = getShowStylePreset(styleId);
  const row = ROWS[preset.id];
  return {
    styleId: preset.id,
    label: preset.label,
    forWhat: row.forWhat,
    template: row.template,
  };
}

export function applyStylePositionGold(
  styleId: ShowStyleId,
  tokens: { name: string; place: string },
): string {
  const name = tokens.name.trim() || "Character";
  const place = tokens.place.trim() || "this place";
  if (getShowStylePreset(styleId).id === "skidmarks") {
    return compileScriptedPosition({ name, place });
  }
  return stylePositionGold(styleId)
    .template.replaceAll("{{name}}", name)
    .replaceAll("{{place}}", place);
}

/** Every look must have a GOLD row — used by the check script. */
export function stylePositionGoldRows(): StylePositionGold[] {
  return SHOW_STYLE_PRESETS.map((preset) => stylePositionGold(preset.id));
}
