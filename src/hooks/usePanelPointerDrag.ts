"use client";

import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";

export type PanelGeom = { x: number; y: number; w: number; h: number };

type DragState = {
  pointerId: number;
  mode: "move" | "resize";
  edge?: string;
  startX: number;
  startY: number;
  orig: PanelGeom;
};

/**
 * setPointerCapture throws if the browser doesn't consider this pointerId
 * "active" (spec: NotFoundError) — keep dragging armed either way instead
 * of letting a capture failure silently swallow the whole gesture.
 */
function capturePointer(el: HTMLElement, pointerId: number): void {
  try {
    el.setPointerCapture?.(pointerId);
  } catch {
    /* ignore — drag still works via the window-level listeners */
  }
}

/**
 * Shared move/resize wiring for Crash Lab's floating panels — one Pointer
 * Events implementation instead of five copy-pasted mouse-only ones.
 * Pointer Events unify mouse/touch/pen, so this is the single place that
 * makes panel drag/resize work with a finger, not just a cursor.
 */
const DEFAULT_IGNORE_SELECTOR = "button, select, textarea, input, a";

export function usePanelPointerDrag({
  geom,
  setGeom,
  minW,
  minH,
  bringFront,
  ignoreSelector = DEFAULT_IGNORE_SELECTOR,
}: {
  geom: PanelGeom;
  setGeom: (next: PanelGeom) => void;
  minW: number;
  minH: number;
  bringFront: () => void;
  /** Title-bar mousedown targets that should NOT start a move (e.g. controls, dropzones). */
  ignoreSelector?: string;
}) {
  const dragRef = useRef<DragState | null>(null);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const state = dragRef.current;
      if (!state || e.pointerId !== state.pointerId) return;
      const { mode, edge, startX, startY, orig } = state;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (mode === "move") {
        setGeom({
          ...orig,
          x: Math.max(0, orig.x + dx),
          y: Math.max(0, orig.y + dy),
        });
        return;
      }
      let { x, y, w, h } = orig;
      if (edge?.includes("e")) w = Math.max(minW, orig.w + dx);
      if (edge?.includes("s")) h = Math.max(minH, orig.h + dy);
      if (edge?.includes("w")) {
        w = Math.max(minW, orig.w - dx);
        x = orig.x + (orig.w - w);
      }
      if (edge?.includes("n")) {
        h = Math.max(minH, orig.h - dy);
        y = orig.y + (orig.h - h);
      }
      setGeom({ x: Math.max(0, x), y: Math.max(0, y), w, h });
    };
    const onUp = (e: PointerEvent) => {
      if (dragRef.current?.pointerId !== e.pointerId) return;
      dragRef.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [minH, minW, setGeom]);

  const startMove = useCallback(
    (e: ReactPointerEvent) => {
      if ((e.target as HTMLElement).closest(ignoreSelector)) return;
      bringFront();
      e.preventDefault();
      capturePointer(e.currentTarget as HTMLElement, e.pointerId);
      dragRef.current = {
        pointerId: e.pointerId,
        mode: "move",
        startX: e.clientX,
        startY: e.clientY,
        orig: geom,
      };
    },
    [geom, bringFront, ignoreSelector],
  );

  const startResize = useCallback(
    (edge: string) => (e: ReactPointerEvent) => {
      bringFront();
      e.preventDefault();
      e.stopPropagation();
      capturePointer(e.currentTarget as HTMLElement, e.pointerId);
      dragRef.current = {
        pointerId: e.pointerId,
        mode: "resize",
        edge,
        startX: e.clientX,
        startY: e.clientY,
        orig: geom,
      };
    },
    [geom, bringFront],
  );

  return { startMove, startResize };
}
