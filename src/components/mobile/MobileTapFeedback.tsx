"use client";

import { useEffect } from "react";

/** iOS only paints :active after a touchstart listener exists. */
export function MobileTapFeedback() {
  useEffect(() => {
    const arm = () => {};
    document.addEventListener("touchstart", arm, { passive: true });
    return () => document.removeEventListener("touchstart", arm);
  }, []);
  return null;
}
