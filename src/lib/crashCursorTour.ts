import type { CrashPanelId } from "./crashDeskLayout";
import {
  clearAllPanelShut,
  CRASH_STACK_FALLBACK,
  readCrashDeskMode,
  writeCrashDeskMode,
  writeStackFocusPanel,
} from "./crashDeskLayout";
import { clearCursorSmokeSession } from "./crashCursorSmoke";
import {
  setActiveEpisodeFromOpen,
  clearActiveEpisode,
} from "./crashActiveEpisode";
import { writeSceneKitDraft } from "./crashSceneKitFields";
import {
  dispatchShowStylePick,
  dispatchStorySaved,
  dispatchVoiceSaved,
  CRASH_STYLE_THUMB_SAVED,
  CRASH_WORLD_THUMB_SAVED,
  CRASH_SPX_SAVED,
} from "./crashStyleSync";
import { writeComfyDraft } from "./crashComfyStack";
import {
  saveShowStyleId,
  type ShowStyleId,
} from "./showStylePresets";
import { CURSOR_TOUR_STYLE } from "./cursorPopulateTypes";
import type { CursorStillPlan } from "./cursorOriginalKit";

export const CRASH_CURSOR_TOUR_EVENT = "crash-cursor-tour";
export const CRASH_CURSOR_PROCEED_EVENT = "crash-cursor-proceed";
export const CRASH_CURSOR_REJECT_EVENT = "crash-cursor-reject";

export type CursorTourPhase =
  | "idle"
  | "running"
  | "awaiting"
  | "done"
  | "error";

export type CursorTourDetail = {
  phase: CursorTourPhase;
  index: number;
  total: number;
  label: string;
  buildPct?: number;
  buildCurrent?: number;
  buildTotal?: number;
  folderName?: string;
  previewUrl?: string;
};

export class CursorTourRejectedError extends Error {
  constructor() {
    super("CURSOR rejected");
    this.name = "CursorTourRejectedError";
  }
}

const STEPS = [
  "Character",
  "Voice",
  "Scene kit",
  "Cast",
  "Cast voice",
  "Script",
  "Locations",
  "Plates",
  "Animate",
  "SFX",
  "Storyboard",
] as const;

const RESUME_FOLDER = "CURSOR_CLIVE_THE_CLIPBOARD_3";

function emitTour(detail: CursorTourDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CRASH_CURSOR_TOUR_EVENT, { detail }));
}

export function dispatchCursorProceed(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CRASH_CURSOR_PROCEED_EVENT));
}

export function dispatchCursorReject(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CRASH_CURSOR_REJECT_EVENT));
}

function waitProceed(): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      window.removeEventListener(CRASH_CURSOR_PROCEED_EVENT, onGo);
      window.removeEventListener(CRASH_CURSOR_REJECT_EVENT, onNo);
    };
    const onGo = () => {
      cleanup();
      resolve();
    };
    const onNo = () => {
      cleanup();
      reject(new CursorTourRejectedError());
    };
    window.addEventListener(CRASH_CURSOR_PROCEED_EVENT, onGo);
    window.addEventListener(CRASH_CURSOR_REJECT_EVENT, onNo);
  });
}

function focusPanel(id: CrashPanelId): void {
  if (readCrashDeskMode() !== "stack") {
    writeCrashDeskMode("stack");
  }
  writeStackFocusPanel(id);
}

function bumpGalleries(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CRASH_STYLE_THUMB_SAVED));
  window.dispatchEvent(new CustomEvent(CRASH_WORLD_THUMB_SAVED));
}

function faceUrl(styleId: ShowStyleId, thumbKey: string): string {
  return `/api/crash/style-cards/file?styleId=${encodeURIComponent(styleId)}&thumb=${encodeURIComponent(thumbKey)}&t=${Date.now()}`;
}

async function makeStill(
  styleId: ShowStyleId,
  kind: "face" | "place",
  plan: CursorStillPlan,
): Promise<{ thumbKey: string; url: string; name: string }> {
  const res = await fetch("/api/crash/cursor/make-still", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      styleId,
      kind,
      name: plan.name,
      brief: plan.brief,
      prompt: plan.prompt,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Still failed");
  return {
    thumbKey: String(data.thumbKey),
    url: String(data.url || ""),
    name: String(data.name || plan.name),
  };
}

async function stepApi(
  styleId: ShowStyleId,
  action: string,
  extra: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const res = await fetch("/api/crash/cursor/step", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ styleId, action, ...extra }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `${action} failed`);
  return data as Record<string, unknown>;
}

