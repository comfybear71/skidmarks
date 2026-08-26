"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MobilePrimaryButton, MobileTextInput } from "@/components/mobile/MobileUi";
import { getShowStylePreset } from "@/lib/showStylePresets";
import {
  SUNNY_CAMERAS,
  SUNNY_EPISODE_BLANK,
  sunnyEpisodeGate,
} from "@/lib/sunnyEpisodeSpec";
import { readSunnyEpisodeDraft, writeSunnyEpisodeDraft } from "@/lib/sunnyEpisodeDraft";

type WorldCard = {
  id: string;
  thumbs?: { name?: string }[];
};

export function SunnyEpisodeStart({
  busy,
  error,
  onMake,
}: {
  busy: boolean;
  error?: string;
  onMake: (brief: string, script: string) => void;
}) {
  const [brief, setBrief] = useState("");
  const [script, setScript] = useState(SUNNY_EPISODE_BLANK);
  const [draftReady, setDraftReady] = useState(false);

  useEffect(() => {
    try {
      const draft = readSunnyEpisodeDraft(window.localStorage);
      if (draft.brief) setBrief(draft.brief);
      if (draft.script.trim()) setScript(draft.script);
    } catch {
      /* private mode */
    }
    setDraftReady(true);
  }, []);

  useEffect(() => {
    if (!draftReady) return;
    try {
      writeSunnyEpisodeDraft(window.localStorage, brief, script);
    } catch {
      /* private mode */
    }
  }, [brief, script, draftReady]);
  const shoutRef = useRef<HTMLDivElement>(null);
  const [shelfNames, setShelfNames] = useState<string[]>(
    () => getShowStylePreset("sunny_banks").presetPlaces.map((p) => p.name),
  );

  useEffect(() => {
    const prev = document.title;
    if (busy) document.title = "WAIT · making episode";
    else if (error) document.title = "FAIL · episode";
    else document.title = prev.startsWith("WAIT") || prev.startsWith("FAIL") ? "Skidmarks" : prev;
    return () => {
      document.title = prev;
    };
  }, [busy, error]);

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
        Gag and script stay if you refresh. Make picks the series faces and
        places, then cooks. No Pick this one. Pink = not started. Yellow WAIT =
        working. Camera words: {SUNNY_CAMERAS.join(", ")}.
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
      <div ref={shoutRef}>
        {busy ? (
          <div
            style={{
              padding: "12px",
              borderRadius: "8px",
              background: "var(--acid)",
              color: "#111",
              fontSize: "16px",
              fontWeight: 700,
            }}
          >
            WAIT. Making the episode. Do not tap again.
          </div>
        ) : error ? (
          <div
            style={{
              padding: "12px",
              borderRadius: "8px",
              background: "rgba(255,26,140,0.18)",
              color: "var(--magenta-hot)",
              fontSize: "16px",
              fontWeight: 700,
            }}
          >
            FAIL. {error}
          </div>
        ) : !gate.ok && gate.error ? (
          <div style={{ color: "var(--magenta-hot)", fontSize: "15px", fontWeight: 700 }}>
            Won&apos;t start. {gate.error}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ color: "var(--acid)", fontSize: "14px", fontWeight: 700 }}>
              Ready. Make this episode — then wait.
            </div>
            <div style={{ color: "var(--chrome-dim)", fontSize: "13px" }}>
              {gate.scan.compositeCount + gate.scan.hangPlaceCount} shots have a
              plan
              {gate.scan.compositeCount
                ? ` — ${gate.scan.compositeCount} draw people`
                : ""}
              {gate.scan.hangPlaceCount
                ? ` — ${gate.scan.hangPlaceCount} hang the place still`
                : ""}
              . New places get drawn. Series faces stay the locked cards.
            </div>
            {gate.scan.guests.length ? (
              <div style={{ color: "var(--chrome-dim)", fontSize: "13px" }}>
                New names get drawn from the script: {gate.scan.guests.join(", ")}.
              </div>
            ) : null}
          </div>
        )}
      </div>
      {shelfNames.length ? (
        <div style={{ color: "var(--chrome-dim)", fontSize: "11px" }}>
          Shelf places: {shelfNames.join(", ")}
        </div>
      ) : null}
      <MobilePrimaryButton
        busy={busy}
        onClick={() => {
          shoutRef.current?.scrollIntoView({ block: "center" });
          if (busy) return;
          if (!gate.ok) return;
          onMake(brief, script);
        }}
      >
        {busy ? "WAIT — making…" : gate.ok ? "Make this episode" : "Won't start yet"}
      </MobilePrimaryButton>
    </div>
  );
}
