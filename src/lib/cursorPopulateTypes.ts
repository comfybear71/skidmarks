import { SHOW_STYLE_PRESETS, type ShowStyleId } from "./showStylePresets";

export type CursorShotPlan = {
  shotId: string;
  placeKey: string;
  placeName: string;
  cast: string[];
  note: string;
};

export type CursorPopulateConfig = {
  styleId: ShowStyleId;
  shotPlans: CursorShotPlan[];
  sfxPrompts: Record<string, string>;
  introPrompt: string;
  outroPrompt: string;
};

export const CURSOR_TOUR_STYLE: ShowStyleId = "skidmarks";

/** Client-safe — all show styles for the CURSOR dropdown */
export const CURSOR_STYLE_OPTIONS = SHOW_STYLE_PRESETS.map((p) => ({
  id: p.id,
  label: p.label,
}));
