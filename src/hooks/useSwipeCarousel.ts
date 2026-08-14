"use client";

import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

/**
 * setPointerCapture throws for pointer IDs the browser doesn't consider
 * "active" — same gotcha as the desktop panel drag hooks, keep the swipe
 * armed via window listeners either way instead of losing the gesture.
 */
function capturePointer(el: HTMLElement, pointerId: number): void {
  try {
    el.setPointerCapture?.(pointerId);
  } catch {
    /* ignore */
  }
}

const SWIPE_THRESHOLD = 60;

/**
 * Horizontal swipe-to-advance for a fixed-count carousel (cast/location
 * candidate cards, screenplay scene cards). No existing swipe/carousel
 * primitive in this codebase — built fresh, reusing the Pointer Events +
 * setPointerCapture-try/catch pattern already established for desktop
 * panel drag.
 */
export function useSwipeCarousel(itemCount: number) {
  const [index, setIndexState] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const dragRef = useRef<{ pointerId: number; startX: number } | null>(null);

  const clampIndex = useCallback(
    (i: number) => Math.max(0, Math.min(itemCount - 1, i)),
    [itemCount],
  );

  const setIndex = useCallback(
    (i: number) => setIndexState(clampIndex(i)),
    [clampIndex],
  );

  const onPointerDown = useCallback((e: ReactPointerEvent) => {
    capturePointer(e.currentTarget as HTMLElement, e.pointerId);
    dragRef.current = { pointerId: e.pointerId, startX: e.clientX };
  }, []);

  const onPointerMove = useCallback((e: ReactPointerEvent) => {
    const state = dragRef.current;
    if (!state || e.pointerId !== state.pointerId) return;
    setDragOffset(e.clientX - state.startX);
  }, []);

  const endDrag = useCallback(
    (e: ReactPointerEvent) => {
      const state = dragRef.current;
      if (!state || e.pointerId !== state.pointerId) return;
      const dx = e.clientX - state.startX;
      dragRef.current = null;
      setDragOffset(0);
      if (Math.abs(dx) > SWIPE_THRESHOLD) {
        setIndexState((prev) => clampIndex(prev + (dx < 0 ? 1 : -1)));
      }
    },
    [clampIndex],
  );

  return {
    index,
    setIndex,
    dragOffset,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
    },
  };
}
