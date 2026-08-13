"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CrashLabFloatingPanel } from "@/components/CrashLabFloatingPanel";
import { StyleVoicePanel } from "@/components/StyleVoicePanel";
import { useScriptDeskWatch } from "@/hooks/useScriptDeskWatch";
import { readScriptDeskCharacterDraft } from "@/lib/crashScriptFields";
import {
  CRASH_GEN_PLATE_SAVED,
  CRASH_SCRIPT_FIELDS_EVENT,
  CRASH_STYLE_THUMB_SAVED,
  CRASH_SWAP_SAVED,
  dispatchProductionStep,
} from "@/lib/crashStyleSync";
import { resolveVoiceCast } from "@/lib/resolveVoiceCast";
import { getShowStylePreset, type ShowStyleId } from "@/lib/showStylePresets";
import type { SwapResultLabel } from "@/lib/swapCards";

const LAYOUT_VER_KEY = "crashlab-voice-layout-v11";

type ThumbLabel = { name?: string; brief?: string };

export function CrashVoiceCard() {
  const desk = useScriptDeskWatch();
  const showStyleId = desk.showStyleId;
  const productionStep = desk.productionStep;
  const swapTargetGenFile = desk.swapTargetGenFile;

  const [swapResults, setSwapResults] = useState<Record<string, SwapResultLabel>>(
    {},
  );
  const [swapVersion, setSwapVersion] = useState(0);
  const [genPlates, setGenPlates] = useState<
    { fileName: string; mtime: number; label?: string }[]
  >([]);
  const [thumbLabels, setThumbLabels] = useState<Record<string, ThumbLabel>>(
    {},
  );
  const [thumbVersion, setThumbVersion] = useState(0);
  const [castKeys, setCastKeys] = useState<string[]>([]);

  const preset = useMemo(
    () => (showStyleId ? getShowStylePreset(showStyleId) : null),
    [showStyleId],
  );

  const refreshSwap = useCallback(async (styleId: ShowStyleId) => {
    try {
      const res = await fetch(
        `/api/crash/swap?styleId=${encodeURIComponent(styleId)}`,
      );
      const data = await res.json();
      if (!res.ok) return;
      setGenPlates(Array.isArray(data.genPlates) ? data.genPlates : []);
      setSwapResults(
        data.swaps && typeof data.swaps === "object" ? data.swaps : {},
      );
      setSwapVersion((v) => v + 1);
    } catch {
      /* ignore */
    }
  }, []);

  const refreshThumbLabels = useCallback(async (styleId: ShowStyleId) => {
    try {
      const res = await fetch(
        `/api/crash/style-cards/manifest?styleId=${encodeURIComponent(styleId)}`,
      );
      const data = await res.json();
      if (res.ok && data.labels && typeof data.labels === "object") {
        setThumbLabels(data.labels as Record<string, ThumbLabel>);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const refreshCastKeys = useCallback(() => {
    const draft = readScriptDeskCharacterDraft();
    setCastKeys(draft.styleCastKeys);
  }, []);

  useEffect(() => {
    if (!showStyleId) return;
    void refreshSwap(showStyleId);
    void refreshThumbLabels(showStyleId);
    refreshCastKeys();
  }, [showStyleId, productionStep, refreshSwap, refreshThumbLabels, refreshCastKeys]);

  useEffect(() => {
    const onSwap = () => {
      if (showStyleId) void refreshSwap(showStyleId);
    };
    const onGenPlate = () => {
      refreshCastKeys();
      if (showStyleId) void refreshSwap(showStyleId);
    };
    const onThumb = () => {
      setThumbVersion((v) => v + 1);
      if (showStyleId) void refreshThumbLabels(showStyleId);
      refreshCastKeys();
    };
    const onFields = () => {
      refreshCastKeys();
    };
    window.addEventListener(CRASH_SWAP_SAVED, onSwap);
    window.addEventListener(CRASH_GEN_PLATE_SAVED, onGenPlate);
    window.addEventListener(CRASH_STYLE_THUMB_SAVED, onThumb);
    window.addEventListener(CRASH_SCRIPT_FIELDS_EVENT, onFields);
    return () => {
      window.removeEventListener(CRASH_SWAP_SAVED, onSwap);
      window.removeEventListener(CRASH_GEN_PLATE_SAVED, onGenPlate);
      window.removeEventListener(CRASH_STYLE_THUMB_SAVED, onThumb);
      window.removeEventListener(CRASH_SCRIPT_FIELDS_EVENT, onFields);
    };
  }, [showStyleId, refreshSwap, refreshThumbLabels, refreshCastKeys]);

  const activePlateFile =
    swapTargetGenFile || genPlates[0]?.fileName || "";

  const episodeCast = useMemo(
    () =>
      castKeys.map((key) => {
        const label = thumbLabels[key];
        const presetChar = preset?.presetCast.find(
          (p) => p.id === key || p.name === label?.name,
        );
        return {
          key,
          name: label?.name || presetChar?.name || key,
          brief: label?.brief || presetChar?.rule,
        };
      }),
    [castKeys, thumbLabels, preset],
  );

  const voiceCast = useMemo(
    () =>
      resolveVoiceCast({
        swapResults,
        targetGenFile: activePlateFile,
        episodeCast,
        trayOnly: true,
      }),
    [swapResults, activePlateFile, episodeCast],
  );

  const visible = Boolean(showStyleId && preset);

  return (
    <CrashLabFloatingPanel
      title="Voice"
      subtitle={preset?.label ?? "Pick a show"}
      layoutVerKey={LAYOUT_VER_KEY}
      panelId="voice"
      visible={visible}
      defaultZ={52}
      titleClassName="text-[var(--pipeline)]"
    >
      {preset ? (
        <StyleVoicePanel
          variant="panel"
          preset={preset}
          voiceCast={voiceCast}
          thumbVersion={thumbVersion}
          swapResults={swapResults}
          swapVersion={swapVersion}
          targetGenFile={activePlateFile}
          plateLabel={
            genPlates.find((p) => p.fileName === activePlateFile)?.label
          }
          onContinueStory={() => dispatchProductionStep(6)}
          castRemovable
          allowFaceDrop
        />
      ) : null}
    </CrashLabFloatingPanel>
  );
}
