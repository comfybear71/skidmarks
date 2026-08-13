"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  CRASH_DESK_MODE_EVENT,
  CRASH_DESK_TOP_EVENT,
  CRASH_FREE_FLOAT_EVENT,
  CRASH_PANEL_SHUT_EVENT,
  CRASH_STACK_FOCUS_EVENT,
  clampPanelGeom,
  deskTopY,
  isPanelShut,
  readCrashDeskMode,
  readFreeFloatPanels,
  readStackFocusPanel,
  crashPanelSsrGeom,
  snapPanelGeom,
  toggleFreeFloatPanel,
  writeFreePanelGeom,
  writePanelShut,
  writeStackFocusPanel,
  type CrashDeskMode,
  type CrashPanelId,
} from "@/lib/crashDeskLayout";

type CardGeom = { x: number; y: number; w: number; h: number };

type DeskSnap = {
  mode: CrashDeskMode;
  panelShut: boolean;
  stackFocus: CrashPanelId | null;
  freeFloat: CrashPanelId[];
  geom: CardGeom;
  collapsed: boolean;
};

/** Same HTML on server + first client paint — no window / localStorage. */
function ssrSnap(panelId: CrashPanelId): DeskSnap {
  return {
    mode: "stack",
    panelShut: false,
    stackFocus: null,
    freeFloat: [],
    geom: crashPanelSsrGeom(panelId),
    collapsed: true,
  };
}

function readSnap(panelId: CrashPanelId): DeskSnap {
  const mode = readCrashDeskMode();
  const panelShut = mode === "grid" && isPanelShut(panelId);
  const stackFocus = mode === "stack" ? readStackFocusPanel() : null;
  const freeFloat = mode === "free" ? readFreeFloatPanels() : [];
  const collapsed =
    mode === "stack"
      ? stackFocus !== panelId
      : mode === "free"
        ? !freeFloat.includes(panelId)
        : panelShut;
  deskTopY();
  const geom = snapPanelGeom(panelId, mode, panelShut, stackFocus, freeFloat);
  return { mode, panelShut, stackFocus, freeFloat, geom, collapsed };
}

function deskEpoch(): string {
  try {
    return [
      localStorage.getItem("crashlab-desk-mode"),
      localStorage.getItem("crashlab-stack-focus"),
      localStorage.getItem("crashlab-panel-shut"),
      localStorage.getItem("crashlab-free-float"),
      String(Math.round(deskTopY())),
      String(window.innerWidth),
    ].join("|");
  } catch {
    return "x";
  }
}

const listeners = new Set<() => void>();
let subscribed = false;

function emit() {
  listeners.forEach((l) => l());
}

function ensureBus() {
  if (typeof window === "undefined" || subscribed) return;
  subscribed = true;
  const bump = () => emit();
  window.addEventListener(CRASH_DESK_MODE_EVENT, bump);
  window.addEventListener(CRASH_DESK_TOP_EVENT, bump);
  window.addEventListener(CRASH_PANEL_SHUT_EVENT, bump);
  window.addEventListener(CRASH_STACK_FOCUS_EVENT, bump);
  window.addEventListener(CRASH_FREE_FLOAT_EVENT, bump);
  window.addEventListener("resize", bump);
  window.setInterval(bump, 500);
}

function subscribeDesk(cb: () => void) {
  ensureBus();
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** Stack · grid · free-flow — live layout only after mount (avoids hydration mismatch). */
export function useCrashDeskMode(panelId: CrashPanelId) {
  const [live, setLive] = useState(false);
  useEffect(() => {
    setLive(true);
  }, []);

  const epoch = useSyncExternalStore(
    subscribeDesk,
    () => (live ? deskEpoch() : "ssr"),
    () => "ssr",
  );
  const snap = live && epoch !== "ssr" ? readSnap(panelId) : ssrSnap(panelId);

  const modeRef = useRef(snap.mode);
  const freeFloatRef = useRef(snap.freeFloat);
  modeRef.current = snap.mode;
  freeFloatRef.current = snap.freeFloat;

  const [dragGeom, setDragGeom] = useState<CardGeom | null>(null);

  useEffect(() => {
    setDragGeom(null);
  }, [snap.mode, epoch]);

  const setGeom = useCallback(
    (next: CardGeom | ((prev: CardGeom) => CardGeom)) => {
      setDragGeom((prev) => {
        const base = prev ?? readSnap(panelId).geom;
        const raw = typeof next === "function" ? next(base) : next;
        const clamped = clampPanelGeom(raw);
        if (
          modeRef.current === "free" &&
          freeFloatRef.current.includes(panelId)
        ) {
          writeFreePanelGeom(panelId, clamped);
        }
        return clamped;
      });
    },
    [panelId],
  );

  const togglePanel = useCallback(() => {
    const { mode, stackFocus, panelShut } = readSnap(panelId);
    if (mode === "free") {
      toggleFreeFloatPanel(panelId);
      emit();
      return;
    }
    if (mode === "stack") {
      // − on open panel → all strips. + on strip → open that panel.
      if (stackFocus === panelId) {
        writeStackFocusPanel(null);
      } else {
        writeStackFocusPanel(panelId);
      }
      emit();
      return;
    }
    writePanelShut(panelId, !panelShut);
    emit();
  }, [panelId]);

  const geom = dragGeom ?? snap.geom;

  return {
    mode: snap.mode,
    geom,
    deskReady: true,
    collapsed: snap.collapsed,
    panelShut: snap.panelShut,
    stackFocus: snap.stackFocus,
    freeFloat: snap.freeFloat,
    togglePanel,
    toggleDesk: togglePanel,
    setGeom,
  };
}
