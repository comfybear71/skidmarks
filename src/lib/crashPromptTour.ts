import {
  clearAllPanelShut,
  CRASH_STACK_FALLBACK,
  readCrashDeskMode,
  writeCrashDeskMode,
  writeStackFocusPanel,
} from "./crashDeskLayout";
import type { CrashPanelId } from "./crashDeskLayout";
import {
  setActiveEpisodeFromOpen,
  clearActiveEpisode,
} from "./crashActiveEpisode";
import { writeSceneKitDraft } from "./crashSceneKitFields";
import {
  dispatchShowStylePick,
  dispatchStorySaved,
  dispatchVoiceSaved,
  CRASH_SPX_SAVED,
  CRASH_STYLE_THUMB_SAVED,
  CRASH_WORLD_THUMB_SAVED,
} from "./crashStyleSync";
import { writeComfyDraft } from "./crashComfyStack";
import { saveShowStyleId, type ShowStyleId } from "./showStylePresets";
import {
  CRASH_CURSOR_TOUR_EVENT,
  CRASH_CURSOR_PROCEED_EVENT,
  CRASH_CURSOR_REJECT_EVENT,
  CursorTourRejectedError,
  type CursorTourDetail,
} from "./crashCursorTour";
import type { PromptTourPerson } from "./cursorPromptBuild";

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

function emitTour(detail: CursorTourDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CRASH_CURSOR_TOUR_EVENT, { detail }));
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

