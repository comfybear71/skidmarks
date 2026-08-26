"use client";

import { CrashLabFloatingPanel } from "@/components/CrashLabFloatingPanel";
import { StyleStoryboardPanel } from "@/components/StyleStoryboardPanel";
import { useScriptDeskWatch } from "@/hooks/useScriptDeskWatch";

const LAYOUT_VER_KEY = "crashlab-storyboard-layout-v15";

export function CrashStoryboardCard() {
  const desk = useScriptDeskWatch();
  const visible = Boolean(desk.showStyleId);

  return (
    <CrashLabFloatingPanel
      title="Storyboard"
      subtitle="Cartoon sheet · Hero / Support"
      titleClassName="text-[#ffe066]"
      layoutVerKey={LAYOUT_VER_KEY}
      panelId="storyboard"
      visible={visible}
      defaultZ={53}
    >
      {desk.showStyleId ? (
        <StyleStoryboardPanel styleId={desk.showStyleId} />
      ) : null}
    </CrashLabFloatingPanel>
  );
}
