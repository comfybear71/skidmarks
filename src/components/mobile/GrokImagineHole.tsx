"use client";

import { useEffect, useRef, useState } from "react";
import {
  GROK_IMAGINE_VIDEO_SECS,
  grokImagineFoldLines,
  grokImagineFoldSummary,
  normalizeGrokImagineSettings,
  readGrokImagineSettings,
  writeGrokImagineSettings,
  type GrokImagineImageRes,
  type GrokImagineMode,
  type GrokImagineSettings,
} from "@/lib/grokImagine";
import { writeMvClipEngine } from "@/lib/mobileImageMotion";

function GrokSpeakerIcon({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
      <path
        fill="currentColor"
        d="M4 9h3.2L12 5.4v13.2L7.2 15H4V9z"
      />
      {on ? (
        <path
          fill="currentColor"
          d="M14.2 8.2c1.2 1.1 1.9 2.4 1.9 3.8s-.7 2.7-1.9 3.8l-1.1-1.3c.8-.7 1.2-1.5 1.2-2.5s-.4-1.8-1.2-2.5l1.1-1.3zm2.7-2.6C18.8 7.3 20 9.5 20 12s-1.2 4.7-3.1 6.4l-1.2-1.3C17.2 15.8 18 14 18 12s-.8-3.8-2.3-5.1l1.2-1.3z"
        />
      ) : (
        <path
          fill="currentColor"
          d="M15.2 9.1 16.6 7.7l4 4-4 4-1.4-1.4 2.6-2.6-2.6-2.6z"
        />
      )}
    </svg>
  );
}

export type GrokImaginePlate = { fileName: string; label: string };

