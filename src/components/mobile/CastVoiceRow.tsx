"use client";

import { useEffect, useState } from "react";
import { MobileAudioPlayer, MobilePrimaryButton } from "./MobileUi";

/**
 * Voice lives with the face — one card per character, not a second list to
 * keep in sync. Status loads read-only (local manifest, no ElevenLabs call);
 * "Hear" is the only button that reaches the network.
 */
export function CastVoiceRow({ jobId, name }: { jobId: string; name: string }) {
  const [cast, setCast] = useState<boolean | null>(null);
  const [description, setDescription] = useState("");
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sample, setSample] = useState("");
  const [sampleError, setSampleError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/crash/mobile/voices?jobId=${encodeURIComponent(jobId)}&speaker=${encodeURIComponent(name)}`)
      .then((r) => r.json())
      .then((data: { voices?: { cast: boolean; voiceDescription: string }[]; error?: string }) => {
        if (cancelled) return;
        const row = data.voices?.[0];
        if (row) {
          setCast(row.cast);
          setDescription(row.voiceDescription);
        } else {
          setLoadError(data.error || "Couldn't load voice status");
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError("Couldn't load voice status");
      });
    return () => {
      cancelled = true;
    };
  }, [jobId, name]);

  async function hear() {
    setBusy(true);
    setSampleError("");
    try {
      const res = await fetch("/api/crash/mobile/voice-sample", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, speaker: name }),
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
      setSample(
        `/api/crash/voice/file?styleId=${encodeURIComponent(data.styleId)}` +
          `&castKey=${encodeURIComponent(data.castKey)}&attemptId=${encodeURIComponent(data.attemptId)}`,
      );
      setCast(true);
      if (data.voiceDescription) setDescription(data.voiceDescription);
    } catch (e) {
      setSampleError(e instanceof Error ? e.message : "Couldn't get a sample");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <div
          style={{
            color: "var(--chrome-dim)",
            fontSize: "10px",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            flex: 1,
          }}
        >
          Voice{cast === false ? " — not cast yet" : ""}
        </div>
        <MobilePrimaryButton size="chip" disabled={busy || cast === null} onClick={() => void hear()}>
          {busy ? "…" : cast ? "▶ Hear" : "Cast + hear"}
        </MobilePrimaryButton>
      </div>
      {description ? <div style={{ fontSize: "11px", color: "var(--chrome-dim)" }}>{description}</div> : null}
      {sample ? <MobileAudioPlayer src={sample} /> : null}
      {sampleError ? <div style={{ fontSize: "11px", color: "var(--magenta-hot)" }}>{sampleError}</div> : null}
      {loadError ? <div style={{ fontSize: "11px", color: "var(--magenta-hot)" }}>{loadError}</div> : null}
    </div>
  );
}
