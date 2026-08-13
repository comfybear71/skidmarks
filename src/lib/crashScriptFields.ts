import { CRASH_SCRIPT_FIELDS_EVENT } from "./crashStyleSync";
import { normalizeScriptFields, type ScriptFillFields } from "./scriptBlueprint";
import type { ShowStyleId } from "./showStylePresets";
import { loadShowStyleIdOptional } from "./showStylePresets";
import { readActiveEpisode } from "./crashActiveEpisode";

export const SCRIPT_FIELDS_KEY = "crashlab-script-fields";
export const SCRIPT_STEP_KEY = "crashlab-production-step";

const FIELDS_KEY = SCRIPT_FIELDS_KEY;

export type ScriptDeskState = {
  showStyleId: ShowStyleId | null;
  productionStep: number;
  swapTargetGenFile: string;
  fields: ScriptFillFields;
  spineStep: number;
};

/** Read Script desk step + fields for floating side panels. */
export function readScriptDeskState(): ScriptDeskState {
  const ep = readActiveEpisode();
  const globalStyle = loadShowStyleIdOptional();
  let showStyleId = ep?.styleId ?? globalStyle;
  let productionStep = 1;
  let swapTargetGenFile = "";
  let spineStep = 1;
  let fields = normalizeScriptFields({});
  try {
    const raw = localStorage.getItem(FIELDS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      // Open episode locks the show. Else global crashlab-show-style, else script-fields.
      if (!showStyleId && typeof parsed.showStyle === "string") {
        showStyleId = parsed.showStyle as ShowStyleId;
      }
      if (typeof parsed.productionStep === "number") {
        productionStep = parsed.productionStep;
      }
      if (typeof parsed.swapTargetGenFile === "string") {
        swapTargetGenFile = parsed.swapTargetGenFile;
      }
      if (typeof parsed.spineStep === "number") {
        spineStep = parsed.spineStep;
      }
      fields = normalizeScriptFields(parsed);
    }
    const stepRaw = localStorage.getItem(SCRIPT_STEP_KEY);
    if (stepRaw) {
      const n = Number(stepRaw);
      if (n >= 1 && n <= 6) productionStep = n;
    }
  } catch {
    /* ignore */
  }
  return { showStyleId, productionStep, swapTargetGenFile, fields, spineStep };
}

/** Patch story/script fields from floating Story panel. */
export function patchScriptDeskFields(
  partial: Partial<ScriptFillFields & { spineStep?: number }>,
): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(FIELDS_KEY);
    const prev = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    const merged = { ...prev, ...partial };
    const scriptKeys: (keyof ScriptFillFields)[] = [
      "character",
      "location",
      "fakeWin",
      "losesIt",
      "getsSmashed",
    ];
    const scriptPatch: Partial<ScriptFillFields> = {};
    for (const k of scriptKeys) {
      if (partial[k] !== undefined) scriptPatch[k] = partial[k];
    }
    if (Object.keys(scriptPatch).length) {
      merged.character = normalizeScriptFields({
        ...prev,
        ...scriptPatch,
      }).character;
      merged.location = normalizeScriptFields({
        ...prev,
        ...scriptPatch,
      }).location;
      merged.fakeWin = normalizeScriptFields({
        ...prev,
        ...scriptPatch,
      }).fakeWin;
      merged.losesIt = normalizeScriptFields({
        ...prev,
        ...scriptPatch,
      }).losesIt;
      merged.getsSmashed = normalizeScriptFields({
        ...prev,
        ...scriptPatch,
      }).getsSmashed;
    }
    localStorage.setItem(FIELDS_KEY, JSON.stringify(merged));
    window.dispatchEvent(new CustomEvent(CRASH_SCRIPT_FIELDS_EVENT));
  } catch {
    /* ignore */
  }
}

export type ScriptDeskCharacterDraft = {
  styleId: ShowStyleId | null;
  prompt: string;
  /** Any cast picked for episode — blocks new-char pull from Image gen */
  styleCastKeys: string[];
  styleThumbKey: string;
  styleWorldKey: string;
};

const GENERIC_CAST_NAME = /^(file|still|image|download|photo|untitled)$/i;

export function isGenericCastName(name: string): boolean {
  const n = name.trim();
  if (!n) return true;
  return GENERIC_CAST_NAME.test(n);
}

