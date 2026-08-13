"use client";

import { CrashLabFloatingPanel } from "@/components/CrashLabFloatingPanel";
import { StyleSpxPanel } from "@/components/StyleSpxPanel";
import { useScriptDeskWatch } from "@/hooks/useScriptDeskWatch";

const LAYOUT_VER_KEY = "crashlab-spx-layout-v11";

export function CrashSpxCard() {
  const desk = useScriptDeskWatch();
  const visible = Boolean(desk.showStyleId);

  return (
    <CrashLabFloatingPanel
      title="SFX"
      subtitle="Sound + video"
      titleClassName="text-[var(--chrome)]"
      layoutVerKey={LAYOUT_VER_KEY}
      panelId="spx"
      visible={visible}
      defaultZ={50}
    >
      {desk.showStyleId ? (
        <StyleSpxPanel styleId={desk.showStyleId} />
      ) : null}
    </CrashLabFloatingPanel>
  );
}