function emitError(total: number, folderName: string, err: unknown): void {
  emitTour({
    phase: "error",
    index: 0,
    total,
    label: err instanceof Error ? err.message : "PROMPT stopped",
    folderName,
    buildPct: 0,
  });
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

async function stepBusy(
  index: number,
  total: number,
  label: string,
  folderName: string,
  work: () => Promise<string | undefined>,
): Promise<void> {
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

/**
 * PROMPT Go — same Proceed walk as Cursor.
 * Uses gallery faces/places from the pasted script. No new face gens.
 * Animate fill only — no Comfy Send.
 */
export async function runPromptBuild(
  styleId: ShowStyleId,
  script: string,
): Promise<void> {
  const total = STEPS.length;
  clearAllPanelShut();
  writeCrashDeskMode("stack");
  writeStackFocusPanel(CRASH_STACK_FALLBACK);
  saveShowStyleId(styleId);
  dispatchShowStylePick(styleId);

  emitTour({
    phase: "running",
    index: 0,
    total,
    label: "Reading script…",
    buildPct: 15,
    buildCurrent: 0,
    buildTotal: 1,
  });

  let folderName = "";
  let kit: {
    arsehole: PromptTourPerson;
    cast: PromptTourPerson[];
    places: PromptTourPerson[];
  };

  try {
    const res = await fetch("/api/crash/cursor/prompt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ styleId, script }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Prompt parse failed");
    folderName = String(data.folderName || data.nextFolderName || "");
    kit = data.kit;
    if (!kit?.arsehole?.thumbKey) {
      throw new Error("Script parsed but no gallery faces came back");
    }
    clearActiveEpisode();
    setActiveEpisodeFromOpen({
      folderName,
      label: String(data.campaignLabel || folderName),
      styleId,
      story: data.story ?? null,
    });
    writeSceneKitDraft({
      styleId,
      arseholeKey: kit.arsehole.thumbKey,
      castKeys: kit.cast.map((c) => c.thumbKey),
      castSlotCount: Math.max(4, kit.cast.length),
      worldKeys: kit.places.map((p) => p.thumbKey),
      placeSlotCount: Math.max(4, kit.places.length),
    });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(CRASH_STYLE_THUMB_SAVED));
      window.dispatchEvent(new CustomEvent(CRASH_WORLD_THUMB_SAVED));
    }
    dispatchStorySaved();
  } catch (e) {
    emitError(total, folderName, e);
    throw e instanceof Error ? e : new Error("PROMPT start failed");
  }

  const arseholeKey = kit.arsehole.thumbKey;
  const castKeys = kit.cast.map((c) => c.thumbKey);
  const worldKeys = kit.places.map((p) => p.thumbKey);

  try {
    await stepShow(
      1,
      total,
      `Character — ${kit.arsehole.name}`,
      folderName,
      "character",
      kit.arsehole.url,
    );

    await stepBusy(
      2,
      total,
      `Voice — lock ${kit.arsehole.name}`,
      folderName,
      async () => {
        focusPanel("voice");
        await stepApi(styleId, "lockVoice", {
          castKey: arseholeKey,
          castName: kit.arsehole.name,
          libraryVoiceName: kit.arsehole.name,
        });
        dispatchVoiceSaved();
        return undefined;
      },
    );

    await stepShow(3, total, "Scene kit", folderName, "sceneKit");

    await stepShow(
      4,
      total,
      kit.cast.length
        ? `Cast — ${kit.cast.map((c) => c.name).join(", ")}`
        : "Cast — gallery",
      folderName,
      "character",
      kit.cast[0]?.url,
    );

    await stepBusy(
      5,
      total,
      "Cast voice — existing locks",
      folderName,
      async () => {
        focusPanel("voice");
        for (let i = 0; i < kit.cast.length; i++) {
          const plan = kit.cast[i]!;
          emitTour({
            phase: "running",
            index: 5,
            total,
            label: `Cast voice — ${plan.name}`,
            folderName,
            buildPct: Math.round(((i + 1) / Math.max(1, kit.cast.length)) * 90),
            buildCurrent: i + 1,
            buildTotal: kit.cast.length,
          });
          await stepApi(styleId, "lockVoice", {
            castKey: plan.thumbKey,
            castName: plan.name,
            libraryVoiceName: plan.name,
          });
        }
        dispatchVoiceSaved();
        return undefined;
      },
    );

    await stepShow(6, total, "Script — pasted story", folderName, "story");

    await stepShow(
      7,
      total,
      `Locations — ${kit.places.map((p) => p.name).join(", ") || "places"}`,
      folderName,
      "sceneKit",
      kit.places[0]?.url,
    );

    await stepBusy(8, total, "Plates — shot stills", folderName, async () => {
      focusPanel("sceneKit");
      const data = await stepApi(styleId, "genPlates");
      emitTour({
        phase: "running",
        index: 8,
        total,
        label: "Plates — speaking dialogue…",
        folderName,
        buildPct: 70,
        buildCurrent: 1,
        buildTotal: 1,
      });
      await stepApi(styleId, "speakAll");
      dispatchStorySaved();
      const plates = Array.isArray(data.plates) ? (data.plates as string[]) : [];
      writeSceneKitDraft({
        styleId,
        arseholeKey,
        castKeys,
        castSlotCount: Math.max(4, castKeys.length),
        worldKeys,
        placeSlotCount: Math.max(4, worldKeys.length),
        plateFiles: plates,
        plateSlotCount: Math.max(1, plates.length),
      });
      const first = plates[0] || "";
      return first
        ? `/api/crash/gen/file?name=${encodeURIComponent(first)}&t=${Date.now()}`
        : undefined;
    });

    await stepBusy(
      9,
      total,
      "Animate — LTX fields ready (no Send)",
      folderName,
      async () => {
        focusPanel("comfy");
        const data = await stepApi(styleId, "fillAnimate");
        if (data.draft) {
          writeComfyDraft(
            styleId,
            data.draft as {
              global: string;
              beats: Record<string, { imageMotion: string; segmentText: string }>;
            },
          );
        }
        dispatchStorySaved();
        return undefined;
      },
    );

    await stepBusy(10, total, "SFX — generate", folderName, async () => {
      focusPanel("spx");
      await stepApi(styleId, "genSfx");
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(CRASH_SPX_SAVED));
      }
      dispatchStorySaved();
      return undefined;
    });

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
    throw e instanceof Error ? e : new Error("PROMPT stopped");
  }
}
