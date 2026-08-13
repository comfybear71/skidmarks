"use client";

import { useSyncExternalStore } from "react";
import {
  CRASH_GEN_PLATE_SAVED,
  CRASH_PRODUCTION_STEP_EVENT,
  CRASH_SCRIPT_FIELDS_EVENT,
  CRASH_SHOW_STYLE_CLEAR_EVENT,
  CRASH_SHOW_STYLE_EVENT,
  CRASH_STORY_SAVED,
  CRASH_SWAP_SAVED,
} from "@/lib/crashStyleSync";
import { readScriptDeskState, type ScriptDeskState } from "@/lib/crashScriptFields";
import { CRASH_ACTIVE_EPISODE_EVENT } from "@/lib/crashActiveEpisode";

const EMPTY: ScriptDeskState = {
  showStyleId: null,
  productionStep: 1,
  swapTargetGenFile: "",
  fields: {
    character: "",
    location: "",
    fakeWin: "",
    losesIt: "",
    getsSmashed: "",
  },
  spineStep: 1,
};

let cachedRaw = "";
let cachedState: ScriptDeskState = EMPTY;
let watching = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function ensureWatch() {
  if (typeof window === "undefined" || watching) return;
  watching = true;
  window.addEventListener(CRASH_PRODUCTION_STEP_EVENT, emit);
  window.addEventListener(CRASH_SCRIPT_FIELDS_EVENT, emit);
  window.addEventListener(CRASH_SWAP_SAVED, emit);
  window.addEventListener(CRASH_GEN_PLATE_SAVED, emit);
  window.addEventListener(CRASH_SHOW_STYLE_EVENT, emit);
  window.addEventListener(CRASH_SHOW_STYLE_CLEAR_EVENT, emit);
  window.addEventListener(CRASH_ACTIVE_EPISODE_EVENT, emit);
  window.addEventListener(CRASH_STORY_SAVED, emit);
  window.addEventListener("storage", emit);
}

function subscribeDesk(cb: () => void) {
  ensureWatch();
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getClientSnapshot(): ScriptDeskState {
  const next = readScriptDeskState();
  const raw = JSON.stringify(next);
  if (raw === cachedRaw) return cachedState;
  cachedRaw = raw;
  cachedState = next;
  return cachedState;
}

function getServerSnapshot(): ScriptDeskState {
  return EMPTY;
}

/** Watch Script desk step + style from localStorage / events (floating panels). */
export function useScriptDeskWatch(): ScriptDeskState {
  return useSyncExternalStore(subscribeDesk, getClientSnapshot, getServerSnapshot);
}
