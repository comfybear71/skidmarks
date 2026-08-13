"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AnimateModeTabs,
  animateTabSubtitle,
  readAnimateTab,
  type AnimateTab,
} from "@/components/AnimateModeTabs";
import { CrashLabFloatingPanel } from "@/components/CrashLabFloatingPanel";
import { StyleComfyPanel } from "@/components/StyleComfyPanel";
import { WanFxBabyPanel } from "@/components/WanFxBabyPanel";
import { useScriptDeskWatch } from "@/hooks/useScriptDeskWatch";

const LAYOUT_VER_KEY = "crashlab-comfy-layout-v13";

export function CrashComfyCard() {
  const desk = useScriptDeskWatch();
  const [tab, setTab] = useState<AnimateTab>("ltx");
  const [ltxRunning, setLtxRunning] = useState(false);
  const [lipsyncRunning, setLipsyncRunning] = useState(false);
  const [boomRunning, setBoomRunning] = useState(false);

  useEffect(() => {
    setTab(readAnimateTab());
  }, []);

  const onActivityChange = useCallback(
    (activity: { ltxRunning: boolean; lipsyncRunning: boolean }) => {
      setLtxRunning(activity.ltxRunning);
      setLipsyncRunning(activity.lipsyncRunning);
    },
    [],
  );

  return (
    <CrashLabFloatingPanel
      title="Animate"
      subtitle={animateTabSubtitle(tab)}
      titleClassName="text-[var(--pipeline)]"
      layoutVerKey={LAYOUT_VER_KEY}
      panelId="comfy"
      visible
      defaultZ={52}
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <AnimateModeTabs
        active={tab}
        onChange={setTab}
        ltxRunning={ltxRunning}
        lipsyncRunning={lipsyncRunning}
        boomRunning={boomRunning}
      />

      <div
        className={
          tab === "boom"
            ? "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
            : "hidden"
        }
        aria-hidden={tab !== "boom"}
      >
        <WanFxBabyPanel onBusyChange={setBoomRunning} />
      </div>

      {desk.showStyleId ? (
        <div
          className={
            tab === "ltx" || tab === "lipsync"
              ? "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
              : "hidden"
          }
          aria-hidden={tab !== "ltx" && tab !== "lipsync"}
        >
          <StyleComfyPanel
            styleId={desk.showStyleId}
            mode={tab === "lipsync" ? "lipsync" : "ltx"}
            onActivityChange={onActivityChange}
          />
        </div>
      ) : tab === "ltx" || tab === "lipsync" ? (
        <p className="text-[9px] text-[var(--mute)]">
          Pick a show on Script for {tab === "ltx" ? "LTX" : "Lipsync"}. Boom
          tab works now.
        </p>
      ) : null}
      </div>
    </CrashLabFloatingPanel>
  );
}