async function lockExistingVoice(
  styleId: ShowStyleId,
  castKey: string,
  plan: CursorStillPlan,
): Promise<void> {
  await stepApi(styleId, "lockVoice", {
    castKey,
    castName: plan.name,
    voiceDescription: plan.voiceDescription,
    libraryVoiceName: plan.libraryVoiceName || plan.name,
  });
}

async function stepBusy(
  index: number,
  total: number,
  label: string,
  folderName: string,
  work: () => Promise<string | undefined>,
): Promise<string | undefined> {
  emitTour({
    phase: "running",
    index,
    total,
    label,
    folderName,
    buildPct: 8,
    buildCurrent: 0,
    buildTotal: 1,
  });
  const tick = window.setInterval(() => {
    emitTour({
      phase: "running",
      index,
      total,
      label,
      folderName,
      buildPct: Math.min(92, 8 + Math.floor(Math.random() * 20)),
      buildCurrent: 0,
      buildTotal: 1,
    });
  }, 900);
  try {
    const previewUrl = await work();
    window.clearInterval(tick);
    emitTour({
      phase: "awaiting",
      index,
      total,
      label: `${label} — done. Proceed when ready.`,
      folderName,
      buildPct: 100,
      buildCurrent: 1,
      buildTotal: 1,
      previewUrl,
    });
    await waitProceed();
    return previewUrl;
  } catch (e) {
    window.clearInterval(tick);
    throw e;
  }
}

async function stepShow(
  index: number,
  total: number,
  label: string,
  folderName: string,
  panel: CrashPanelId,
  previewUrl?: string,
): Promise<void> {
  focusPanel(panel);
  emitTour({
    phase: "awaiting",
    index,
    total,
    label: `${label} — look, then Proceed.`,
    folderName,
    buildPct: 100,
    buildCurrent: 1,
    buildTotal: 1,
    previewUrl,
  });
  await waitProceed();
}

function emitError(total: number, folderName: string, err: unknown): void {
  emitTour({
    phase: "error",
    index: 0,
    total,
    label: err instanceof Error ? err.message : "CURSOR stopped",
    folderName,
    buildPct: 0,
  });
}

/**
 * Full CURSOR walk into a CURSOR_??? pack.
 * Skidmarks — resumes CURSOR_CLIVE_THE_CLIPBOARD_3 when faces exist.
 * Sunny Banks — new CURSOR_SUNNY_BANKS pack, gallery faces (no new gens).
 * Voices = existing library locks only (no Voice Design).
 * Animate fields filled — no Comfy Send.
 */
