"use client";

import { CrashLabFloatingPanel } from "@/components/CrashLabFloatingPanel";
import { StyleStoryPanel } from "@/components/StyleStoryPanel";
import { useScriptDeskWatch } from "@/hooks/useScriptDeskWatch";

const LAYOUT_VER_KEY = "crashlab-story-layout-v11";

export function CrashStoryCard() {
  const desk = useScriptDeskWatch();
  const visible = Boolean(desk.showStyleId);

  return (
    <CrashLabFloatingPanel
      title="Story"
      subtitle="Scene · shots · audio"
      titleClassName="text-[var(--acid)]"
      layoutVerKey={LAYOUT_VER_KEY}
      panelId="story"
      visible={visible}
      defaultZ={51}
    >
      <StyleStoryPanel styleId={desk.showStyleId} />
    </CrashLabFloatingPanel>
  );
}
