"use client";

import { CrashCharacterPanel } from "@/components/CrashCharacterPanel";
import { CrashLabFloatingPanel } from "@/components/CrashLabFloatingPanel";
import { useScriptDeskWatch } from "@/hooks/useScriptDeskWatch";
import { getShowStylePreset } from "@/lib/showStylePresets";

const LAYOUT_VER_KEY = "crashlab-character-layout-v16";

export function CrashCharacterCard() {
  const desk = useScriptDeskWatch();
  const preset = desk.showStyleId
    ? getShowStylePreset(desk.showStyleId)
    : null;

  return (
    <CrashLabFloatingPanel
      title="Character"
      subtitle={preset?.label ?? "Who · faces · voice later"}
      layoutVerKey={LAYOUT_VER_KEY}
      panelId="character"
      visible
      defaultZ={53}
      titleClassName="text-[var(--pipeline)]"
    >
      <CrashCharacterPanel />
    </CrashLabFloatingPanel>
  );
}
