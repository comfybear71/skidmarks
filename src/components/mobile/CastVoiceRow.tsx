"use client";

import { useEffect, useRef, useState } from "react";
import { MobilePrimaryButton } from "./MobileUi";

/**
 * Voice lives with the face — one compact row, not a whole second card.
 * Status loads read-only (local manifest, no ElevenLabs call); "Hear" is
 * the only button that reaches the network, and it plays inline from the
 * response bytes (no separate /api/crash/voice/file round trip — that
 * route reads local disk only and a second Vercel invocation may not have
 * the file the first one just wrote).
 */
export function CastVoiceRow({ jobId, name }: { jobId: string; name: string }) {
  const [cast, setCast] = useState<boolean | null>(null);
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);

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
          setError(data.error || "Couldn't load voice status");
        }
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load voice status");
      });
    return () => {
      cancelled = true;
    };
  }, [jobId, name]);

  async function hear() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/crash/mobile/voice-sample", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, speaker: name }),
      });
      const data = (await res.json()) as {
        error?: string;
        audioBase64?: string;
        voiceDescription?: string;
      };
      if (!res.ok || !data.audioBase64) throw new Error(data.error || "Couldn't get a sample");
      setCast(true);
      if (data.voiceDescription) setDescription(data.voiceDescription);
      const audio = audioRef.current || new Audio();
      audioRef.current = audio;
      audio.onplay = () => setPlaying(true);
      audio.onpause = () => setPlaying(false);
      audio.onended = () => setPlaying(false);
      audio.src = `data:audio/mpeg;base64,${data.audioBase64}`;
      await audio.play().catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't get a sample");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
      <span
        style={{
          color: "var(--chrome-dim)",
          fontSize: "10px",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          flex: "0 0 auto",
        }}
      >
        Voice
      </span>
      <MobilePrimaryButton size="chip" disabled={busy || cast === null} onClick={() => void hear()}>
        {busy ? "…" : playing ? "Playing…" : cast ? "▶ Hear" : "Cast + hear"}
      </MobilePrimaryButton>
      {error ? (
        <span style={{ fontSize: "11px", color: "var(--magenta-hot)" }}>{error}</span>
      ) : description ? (
        <span
          style={{
            fontSize: "11px",
            color: "var(--chrome-dim)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: "220px",
          }}
        >
          {description}
        </span>
      ) : null}
    </div>
  );
}