export async function runCursorTour(
  styleId: ShowStyleId = CURSOR_TOUR_STYLE,
): Promise<void> {
  const tourStyle = styleId;
  const sunny = tourStyle === "sunny_banks";
  const total = STEPS.length;
  clearCursorSmokeSession();
  clearAllPanelShut();
  writeCrashDeskMode("stack");
  writeStackFocusPanel(CRASH_STACK_FALLBACK);
  saveShowStyleId(tourStyle);
  dispatchShowStylePick(tourStyle);

  emitTour({
    phase: "running",
    index: 0,
    total,
    label: sunny
      ? "Opening CURSOR_SUNNY_BANKS…"
      : `Opening ${RESUME_FOLDER} (or new CURSOR)…`,
    buildPct: 15,
    buildCurrent: 0,
    buildTotal: 1,
  });

  let folderName = "";
  let facesReady = false;
  let kit: {
    arsehole: CursorStillPlan;
    cast: CursorStillPlan[];
    places: CursorStillPlan[];
  };
  let arseholeKey = "";
  const castKeys: string[] = [];
  const worldKeys: string[] = [];

  try {
    const res = await fetch("/api/crash/cursor/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        sunny
          ? { styleId: tourStyle, resume: false }
          : {
              styleId: tourStyle,
              resume: true,
              folderName: RESUME_FOLDER,
            },
      ),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not open CURSOR pack");
    folderName = String(data.folderName);
    kit = data.kit;
    facesReady = Boolean(data.facesReady);
    const sk = data.sceneKit as {
      arseholeKey?: string;
      castKeys?: string[];
      worldKeys?: string[];
    } | null;
    if (sunny) {
      arseholeKey = String(data.arseholeKey || sk?.arseholeKey || "");
      for (const k of (data.castKeys as string[]) || sk?.castKeys || []) {
        if (k) castKeys.push(String(k));
      }
      for (const k of (data.worldKeys as string[]) || sk?.worldKeys || []) {
        if (k) worldKeys.push(String(k));
      }
      facesReady = Boolean(
        facesReady &&
          arseholeKey &&
          castKeys.length >= 4 &&
          worldKeys.length >= 4,
      );
    } else if (facesReady && sk?.arseholeKey) {
      arseholeKey = String(sk.arseholeKey);
      for (const k of sk.castKeys || []) {
        if (k) castKeys.push(String(k));
      }
      for (const k of sk.worldKeys || []) {
        if (k) worldKeys.push(String(k));
      }
    }
    clearActiveEpisode();
    setActiveEpisodeFromOpen({
      folderName,
      label: folderName,
      styleId: tourStyle,
      story: data.story ?? null,
    });
    if (facesReady) {
      writeSceneKitDraft({
        styleId: tourStyle,
        arseholeKey,
        castKeys: [...castKeys],
        castSlotCount: Math.max(4, castKeys.length),
        worldKeys: [...worldKeys],
        placeSlotCount: Math.max(4, worldKeys.length || 4),
      });
    }
    dispatchStorySaved();
  } catch (e) {
    if (e instanceof CursorTourRejectedError) {
      emitTour({ phase: "idle", index: 0, total, label: "" });
      return;
    }
    emitError(total, folderName, e);
    return;
  }

  try {
    // 1 Character
    if (facesReady && arseholeKey) {
      await stepShow(
        1,
        total,
        `Character — ${kit.arsehole.name} (kept)`,
        folderName,
        "character",
        faceUrl(tourStyle, arseholeKey),
      );
    } else {
      await stepBusy(
        1,
        total,
        `Character — ${kit.arsehole.name}`,
        folderName,
        async () => {
          focusPanel("character");
          const still = await makeStill(tourStyle, "face", kit.arsehole);
          arseholeKey = still.thumbKey;
          writeSceneKitDraft({
            styleId: tourStyle,
            arseholeKey,
            castKeys,
            castSlotCount: 4,
            worldKeys,
            placeSlotCount: 4,
          });
          bumpGalleries();
          dispatchStorySaved();
          return still.url;
        },
      );
    }

    // 2 Voice — lock existing library voice (no design)
    await stepBusy(
      2,
      total,
      `Voice — lock ${kit.arsehole.libraryVoiceName || kit.arsehole.name}`,
      folderName,
      async () => {
        focusPanel("voice");
        await lockExistingVoice(tourStyle, arseholeKey, kit.arsehole);
        dispatchVoiceSaved();
        return undefined;
      },
    );

    // 3 Scene kit
    await stepShow(3, total, "Scene kit", folderName, "sceneKit");

    // 4 Cast
    if (facesReady && castKeys.length >= 4) {
      await stepShow(
        4,
        total,
        "Cast — 4 faces (kept)",
        folderName,
        "character",
        faceUrl(tourStyle, castKeys[0]!),
      );
    } else {
      await stepBusy(4, total, "Cast — 4 faces", folderName, async () => {
        focusPanel("character");
        let lastUrl = "";
        let i = 0;
        for (const plan of kit.cast) {
          i += 1;
          emitTour({
            phase: "running",
            index: 4,
            total,
            label: `Cast — ${plan.name} (${i}/${kit.cast.length})`,
            folderName,
            buildPct: Math.round((i / kit.cast.length) * 90),
            buildCurrent: i,
            buildTotal: kit.cast.length,
          });
          const still = await makeStill(tourStyle, "face", plan);
          castKeys.push(still.thumbKey);
          lastUrl = still.url;
          writeSceneKitDraft({
            styleId: tourStyle,
            arseholeKey,
            castKeys: [...castKeys],
            castSlotCount: Math.max(4, castKeys.length),
            worldKeys,
            placeSlotCount: 4,
          });
          bumpGalleries();
        }
        dispatchStorySaved();
        return lastUrl;
      });
    }

    // 5 Cast voice — existing library only
    await stepBusy(5, total, "Cast voice — 4 existing locks", folderName, async () => {
      focusPanel("voice");
      for (let i = 0; i < kit.cast.length; i++) {
        const plan = kit.cast[i]!;
        const key = castKeys[i]!;
        emitTour({
          phase: "running",
          index: 5,
          total,
          label: `Cast voice — ${plan.name} → ${plan.libraryVoiceName || plan.name}`,
          folderName,
          buildPct: Math.round(((i + 1) / kit.cast.length) * 90),
          buildCurrent: i + 1,
          buildTotal: kit.cast.length,
        });
        await lockExistingVoice(tourStyle, key, plan);
      }
      dispatchVoiceSaved();
      return undefined;
    });

    // 6 Script
    await stepBusy(6, total, "Script — write story", folderName, async () => {
      focusPanel("story");
      await stepApi(tourStyle, "writeStory", {
        folderName,
        worldKeys: [...worldKeys],
      });
      dispatchStorySaved();
      return undefined;
    });

    // 7 Locations
    if (worldKeys.length >= 4) {
      await stepShow(7, total, "Locations — 4 places (kept)", folderName, "sceneKit");
    } else {
      worldKeys.length = 0;
      await stepBusy(7, total, "Locations — 4 places", folderName, async () => {
        focusPanel("sceneKit");
        let lastUrl = "";
        let i = 0;
        for (const plan of kit.places) {
          i += 1;
          emitTour({
            phase: "running",
            index: 7,
            total,
            label: `Locations — ${plan.name} (${i}/${kit.places.length})`,
            folderName,
            buildPct: Math.round((i / kit.places.length) * 90),
            buildCurrent: i,
            buildTotal: kit.places.length,
          });
          const still = await makeStill(tourStyle, "place", plan);
          worldKeys.push(still.thumbKey);
          lastUrl = still.url;
          writeSceneKitDraft({
            styleId: tourStyle,
            arseholeKey,
            castKeys: [...castKeys],
            castSlotCount: Math.max(4, castKeys.length),
            worldKeys: [...worldKeys],
            placeSlotCount: Math.max(4, worldKeys.length),
          });
          bumpGalleries();
        }
        await stepApi(tourStyle, "writeStory", {
          folderName,
          worldKeys: [...worldKeys],
        });
        dispatchStorySaved();
        return lastUrl;
      });
    }

    // 8 Plates + speak
    await stepBusy(8, total, "Plates — shot stills", folderName, async () => {
      focusPanel("sceneKit");
      const data = await stepApi(tourStyle, "genPlates");
      const story = data.story as {
        scenes?: { shots?: { plateFile?: string }[] }[];
      };
      const firstPlate =
        story?.scenes?.[0]?.shots?.[0]?.plateFile ||
        (Array.isArray(data.plates) ? String(data.plates[0] || "") : "");
      emitTour({
        phase: "running",
        index: 8,
        total,
        label: "Plates — speaking dialogue lines…",
        folderName,
        buildPct: 70,
        buildCurrent: 1,
        buildTotal: 1,
      });
      await stepApi(tourStyle, "speakAll");
      dispatchStorySaved();
      writeSceneKitDraft({
        styleId: tourStyle,
        arseholeKey,
        castKeys: [...castKeys],
        castSlotCount: Math.max(4, castKeys.length),
        worldKeys: [...worldKeys],
        placeSlotCount: Math.max(4, worldKeys.length),
        plateFiles: Array.isArray(data.plates) ? (data.plates as string[]) : [],
        plateSlotCount: Math.max(
          1,
          Array.isArray(data.plates) ? data.plates.length : 1,
        ),
      });
      return firstPlate
        ? `/api/crash/gen/file?name=${encodeURIComponent(firstPlate)}&t=${Date.now()}`
        : undefined;
    });

    // 9 Animate — fill only
    await stepBusy(
      9,
      total,
      "Animate — LTX fields ready (no Send)",
      folderName,
      async () => {
        focusPanel("comfy");
        const data = await stepApi(tourStyle, "fillAnimate");
        if (data.draft) {
          writeComfyDraft(
            tourStyle,
            data.draft as {
              global: string;
              beats: Record<
                string,
                { imageMotion: string; segmentText: string }
              >;
            },
          );
        }
        dispatchStorySaved();
        return undefined;
      },
    );

    // 10 SFX
    await stepBusy(10, total, "SFX — generate", folderName, async () => {
      focusPanel("spx");
      await stepApi(tourStyle, "genSfx");
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(CRASH_SPX_SAVED));
      }
      dispatchStorySaved();
      return undefined;
    });

    // 11 Storyboard
    focusPanel("storyboard");
    emitTour({
      phase: "done",
      index: total,
      total,
      label: `Stop — ${folderName}. Storyboard open. You Save. Animate Send later.`,
      folderName,
      buildPct: 100,
      buildCurrent: 1,
      buildTotal: 1,
    });
    await waitProceed();
    emitTour({ phase: "idle", index: 0, total, label: "" });
  } catch (e) {
    if (e instanceof CursorTourRejectedError) {
      emitTour({ phase: "idle", index: 0, total, label: "" });
      return;
    }
    emitError(total, folderName, e);
  }
}

export function tourStepLabels(): string[] {
  return [...STEPS];
}
