"use client";

import { useEffect, useState } from "react";
import { MobileAudioPlayer, MobilePrimaryButton, mobileCard } from "./MobileUi";
import type { MobileGenJob } from "@/lib/mobileGenJob";

type VoiceRow = { name: string; cast: boolean; voiceDescription: string };

/**
 * The roster before the room — who's cast, what they sound like, one tap
 * to hear it. Read-only list is local-manifest only (no ElevenLabs call);
 * "Hear" is the only button that reaches the network, and only for the
 * character tapped.
 */
export function CastVoiceList({ job }: { job: MobileGenJob }) {
  const [voices, setVoices] = useState<VoiceRow[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [samples, setSamples] = useState<Record<string, string>>({});
  const [sampleErrors, setSampleErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/crash/mobile/voices?jobId=${encodeURIComponent(job.id)}`)
      .then((r) => r.json())
      .then((data: { voices?: VoiceRow[]; error?: string }) => {
        if (cancelled) return;
        if (data.voices) setVoices(data.voices);
        else setLoadError(data.error || "Couldn't load the cast voice list");
      })
      .catch(() => {
        if (!cancelled) setLoadError("Couldn't load the cast voice list");
      });
    return () => {
      cancelled = true;
    };
  }, [job.id]);

  async function hear(name: string) {
    setBusy(name);
    setSampleErrors((cur) => ({ ...cur, [name]: "" }));
    try {
      const res = await fetch("/api/crash/mobile/voice-sample", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id, speaker: name }),
      });
      const data = (await res.json()) as {
        error?: string;
        styleId?: string;
        castKey?: string;
        attemptId?: string;
        voiceDescription?: string;
      };
      if (!res.ok || !data.styleId || !data.castKey || !data.attemptId) {
        throw new Error(data.error || "Couldn't get a sample");
      }
      const src =
        `/api/crash/voice/file?styleId=${encodeURIComponent(data.styleId)}` +
        `&castKey=${encodeURIComponent(data.castKey)}&attemptId=${encodeURIComponent(data.attemptId)}`;
      setSamples((cur) => ({ ...cur, [name]: src }));
      setVoices((cur) =>
        cur
          ? cur.map((v) =>
              v.name === name
                ? { ...v, cast: true, voiceDescription: data.voiceDescription || v.voiceDescription }
                : v,
            )
          : cur,
      );
    } catch (e) {
      setSampleErrors((cur) => ({
        ...cur,
        [name]: e instanceof Error ? e.message : "Couldn't get a sample",
      }));
    } finally {
      setBusy(null);
    }
  }

  if (!voices) {
    return loadError ? (
      <div style={{ fontSize: "12px", color: "var(--magenta-hot)", marginBottom: "12px" }}>{loadError}</div>
    ) : null;
  }
  if (!voices.length) return null;

  return (
    <div style={{ ...mobileCard, padding: "10px", marginBottom: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
      <div
        style={{
          color: "var(--chrome-dim)",
          fontSize: "10px",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        Cast voices — {voices.filter((v) => v.cast).length}/{voices.length} cast
      </div>
      {voices.map((v) => (
        <div key={v.name} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ fontSize: "13px", color: "var(--chrome)", fontWeight: 600, flex: 1 }}>{v.name}</div>
            <MobilePrimaryButton size="chip" disabled={busy === v.name} onClick={() => void hear(v.name)}>
              {busy === v.name ? "…" : v.cast ? "▶ Hear" : "Cast + hear"}
            </MobilePrimaryButton>
          </div>
          {v.voiceDescription ? (
            <div style={{ fontSize: "11px", color: "var(--chrome-dim)" }}>{v.voiceDescription}</div>
          ) : null}
          {samples[v.name] ? <MobileAudioPlayer src={samples[v.name]} /> : null}
          {sampleErrors[v.name] ? (
            <div style={{ fontSize: "11px", color: "var(--magenta-hot)" }}>{sampleErrors[v.name]}</div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