export function GrokImagineHole({
  jobId,
  shotId,
  plates,
  disabled,
  onImagine,
  onJobChange,
}: {
  jobId: string;
  shotId: string;
  plates: GrokImaginePlate[];
  disabled?: boolean;
  onImagine?: () => void;
  onJobChange?: (job: import("@/lib/mobileGenJob").MobileGenJob) => void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [tail, setTail] = useState<GrokImaginePlate | null>(null);
  const [attachError, setAttachError] = useState("");
  const [settings, setSettings] = useState<GrokImagineSettings>(() => {
    const stored = readGrokImagineSettings(jobId, shotId);
    const first = plates[0]?.fileName || "";
    return normalizeGrokImagineSettings({
      ...stored,
      plateFile: stored.plateFile || first,
    });
  });

  useEffect(() => {
    writeMvClipEngine(jobId, shotId, "grok");
  }, [jobId, shotId]);

  useEffect(() => {
    let live = true;
    setTail(null);
    void fetch("/api/crash/mobile/clip-tail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId, shotId }),
    })
      .then((res) => res.json())
      .then((data: { fileName?: string; label?: string }) => {
        const fileName = (data.fileName || "").trim();
        if (!live || !fileName) return;
        setTail({
          fileName,
          label: (data.label || "").trim() || "Last frame · clip 1",
        });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [jobId, shotId]);

  const allPlates = tail
    ? [tail, ...plates.filter((p) => p.fileName !== tail.fileName)]
    : plates;

  useEffect(() => {
    const stored = readGrokImagineSettings(jobId, shotId);
    const first = tail?.fileName || plates[0]?.fileName || "";
    setSettings((prev) =>
      normalizeGrokImagineSettings({
        ...stored,
        prompt: prev.prompt || stored.prompt,
        plateFile: tail?.fileName || stored.plateFile || first,
      }),
    );
  }, [jobId, plates, shotId, tail]);

  useEffect(() => {
    writeGrokImagineSettings(jobId, shotId, settings);
  }, [jobId, settings, shotId]);

  function patch(next: Partial<GrokImagineSettings>) {
    setSettings((prev) => normalizeGrokImagineSettings({ ...prev, ...next }));
  }

  const video = settings.mode === "video";

  return (
    <div className="m-plate-motion-hole m-grok-imagine" data-engine="grok">
      <div className="m-plate-motion-label">GROK Imagine 2.0</div>
      <details className="m-plate-motion-fold">
        <summary>{grokImagineFoldSummary()}</summary>
        <div className="m-plate-motion-fold-body">
          {grokImagineFoldLines().map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </details>
      <div className="m-grok-bar">
        <textarea
          className="m-grok-prompt"
          rows={3}
          disabled={disabled}
          placeholder="Type to imagine"
          value={settings.prompt}
          onChange={(e) => patch({ prompt: e.target.value })}
          onKeyDown={(e) => e.stopPropagation()}
        />
        <div className="m-grok-tools">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              void (async () => {
                setAttachError("");
                const form = new FormData();
                form.set("jobId", jobId);
                form.set("shotId", shotId);
                form.set("file", file);
                const res = await fetch("/api/crash/mobile/imagine", {
                  method: "POST",
                  body: form,
                });
                const data = (await res.json().catch(() => ({}))) as {
                  job?: import("@/lib/mobileGenJob").MobileGenJob;
                  fileName?: string;
                  error?: string;
                };
                if (data.job) onJobChange?.(data.job);
                if (data.fileName) {
                  patch({ plateFile: data.fileName });
                  return;
                }
                setAttachError(
                  (data.error || "").trim() || "Couldn't add that still. Try another photo.",
                );
              })();
            }}
          />
          <button
            type="button"
            className="m-grok-plus"
            disabled={disabled}
            title="Add a plate image"
            onClick={() => fileRef.current?.click()}
          >
            +
          </button>
          <div className="m-grok-mode" role="group" aria-label="Image or video">
            <button
              type="button"
              className={`m-grok-chip${settings.mode === "image" ? " is-on" : ""}`}
              disabled={disabled}
              onClick={() => patch({ mode: "image" as GrokImagineMode })}
            >
              Image
            </button>
            <button
              type="button"
              className={`m-grok-chip${settings.mode === "video" ? " is-on" : ""}`}
              disabled={disabled}
              onClick={() => patch({ mode: "video" as GrokImagineMode })}
            >
              Video
            </button>
          </div>
          {video ? (
            <div className="m-grok-mode" role="group" aria-label="GROK length">
              {GROK_IMAGINE_VIDEO_SECS.map((sec) => (
                <button
                  key={sec}
                  type="button"
                  className={`m-grok-chip${settings.durationSec === sec ? " is-on" : ""}`}
                  disabled={disabled}
                  onClick={() => patch({ durationSec: sec })}
                >
                  {sec}s
                </button>
              ))}
            </div>
          ) : (
            <div className="m-grok-mode" role="group" aria-label="GROK still resolution">
              {(["1k", "2k"] as GrokImagineImageRes[]).map((res) => (
                <button
                  key={res}
                  type="button"
                  className={`m-grok-chip${settings.imageRes === res ? " is-on" : ""}`}
                  disabled={disabled}
                  onClick={() => patch({ imageRes: res })}
                >
                  {res}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            className={`m-grok-chip m-grok-speaker${settings.keepAudio ? " is-on" : ""}`}
            disabled={disabled || !video}
            title={
              video
                ? settings.keepAudio
                  ? "Keep Grok audio"
                  : "Strip Grok audio — song stays on TRACK"
                : "Stills have no audio"
            }
            aria-label={settings.keepAudio ? "Audio on" : "Audio off"}
            onClick={() => patch({ keepAudio: !settings.keepAudio })}
          >
            <GrokSpeakerIcon on={settings.keepAudio} />
          </button>
          {onImagine ? (
            <button
              type="button"
              className="m-grok-go"
              disabled={disabled}
              title="Imagine"
              onClick={() => onImagine()}
            >
              ↑
            </button>
          ) : null}
        </div>
      </div>
      {attachError ? <p className="m-grok-attach-err">{attachError}</p> : null}
      <p className="m-grok-attach-label">Plate image — tap one, or + for a file</p>
      <div className="m-plate-h3-lasts" role="group" aria-label="GROK plate image">
        {allPlates.length ? (
          allPlates.map((plate) => (
            <button
              key={plate.fileName}
              type="button"
              className={`m-plate-h3-last${settings.plateFile === plate.fileName ? " is-on" : ""}`}
              disabled={disabled}
              title={plate.label}
              onClick={() => patch({ plateFile: plate.fileName })}
            >
              <span
                className="m-plate-h3-last-thumb"
                style={{
                  backgroundImage: `url(/api/crash/gen/file?name=${encodeURIComponent(plate.fileName)})`,
                }}
                aria-hidden
              />
              <span>{plate.label}</span>
            </button>
          ))
        ) : (
          <p className="m-plate-h3-caps-note">No plate on this card yet. Draw one, or tap +.</p>
        )}
      </div>
      {tail && settings.plateFile === tail.fileName ? (
        <p className="m-plate-h3-caps-note">Clip 2 starts from clip 1 last frame.</p>
      ) : null}
    </div>
  );
}
