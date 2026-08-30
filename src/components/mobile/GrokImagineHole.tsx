"use client";

import { useEffect, useRef, useState } from "react";
import {
  GROK_IMAGINE_ASPECTS,
  GROK_IMAGINE_VIDEO_RES,
  GROK_IMAGINE_VIDEO_SECS,
  grokImagineFoldLines,
  grokImagineFoldSummary,
  normalizeGrokImagineSettings,
  readGrokImagineSettings,
  writeGrokImagineSettings,
  type GrokImagineAspect,
  type GrokImagineImageRes,
  type GrokImagineMode,
  type GrokImagineSettings,
  type GrokImagineVideoRes,
} from "@/lib/grokImagine";

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
  const [settings, setSettings] = useState<GrokImagineSettings>(() => {
    const stored = readGrokImagineSettings(jobId, shotId);
    const first = plates[0]?.fileName || "";
    return normalizeGrokImagineSettings({
      ...stored,
      plateFile: stored.plateFile || first,
    });
  });

  useEffect(() => {
    const stored = readGrokImagineSettings(jobId, shotId);
    const first = plates[0]?.fileName || "";
    setSettings(
      normalizeGrokImagineSettings({
        ...stored,
        plateFile: stored.plateFile || first,
      }),
    );
  }, [jobId, plates, shotId]);

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
                if (data.fileName) patch({ plateFile: data.fileName });
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
            <div className="m-grok-mode" role="group" aria-label="GROK resolution">
              {GROK_IMAGINE_VIDEO_RES.map((res) => (
                <button
                  key={res}
                  type="button"
                  className={`m-grok-chip${settings.videoRes === res ? " is-on" : ""}`}
                  disabled={disabled}
                  onClick={() => patch({ videoRes: res as GrokImagineVideoRes })}
                >
                  {res}
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
          ) : null}
          <button
            type="button"
            className={`m-grok-chip${settings.keepAudio ? " is-on" : ""}`}
            disabled={disabled || !video}
            title={
              video
                ? settings.keepAudio
                  ? "Keep Grok audio"
                  : "Strip Grok audio — song stays on TRACK"
                : "Stills have no audio"
            }
            onClick={() => patch({ keepAudio: !settings.keepAudio })}
          >
            {settings.keepAudio ? "Audio on" : "Audio off"}
          </button>
          <div className="m-grok-mode" role="group" aria-label="Aspect">
            {GROK_IMAGINE_ASPECTS.map((ratio) => (
              <button
                key={ratio}
                type="button"
                className={`m-grok-chip${settings.aspect === ratio ? " is-on" : ""}`}
                disabled={disabled}
                onClick={() => patch({ aspect: ratio as GrokImagineAspect })}
              >
                {ratio}
              </button>
            ))}
          </div>
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
      <p className="m-grok-attach-label">Plate image — tap one, or + for a file</p>
      <div className="m-plate-h3-lasts" role="group" aria-label="GROK plate image">
        {plates.length ? (
          plates.map((plate) => (
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
    </div>
  );
}
