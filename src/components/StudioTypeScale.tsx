"use client";

import { useEffect } from "react";

/**
 * Clears the html zoom that broke Crash Lab panels (off-screen / blank).
 * Type scaling paused until a safe approach — do not set zoom here.
 */
export function StudioTypeScale() {
  useEffect(() => {
    try {
      document.documentElement.style.zoom = "";
      localStorage.removeItem("studio-type-scale-v1");
    } catch {
      /* ignore */
    }
  }, []);

  return null;
}
