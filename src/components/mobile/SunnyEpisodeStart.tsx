"use client";

import { useEffect, useMemo, useState } from "react";
import { MobilePrimaryButton, MobileTextInput } from "@/components/mobile/MobileUi";
import { getShowStylePreset } from "@/lib/showStylePresets";
import {
  SUNNY_CAMERAS,
  SUNNY_EPISODE_BLANK,
  sunnyEpisodeGate,
} from "@/lib/sunnyEpisodeSpec";

type WorldCard = {
  id: string;
  thumbs?: { name?: string }[];
};

export function SunnyEpisodeStart({
  busy,
  onMake,
}: {
  busy: boolean;
  onMake: (brief: string, script: string) => void;
}) {
  const [brief, setBrief] = useState("");
  const [script, setScript] = useState(SUNNY_EPISODE_BLANK);
  const [shelfNames, setShelfNames] = useState<string[]>(
    () => getShowStylePreset("sunny_banks").presetPlaces.map((p) => p.name),
  );

  useEffect(() => {
    let cancelled = false;
    fetch("/api/crash/world-cards")
      .then((r) => r.json())
      .then((d: { cards?: WorldCard[] }) => {
        if (cancelled) return;
        const sunny = (d.cards || []).find((c) => c.id === "sunny_banks");
        const fromShelf = (sunny?.thumbs || [])
          .map((t) => (t.name || "").trim())
          .filter(Boolean);
        const preset = getShowStylePreset("sunny_banks").presetPlaces.map((p) => p.name);
        const seen = new Set<string>();
        const names: string[] = [];
        for (const n of [...fromShelf, ...preset]) {
          const key = n.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          names.push(n);
        }
        setShelfNames(names);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const gate = useMemo(() => {
    return sunnyEpisodeGate({
      brief,
      script,
      shelfPlaces: shelfNames.map((name) => ({ name })),
    });
  }, [brief, script, shelfNames]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "12px" }}>
      <div style={{ color: "var(--chrome-dim)", fontSize: "12px" }}>
        Series faces are already on. Guests and new places need a still first. Camera words:{" "}
        {SUNNY_CAMERAS.join(", ")}.
      </div>
      <MobileTextInput
        value={brief}
        onChange={setBrief}
        placeholder="GAG: one sentence — the joke of this episode"
        multiline
        rows={2}
      />
      <MobileTextInput
        value={script}
        onChange={setScript}
        placeholder={SUNNY_EPISODE_BLANK}
        multiline
        rows={14}
      />
      {!gate.ok && gate.error ? (
        <div style={{ color: "var(--magenta-hot)", fontSize: "13px" }}>{gate.error}</div>
      ) : null}
      {shelfNames.length ? (
        <div style={{ color: "var(--chrome-dim)", fontSize: "11px" }}>
          Shelf places: {shelfNames.join(", ")}
        </div>
      ) : null}
      <MobilePrimaryButton
        disabled={!gate.ok || busy}
        onClick={() => onMake(brief, script)}
      >
        {busy ? "Making…" : "Make this episode"}
      </MobilePrimaryButton>
    </div>
  );
}
