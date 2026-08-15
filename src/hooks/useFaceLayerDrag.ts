"use client";

import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";

export type FaceLayerGeom = { x: number; y: number; scale: number };

type DragState = {
  pointerId: number;
  mode: "move" | "scale";
  startX: number;
  startY: number;
  orig: FaceLayerGeom;
};

/**
 * setPointerCapture throws (NotFoundError) for pointer IDs the browser
 * doesn't consider "active" — same gotcha as usePanelPointerDrag, keep the
 * drag armed via window listeners either way instead of losing the gesture.
 */
function capturePointer(el: HTMLElement, pointerId: number): void {
  try {
    el.setPointerCapture?.(pointerId);
  } catch {
    /* ignore — drag still works via the window-level listeners */
  }
}

const MIN_SCALE = 0.3;
const MAX_SCALE = 3;

/**
 * Position + uniform-scale drag for one face image layer in the Compositor.
 * Distinct from usePanelPointerDrag: that hook's {x,y,w,h} panel shape would
 * let width/height diverge and stretch a face — this keeps a single `scale`
 * factor so the layer always resizes proportionally.
 */
export function useFaceLayerDrag({
  geom,
  setGeom,
}: {
  geom: FaceLayerGeom;
  setGeom: (next: FaceLayerGeom) => void;
}) {
  const dragRef = useRef<DragState | null>(null);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const state = dragRef.current;
      if (!state || e.pointerId !== state.pointerId) return;
      const dx = e.clientX - state.startX;
      const dy = e.clientY - state.startY;
      if (state.mode === "move") {
        setGeom({ ...state.orig, x: state.orig.x + dx, y: state.orig.y + dy });
        return;
      }
      // Scale handle sits at the layer's bottom-right corner — dragging it
      // out/in grows/shrinks scale using the diagonal drag distance.
      const delta = (dx + dy) / 2;
      const nextScale = Math.min(
        MAX_SCALE,
        Math.max(MIN_SCALE, state.orig.scale + delta / 100),
      );
      setGeom({ ...state.orig, scale: nextScale });
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
  }, [setGeom]);

  const startMove = useCallback(
    (e: ReactPointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      capturePointer(e.currentTarget as HTMLElement, e.pointerId);
      dragRef.current = {
        pointerId: e.pointerId,
        mode: "move",
        startX: e.clientX,
        startY: e.clientY,
        orig: geom,
      };
    },
    [geom],
  );

  const startScale = useCallback(
    (e: ReactPointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      capturePointer(e.currentTarget as HTMLElement, e.pointerId);
      dragRef.current = {
        pointerId: e.pointerId,
        mode: "scale",
        startX: e.clientX,
        startY: e.clientY,
        orig: geom,
      };
    },
    [geom],
  );

  return { startMove, startScale };
}
