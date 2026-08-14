"use client";

import { useCallback, useEffect, useLayoutEffect, useState, useSyncExternalStore } from "react";
import {
  CRASH_DESK_MODE_EVENT,
  ensureDeskTopObserver,
  enterFreeFlowMode,
  openCrashDeskGrid,
  refreshDeskTop,
  readCrashDeskMode,
  resetCrashDeskLayout,
  writeCrashDeskMode,
  px,
  type CrashDeskMode,
} from "@/lib/crashDeskLayout";
import {
  CRASH_SHOW_STYLE_CLEAR_EVENT,
  CRASH_SHOW_STYLE_EVENT,
  CRASH_STORY_SAVED,
  dispatchStorySaved,
  parseStyleEventDetail,
} from "@/lib/crashStyleSync";
import {
  clearCursorSmokeSession,
  dispatchCursorSmokeStop,
  armCursorImageGate,
} from "@/lib/crashCursorSmoke";
import {
  clearSceneKitDraft,
  CRASH_SCENE_KIT_EVENT,
} from "@/lib/crashSceneKitFields";
import { clearScriptDeskCastKeys } from "@/lib/crashScriptFields";
import { dispatchCursorReject, runCursorTour } from "@/lib/crashCursorTour";
import { CURSOR_STYLE_OPTIONS } from "@/lib/cursorPopulateTypes";
import { PromptScriptModal } from "@/components/PromptScriptModal";
import { CrashEpisodeModal } from "@/components/CrashEpisodeModal";
import { readComfyDraft } from "@/lib/crashComfyStack";
import {
  clearActiveEpisode,
  CRASH_ACTIVE_EPISODE_EVENT,
  fetchStudioFingerprint,
  getActiveEpisodeSnapshot,
  markActiveEpisodeClean,
  readActiveEpisode,
  setActiveEpisodeFromOpen,
  subscribeActiveEpisode,
  writeActiveEpisode,
  type CrashActiveEpisode,
} from "@/lib/crashActiveEpisode";
import { switchCrashLabShow } from "@/lib/crashShowSwitch";
import {
  loadShowStyleIdOptional,
  saveShowStyleId,
  type ShowStyleId,
} from "@/lib/showStylePresets";

function getToolbarStyleSnapshot(): ShowStyleId {
  if (typeof window === "undefined") return "skidmarks";
  return (loadShowStyleIdOptional() ||
    getActiveEpisodeSnapshot()?.styleId ||
    "skidmarks") as ShowStyleId;
}

