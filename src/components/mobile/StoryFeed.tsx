"use client";

import { useState } from "react";
import { mobileCard } from "./MobileUi";
import type { MobileGenJob } from "@/lib/mobileGenJob";

/**
 * "Building the story" feed — everything the run has produced so far, laid
 * out top to bottom and never thrown away between phases. Every entry is a
 * card so a run scrolls like a document: script, plates as they composite,
 * lines as they're voiced, clips with the actual LTX prompt sent, in that
 * order. Nothing here summarises; the point of it is to show the raw prompt
 * for each clip while the pipeline is still being tuned — information over
 * tidiness.
 */
export function StoryFeed({
  job,
  onClipUploaded,
}: {
  job: MobileGenJob;
  /** Called with the updated job after a clip is manually attached — lets a
   * clip made elsewhere (Grok video, an earlier export) stand in for one LTX
   * would otherwise generate. Omit to hide the upload control. */
  onClipUploaded?: (job: MobileGenJob) => void;
}) {
  const rows: { key: string; node: React.ReactNode }[] = [];

  const shotLabel = (shotId: string) => {
    for (const scene of job.scenes) {
      // job.scenes doesn't carry per-shot detail; the place name is the
      // useful anchor and is enough to place a clip in the episode.
      if (job.shots.some((s) => s.shotId === shotId && s.sceneId === scene.id)) {
        return scene.placeName;
      }
    }
    return shotId;
  };

  const failedShots = job.shots.filter((s) => s.plateFile === "__error__");
  if (failedShots.length) {
    rows.push({
      key: "plate-errors",
      node: (
        <FeedCard key="plate-errors" title={`Shots that failed to plate (${failedShots.length})`} tone="error">
          {failedShots.map((s) => (
            <div key={s.shotId} style={{ fontSize: "12px", color: "var(--chrome-dim)", padding: "3px 0" }}>
              {shotLabel(s.sceneId)} — {s.error || "no reason recorded"}
            </div>
          ))}
        </FeedCard>
      ),
    });
  }

  const clipsStarted = job.clips.filter((c) => c.imageMotion);
  for (const clip of clipsStarted) {
    rows.push({
      key: `clip-${clip.beatId}`,
      node: (
        <ClipCard key={clip.beatId} job={job} clip={clip} onClipUploaded={onClipUploaded} />
      ),
    });
  }

  if (!rows.length) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "16px" }}>
      {rows.map((r) => r.node)}
    </div>
  );
}

function FeedCard({
  title,
  tone,
  children,
}: {
  title: string;
  tone?: "error";
  children: React.ReactNode;
}) {
  return (
    <div style={{ ...mobileCard, padding: "12px" }}>
      <div
        style={{
          fontSize: "10px",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: tone === "error" ? "var(--magenta-hot)" : "var(--chrome-dim)",
          marginBottom: "8px",
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function ClipCard({
  job,
  clip,
  onClipUploaded,
}: {
  job: MobileGenJob;
  clip: MobileGenJob["clips"][number];
  onClipUploaded?: (job: MobileGenJob) => void;
}) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  async function attachClip(file: File) {
    setUploading(true);
    setUploadError("");
    try {
      const form = new FormData();
      form.append("jobId", job.id);
      form.append("beatId", clip.beatId);
      form.append("file", file);
      const res = await fetch("/api/crash/mobile/clip/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      onClipUploaded?.(data.job);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }
  const statusLabel =
    clip.clipStatus === "done" ? "Done" : clip.clipStatus === "error" ? "Failed" : "Rendering…";
  const statusColor =
    clip.clipStatus === "done" ? "var(--acid)" : clip.clipStatus === "error" ? "var(--magenta-hot)" : "var(--chrome-dim)";

  return (
    <FeedCard title={clip.speaker || "Clip"}>
      {clip.line ? (
        <div style={{ fontSize: "13px", color: "var(--chrome)", marginBottom: "8px" }}>
          &ldquo;{clip.line}&rdquo;
        </div>
      ) : null}

      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
        <span style={{ fontSize: "12px", color: statusColor, fontWeight: 600 }}>{statusLabel}</span>
        {clip.clipStatus === "error" && clip.error ? (
          <span style={{ fontSize: "12px", color: "var(--chrome-dim)" }}>— {clip.error}</span>
        ) : null}
      </div>

      {clip.clipStatus === "done" && clip.clipFile ? (
        <video
          controls
          playsInline
          style={{ width: "100%", borderRadius: "8px", marginBottom: "8px" }}
          src={`/api/crash/mobile/clip?styleId=${encodeURIComponent(job.styleId)}&folderName=${encodeURIComponent(job.folderName)}&fileName=${encodeURIComponent(clip.clipFile.split(/[\\/]/).pop() || clip.clipFile)}`}
        />
      ) : null}

      {onClipUploaded ? (
        <div style={{ marginBottom: "8px" }}>
          <label
            style={{
              display: "inline-block",
              fontSize: "11px",
              color: uploading ? "var(--chrome-dim)" : "var(--acid)",
              cursor: uploading ? "default" : "pointer",
            }}
          >
            {uploading
              ? "Uploading…"
              : clip.clipStatus === "done"
                ? "Use a different clip instead"
                : "Use your own clip instead"}
            <input
              type="file"
              accept="video/mp4,video/*"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void attachClip(file);
              }}
              style={{ display: "none" }}
            />
          </label>
          {uploadError ? (
            <div style={{ fontSize: "11px", color: "var(--magenta-hot)", marginTop: "4px" }}>
              {uploadError}
            </div>
          ) : null}
        </div>
      ) : null}

      {clip.imageMotion ? (
        <>
          <button
            type="button"
            onClick={() => setShowPrompt((v) => !v)}
            style={{
              background: "none",
              border: "none",
              color: "var(--chrome-dim)",
              fontSize: "11px",
              padding: 0,
              cursor: "pointer",
            }}
          >
            {showPrompt ? "Hide" : "Show"} the exact prompt sent to LTX
          </button>
          {showPrompt ? (
            <pre
              style={{
                whiteSpace: "pre-wrap",
                fontSize: "11px",
                color: "var(--chrome-dim)",
                background: "var(--void)",
                borderRadius: "8px",
                padding: "10px",
                marginTop: "8px",
                userSelect: "text",
              }}
            >
              {clip.imageMotion}
            </pre>
          ) : null}
        </>
      ) : null}
    </FeedCard>
  );
}