/** Add one cast thumb key to the episode Voice tray (slot only). */
export function addScriptDeskCastKey(castKey: string): void {
  if (typeof window === "undefined") return;
  const key = String(castKey || "").trim();
  if (!key) return;
  try {
    const raw = localStorage.getItem(FIELDS_KEY);
    const prev = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    const keys = Array.isArray(prev.styleCastKeys)
      ? prev.styleCastKeys.filter((k): k is string => typeof k === "string")
      : prev.styleThumbKey
        ? [String(prev.styleThumbKey)]
        : [];
    if (keys.includes(key)) {
      window.dispatchEvent(new CustomEvent(CRASH_SCRIPT_FIELDS_EVENT));
      return;
    }
    const next = [...keys, key];
    localStorage.setItem(
      FIELDS_KEY,
      JSON.stringify({
        ...prev,
        styleCastKeys: next,
        styleThumbKey:
          typeof prev.styleThumbKey === "string" && prev.styleThumbKey
            ? prev.styleThumbKey
            : key,
      }),
    );
    window.dispatchEvent(new CustomEvent(CRASH_SCRIPT_FIELDS_EVENT));
  } catch {
    /* ignore */
  }
}

/** Drop one cast thumb key from the episode Voice / Characters tray (slot only — no file wipe). */
export function removeScriptDeskCastKey(castKey: string): void {
  if (typeof window === "undefined") return;
  const key = String(castKey || "").trim();
  if (!key) return;
  try {
    const raw = localStorage.getItem(FIELDS_KEY);
    const prev = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    const keys = Array.isArray(prev.styleCastKeys)
      ? prev.styleCastKeys.filter((k): k is string => typeof k === "string")
      : prev.styleThumbKey
        ? [String(prev.styleThumbKey)]
        : [];
    const next = keys.filter((k) => k !== key);
    const thumb =
      typeof prev.styleThumbKey === "string" && prev.styleThumbKey === key
        ? next[0] || ""
        : prev.styleThumbKey;
    localStorage.setItem(
      FIELDS_KEY,
      JSON.stringify({ ...prev, styleCastKeys: next, styleThumbKey: thumb }),
    );
    window.dispatchEvent(new CustomEvent(CRASH_SCRIPT_FIELDS_EVENT));
  } catch {
    /* ignore */
  }
}

/** Clear all episode cast thumb keys from Voice / Characters tray (slots only). */
export function clearScriptDeskCastKeys(): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(FIELDS_KEY);
    const prev = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    localStorage.setItem(
      FIELDS_KEY,
      JSON.stringify({ ...prev, styleCastKeys: [], styleThumbKey: "" }),
    );
    window.dispatchEvent(new CustomEvent(CRASH_SCRIPT_FIELDS_EVENT));
  } catch {
    /* ignore */
  }
}

/** Develop-character idea from Script desk (localStorage). */
export function readScriptDeskCharacterDraft(): ScriptDeskCharacterDraft {
  try {
    const raw = localStorage.getItem(FIELDS_KEY);
    if (!raw) {
      return {
        styleId: readActiveEpisode()?.styleId ?? loadShowStyleIdOptional(),
        prompt: "",
        styleCastKeys: [],
        styleThumbKey: "",
        styleWorldKey: "",
      };
    }
    const parsed = JSON.parse(raw) as {
      showStyle?: ShowStyleId;
      character?: string;
      styleThumbKey?: string;
      styleCastKeys?: string[];
      styleWorldKey?: string;
    };
    const styleCastKeys = Array.isArray(parsed.styleCastKeys)
      ? parsed.styleCastKeys.filter((k): k is string => typeof k === "string")
      : parsed.styleThumbKey
        ? [parsed.styleThumbKey]
        : [];
    return {
      styleId:
        readActiveEpisode()?.styleId ??
        parsed.showStyle ??
        loadShowStyleIdOptional(),
      prompt: String(parsed.character ?? "").trim(),
      styleCastKeys,
      styleThumbKey: String(parsed.styleThumbKey ?? ""),
      styleWorldKey: String(parsed.styleWorldKey ?? "").trim(),
    };
  } catch {
    return {
      styleId: readActiveEpisode()?.styleId ?? loadShowStyleIdOptional(),
      prompt: "",
      styleCastKeys: [],
      styleThumbKey: "",
      styleWorldKey: "",
    };
  }
}
