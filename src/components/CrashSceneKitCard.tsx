"use client";

import { CrashLabFloatingPanel } from "@/components/CrashLabFloatingPanel";
import { CrashSceneKitPanel } from "@/components/CrashSceneKitPanel";
import { useScriptDeskWatch } from "@/hooks/useScriptDeskWatch";
import { getShowStylePreset } from "@/lib/showStylePresets";

const LAYOUT_VER_KEY = "crashlab-scenekit-layout-v18";

export function CrashSceneKitCard() {
  const desk = useScriptDeskWatch();
  const preset = desk.showStyleId
    ? getShowStylePreset(desk.showStyleId)
    : null;

  return (
    <CrashLabFloatingPanel
      title="Scene kit"
      subtitle={preset?.label ?? "Place · cast · this scene"}
      layoutVerKey={LAYOUT_VER_KEY}
      panelId="sceneKit"
      visible
      defaultZ={51}
      titleClassName="text-[var(--pipeline)]"
    >
      <CrashSceneKitPanel />
    </CrashLabFloatingPanel>
  );
}
