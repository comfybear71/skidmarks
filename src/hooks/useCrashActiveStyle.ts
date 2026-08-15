"use client";

import { useEffect, useState } from "react";
import {
  CRASH_SHOW_STYLE_CLEAR_EVENT,
  CRASH_SHOW_STYLE_EVENT,
  parseStyleEventDetail,
} from "@/lib/crashStyleSync";
import { loadShowStyleIdOptional, type ShowStyleId } from "@/lib/showStylePresets";

/**
 * The show currently picked in the desk toolbar — same source every other
 * Crash Lab panel reads (CrashScriptCard, CrashCharacterPanel, etc).
 * Script upload / roster / storyboard used a separate `useActiveShow()`
 * (free-text, own localStorage key) that never agreed with the toolbar,
 * so "sunny_banks" packs were created as "sunny-banks" and failed to save.
 */
export function useCrashActiveStyle(): ShowStyleId {
  const [styleId, setStyleId] = useState<ShowStyleId>("skidmarks");

  useEffect(() => {
    const loaded = loadShowStyleIdOptional();
    if (loaded) setStyleId(loaded);

    const onStyle = (e: Event) => {
      const id = parseStyleEventDetail((e as CustomEvent).detail);
      if (id) setStyleId(id);
    };
    const onClear = () => {
      setStyleId(loadShowStyleIdOptional() ?? "skidmarks");
    };
    window.addEventListener(CRASH_SHOW_STYLE_EVENT, onStyle);
    window.addEventListener(CRASH_SHOW_STYLE_CLEAR_EVENT, onClear);
    return () => {
      window.removeEventListener(CRASH_SHOW_STYLE_EVENT, onStyle);
      window.removeEventListener(CRASH_SHOW_STYLE_CLEAR_EVENT, onClear);
    };
  }, []);

  return styleId;
}