function subscribeToolbarStyle(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(CRASH_SHOW_STYLE_EVENT, cb);
  window.addEventListener(CRASH_SHOW_STYLE_CLEAR_EVENT, cb);
  window.addEventListener(CRASH_ACTIVE_EPISODE_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(CRASH_SHOW_STYLE_EVENT, cb);
    window.removeEventListener(CRASH_SHOW_STYLE_CLEAR_EVENT, cb);
    window.removeEventListener(CRASH_ACTIVE_EPISODE_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** Fixed bar under site header — Stack / Open workspace / Free flow / Reset. */
export function CrashDeskToolbar() {
  const storedEpisode = useSyncExternalStore(
    subscribeActiveEpisode,
    getActiveEpisodeSnapshot,
    () => null,
  );
  const storedStyle = useSyncExternalStore(
    subscribeToolbarStyle,
    getToolbarStyleSnapshot,
    () => "skidmarks" as ShowStyleId,
  );
  const [top, setTop] = useState(72);
  const [mode, setMode] = useState<CrashDeskMode>(() =>
    typeof window !== "undefined" ? readCrashDeskMode() : "stack",
  );
  const [tourBusy, setTourBusy] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const [promptFront, setPromptFront] = useState(0);
  const [episodeMode, setEpisodeMode] = useState<"open" | null>(null);
  const [newEpisodeBusy, setNewEpisodeBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [activeEpisode, setActiveEpisode] = useState<CrashActiveEpisode | null>(
    null,
  );
  const [dirty, setDirty] = useState(false);
  /** SSR-safe default — store snapshot applies the real show on first client paint. */
  const [cursorStyle, setCursorStyle] = useState<ShowStyleId>("skidmarks");
  const liveEpisode = storedEpisode ?? activeEpisode;
  const liveStyle = storedStyle || cursorStyle;

  const measureHeader = useCallback(() => {
    const header = document.querySelector("header");
    if (!header) return;
    setTop(Math.ceil(header.getBoundingClientRect().bottom));
  }, []);

  const refreshDirty = useCallback(async () => {
    const active = readActiveEpisode();
    setActiveEpisode(active);
    if (!active) {
      setDirty(false);
      return;
    }
    try {
      const styleId = active.styleId || cursorStyle;
      const fp = await fetchStudioFingerprint(styleId);
      setDirty(!active.cleanFingerprint || fp !== active.cleanFingerprint);
    } catch {
      setDirty(true);
    }
  }, [cursorStyle]);

  useLayoutEffect(() => {
    measureHeader();
    const ep = readActiveEpisode();
    const style = ep?.styleId || loadShowStyleIdOptional();
    if (style) setCursorStyle(style);
    if (ep) setActiveEpisode(ep);
  }, [measureHeader]);

  useEffect(() => {
    ensureDeskTopObserver();
    setMode(readCrashDeskMode());
    void refreshDirty();

    const onMode = (e: Event) => {
      const next = (e as CustomEvent<CrashDeskMode>).detail;
      if (next === "grid" || next === "stack" || next === "free") setMode(next);
    };
    window.addEventListener(CRASH_DESK_MODE_EVENT, onMode);
    return () => window.removeEventListener(CRASH_DESK_MODE_EVENT, onMode);
  }, [refreshDirty]);

  /** Keep toolbar show dropdown in sync with Script desk Style cards. */
  useEffect(() => {
    const onStyle = (e: Event) => {
      const id = parseStyleEventDetail((e as CustomEvent).detail);
      if (id) setCursorStyle(id);
    };
    const onClear = () => {
      setCursorStyle(loadShowStyleIdOptional() ?? "skidmarks");
    };
    window.addEventListener(CRASH_SHOW_STYLE_EVENT, onStyle);
    window.addEventListener(CRASH_SHOW_STYLE_CLEAR_EVENT, onClear);
    return () => {
      window.removeEventListener(CRASH_SHOW_STYLE_EVENT, onStyle);
      window.removeEventListener(CRASH_SHOW_STYLE_CLEAR_EVENT, onClear);
    };
  }, []);

  useEffect(() => {
    const bump = (e: Event) => {
      const detail = (e as CustomEvent<CrashActiveEpisode | null>).detail;
      if (detail && detail.folderName) {
        setActiveEpisode(detail);
        if (detail.styleId) setCursorStyle(detail.styleId);
      }
      void refreshDirty();
    };
    window.addEventListener(CRASH_ACTIVE_EPISODE_EVENT, bump);
    window.addEventListener(CRASH_STORY_SAVED, bump);
    window.addEventListener(CRASH_SCENE_KIT_EVENT, bump);
    return () => {
      window.removeEventListener(CRASH_ACTIVE_EPISODE_EVENT, bump);
      window.removeEventListener(CRASH_STORY_SAVED, bump);
      window.removeEventListener(CRASH_SCENE_KIT_EVENT, bump);
    };
  }, [refreshDirty]);

  useEffect(() => {
    refreshDeskTop();
  }, [top]);

  function setDesk(next: CrashDeskMode) {
    if (next === "grid") openCrashDeskGrid();
    else if (next === "free") enterFreeFlowMode();
    else writeCrashDeskMode("stack");
    setMode(next);
  }

  async function onCursorTour() {
    if (tourBusy) return;
    setTourBusy(true);
    try {
      await runCursorTour(liveStyle);
    } finally {
      setTourBusy(false);
    }
  }

  async function onNewEpisode() {
    if (tourBusy || newEpisodeBusy || liveEpisode) return;
    const folderName = window
      .prompt(
        `New episode folder name under _CRASH_LAB?\n\nClears Animate cut + Scene kit.\nDialogue mp3s park in _cleared/ — nothing deleted.`,
        "EP04_",
      )
      ?.trim();
    if (!folderName) return;
    setNewEpisodeBusy(true);
    try {
      const res = await fetch("/api/crash/story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clear: true, styleId: liveStyle }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "New episode failed");

      await clearSceneKitDraft(liveStyle);
      clearScriptDeskCastKeys();
      armCursorImageGate(false);
      clearCursorSmokeSession();
      dispatchCursorSmokeStop();
      dispatchStorySaved();

      setActiveEpisodeFromOpen({
        folderName,
        label: folderName,
        styleId: liveStyle,
        story: data.story ?? null,
      });
      // Force dirty so first Save is clickable
      const cur = readActiveEpisode();
      if (cur) {
        const fp = await fetchStudioFingerprint(liveStyle);
        writeActiveEpisode({
          ...cur,
          cleanFingerprint: `new:${fp}`,
        });
      }
      await refreshDirty();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "New episode failed");
    } finally {
      setNewEpisodeBusy(false);
    }
  }

  async function onSaveEpisode() {
    if (!liveEpisode || !dirty || saveBusy || tourBusy) return;
    setSaveBusy(true);
    try {
      const styleId = liveEpisode.styleId || liveStyle;
      const res = await fetch("/api/crash/episodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          styleId,
          label: liveEpisode.label || liveEpisode.folderName,
          folderName: liveEpisode.folderName,
          asNewVersion: false,
          comfyDraft: readComfyDraft(styleId),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      await markActiveEpisodeClean(styleId);
      setDirty(false);
      void refreshDirty();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaveBusy(false);
    }
  }

  async function onCloseEpisode() {
    if (saveBusy) return;
    const styleId = liveEpisode?.styleId || liveStyle;
    const ok = window.confirm(
      "Close this episode and clear the desk for the next one?\n\nYour pack folder stays as last saved. Nothing deleted.",
    );
    if (!ok) return;
    // Kill stuck CURSOR/PROMPT wait so Close isn't blocked forever.
    if (tourBusy) {
      dispatchCursorReject();
      setTourBusy(false);
    }
    setNewEpisodeBusy(true);
    try {
      const res = await fetch("/api/crash/story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clear: true, styleId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Close clear failed");

      await clearSceneKitDraft(styleId);
      clearScriptDeskCastKeys();
      clearActiveEpisode();
      setActiveEpisode(null);
      setDirty(false);
      armCursorImageGate(false);
      clearCursorSmokeSession();
      dispatchCursorSmokeStop();
      writeCrashDeskMode("stack");
      setMode("stack");
      dispatchStorySaved();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Close failed");
    } finally {
      setNewEpisodeBusy(false);
    }
  }

  const episodeOpen = Boolean(liveEpisode);

  return (
    <>
    <div
      id="crash-desk-toolbar"
      className="pointer-events-none fixed left-0 right-0 z-[5000] h-fit"
      style={{ top: px(top), bottom: "auto", height: "auto" }}
    >
      <div
        className="pointer-events-auto flex flex-wrap items-center gap-2 border-b border-[var(--line)] bg-[var(--panel)]/95 px-4 py-1.5 backdrop-blur"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <span className="mr-1 text-[9px] uppercase tracking-[0.2em] text-[var(--acid-deep)]">
          Layout
        </span>
        <button
          type="button"
          className={`touch-manipulation rounded-sm border px-2.5 py-2 text-[10px] uppercase tracking-wide ${
            mode === "stack"
              ? "border-[var(--acid)] bg-[var(--acid)]/15 text-[var(--acid)]"
              : "border-[var(--line)] text-[var(--chrome-dim)] hover:border-[var(--acid)] hover:text-[var(--acid)]"
          }`}
          onClick={() => setDesk("stack")}
        >
          Stack
        </button>
        <button
          type="button"
          className={`touch-manipulation rounded-sm border px-2.5 py-2 text-[10px] uppercase tracking-wide ${
            mode === "grid"
              ? "border-[var(--magenta-hot)] bg-[var(--magenta)]/15 text-[var(--magenta-hot)]"
              : "border-[var(--line)] text-[var(--chrome-dim)] hover:border-[var(--magenta-hot)] hover:text-[var(--magenta-hot)]"
          }`}
          onClick={() => setDesk("grid")}
        >
          Open workspace
        </button>
        <button
          type="button"
          className={`touch-manipulation rounded-sm border px-2.5 py-2 text-[10px] uppercase tracking-wide ${
            mode === "free"
              ? "border-[var(--chrome)] bg-[var(--chrome)]/15 text-[var(--chrome)]"
              : "border-[var(--line)] text-[var(--chrome-dim)] hover:border-[var(--chrome)] hover:text-[var(--chrome)]"
          }`}
          onClick={() => setDesk("free")}
        >
          Free flow
        </button>
        <button
          type="button"
          className="rounded-sm border border-[var(--line)] px-2.5 py-1 text-[10px] uppercase tracking-wide text-[var(--chrome-dim)] hover:border-[var(--chrome)] hover:text-[var(--chrome)]"
          onClick={() => resetCrashDeskLayout()}
        >
          Reset layout
        </button>
        <select
          value={liveStyle}
          disabled={tourBusy}
          onChange={(e) => {
            const id = e.target.value as ShowStyleId;
            setCursorStyle(id);
            switchCrashLabShow(id);
          }}
          className="touch-manipulation rounded-sm border border-[var(--line)] bg-[var(--void)]/40 px-1.5 py-2 text-[10px] text-[var(--chrome)]"
          title="Show for CURSOR / PROMPT build"
        >
          {CURSOR_STYLE_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={tourBusy}
          className="rounded-sm border border-[var(--magenta-hot)] bg-[var(--magenta-hot)]/15 px-2.5 py-1 text-[10px] uppercase tracking-wide text-[var(--magenta-hot)] hover:bg-[var(--magenta-hot)]/25 disabled:opacity-40"
          onClick={() => void onCursorTour()}
          title="New CURSOR_ pack → Character → Cast → Places… You only click Proceed"
        >
          {tourBusy ? "Cursor…" : "Cursor"}
        </button>
        <button
          type="button"
          disabled={tourBusy}
          className="rounded-sm border border-[var(--acid)] bg-[var(--acid)]/15 px-2.5 py-1 text-[10px] uppercase tracking-wide text-[var(--acid)] hover:bg-[var(--acid)]/25 disabled:opacity-40"
          onClick={() => {
            setPromptOpen(true);
            setPromptFront((n) => n + 1);
          }}
          title="Paste full script → next numbered episode folder"
        >
          Prompt
        </button>

        {!episodeOpen ? (
          <>
            <button
              type="button"
              disabled={tourBusy || newEpisodeBusy}
              className="rounded-sm border border-[var(--magenta-hot)]/70 px-2.5 py-1 text-[10px] uppercase tracking-wide text-[var(--magenta-hot)] hover:bg-[var(--magenta-hot)]/10 disabled:opacity-40"
              onClick={() => void onNewEpisode()}
              title="Blank story for a new gag — dialogue parked in _cleared/, plates stay"
            >
              {newEpisodeBusy ? "New…" : "New episode"}
            </button>
            <button
              type="button"
              disabled={tourBusy}
              className="rounded-sm border border-[var(--magenta-hot)]/60 px-2.5 py-1 text-[10px] uppercase tracking-wide text-[var(--magenta-hot)] hover:bg-[var(--magenta-hot)]/10 disabled:opacity-40"
              onClick={() => setEpisodeMode("open")}
              title="Open a _CRASH_LAB episode — fills Scene kit, Animate cut, Storyboard"
            >
              Open episode
            </button>
          </>
        ) : (
          <>
            <span
              className="max-w-[14rem] truncate rounded-sm border border-[var(--acid)]/50 bg-[var(--acid)]/10 px-2.5 py-2 text-[10px] font-medium tracking-wide text-[var(--acid)]"
              title={liveEpisode?.folderName}
            >
              {liveEpisode?.folderName}
            </span>
            <button
              type="button"
              disabled={tourBusy || saveBusy || !dirty}
              className="rounded-sm border border-[var(--chrome)]/50 px-2.5 py-1 text-[10px] uppercase tracking-wide text-[var(--chrome)] hover:border-[var(--chrome)] hover:bg-[var(--chrome)]/10 disabled:opacity-40"
              onClick={() => void onSaveEpisode()}
              title={
                dirty
                  ? `Save into _CRASH_LAB\\${liveEpisode?.folderName}`
                  : "Nothing changed since last open/save"
              }
            >
              {saveBusy ? "Saving…" : "Save episode"}
            </button>
            <button
              type="button"
              disabled={saveBusy}
              className="rounded-sm border border-[var(--line)] px-2.5 py-1 text-[10px] uppercase tracking-wide text-[var(--chrome-dim)] hover:border-[var(--fail)] hover:text-[var(--fail)] disabled:opacity-40"
              onClick={() => void onCloseEpisode()}
              title="Close this pack — New / Open come back"
            >
              Close
            </button>
          </>
        )}

      </div>
    </div>
        {promptOpen ? (
          <PromptScriptModal
            styleId={liveStyle}
            busy={tourBusy}
            onBusyChange={setTourBusy}
            onClose={() => setPromptOpen(false)}
            frontKey={promptFront}
          />
        ) : null}
        {episodeMode ? (
          <CrashEpisodeModal
            styleId={liveStyle}
            mode={episodeMode}
            onClose={() => setEpisodeMode(null)}
          />
        ) : null}
    </>
  );
}
