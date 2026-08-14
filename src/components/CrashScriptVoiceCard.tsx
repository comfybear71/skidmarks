"use client";

import { useCallback, useEffect, useState } from "react";
import { BeatAudioMini } from "@/components/BeatAudioMini";
import { CrashLabCollapseBtn } from "@/components/CrashLabCollapseBtn";
import { useCrashDeskMode } from "@/hooks/useCrashDeskMode";
import { usePanelPointerDrag } from "@/hooks/usePanelPointerDrag";
import { useCrashActiveStyle } from "@/hooks/useCrashActiveStyle";
import {
  CRASH_ACTIVE_EPISODE_EVENT,
  crashDeskStoryFetchUrl,
  readActiveEpisode,
} from "@/lib/crashActiveEpisode";
import { CRASH_STORY_SAVED, dispatchStorySaved } from "@/lib/crashStyleSync";
import {
  CRASH_PANEL_TITLE_BAR,
  CRASH_PANEL_TITLE_COL,
  CRASH_PANEL_SUBTITLE_COL,
} from "@/lib/crashLabPanel";
import { bumpCrashLabZ } from "@/lib/crashLabZ";
import type { CrashStoryDoc, CrashStoryScene } from "@/lib/crashStoryTypes";
import type { ScriptVoiceGenResult } from "@/lib/scriptVoiceGen";
import type { ScriptVoiceProgress } from "@/lib/scriptVoiceProgress";
import type { VoiceQuota } from "@/lib/elevenQuota";

const VOICE_MIN_W = 360;
const VOICE_MIN_H = 320;

export function CrashScriptVoiceCard() {
  const activeStyle = useCrashActiveStyle();
  const {
    geom,
    collapsed,
    togglePanel,
    setGeom,
    hideOnNarrowStack,
  } = useCrashDeskMode("script-voice", {
    minW: VOICE_MIN_W,
    minH: VOICE_MIN_H,
  });

  const [z, setZ] = useState(40);
  const [story, setStory] = useState<CrashStoryDoc | null>(null);
  const [folderName, setFolderName] = useState<string | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [quota, setQuota] = useState<VoiceQuota | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<ScriptVoiceProgress | null>(null);
  const [result, setResult] = useState<ScriptVoiceGenResult | null>(null);
  const [genError, setGenError] = useState("");

  const bringFront = useCallback(() => {
    setZ(bumpCrashLabZ());
  }, []);

  const { startMove } = usePanelPointerDrag({
    geom,
    setGeom,
    minW: VOICE_MIN_W,
    minH: VOICE_MIN_H,
    bringFront,
  });

  const load = useCallback(async () => {
    const url = crashDeskStoryFetchUrl(activeStyle);
    if (!url) {
      setStory(null);
      setSelectedSceneId(null);
      setFolderName(null);
      return;
    }
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok && data.story) {
        const doc = data.story as CrashStoryDoc;
        setStory(doc);
        setSelectedSceneId((prev) =>
          prev && doc.scenes.some((s) => s.id === prev) ? prev : doc.scenes[0]?.id ?? null,
        );
      }
    } catch {
      /* ignore */
    }
    const ep = readActiveEpisode();
    setFolderName(ep && ep.styleId === activeStyle ? ep.folderName : null);
  }, [activeStyle]);

  const loadQuota = useCallback(async () => {
    try {
      const res = await fetch("/api/crash/voice-quota");
      const data = await res.json();
      if (res.ok && data.quota) setQuota(data.quota as VoiceQuota);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void load();
    void loadQuota();
  }, [load, loadQuota]);

  useEffect(() => {
    const onChange = () => void load();
    window.addEventListener(CRASH_STORY_SAVED, onChange);
    window.addEventListener(CRASH_ACTIVE_EPISODE_EVENT, onChange);
    return () => {
      window.removeEventListener(CRASH_STORY_SAVED, onChange);
      window.removeEventListener(CRASH_ACTIVE_EPISODE_EVENT, onChange);
    };
  }, [load]);

  useEffect(() => {
    if (!busy) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch("/api/crash/script/voice-progress");
        const data = await res.json();
        if (!cancelled && data.progress) setProgress(data.progress);
      } catch {
        /* next tick tries again */
      }
    };
    void poll();
    const id = window.setInterval(poll, 1500);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [busy]);

  const handleGenerate = useCallback(async () => {
    if (busy || !folderName) return;
    setBusy(true);
    setProgress(null);
    setResult(null);
    setGenError("");
    try {
      const res = await fetch("/api/crash/script/voice/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ styleId: activeStyle, folderName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Voice generation failed");
      setResult(data as ScriptVoiceGenResult);
      dispatchStorySaved();
      void load();
      void loadQuota();
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "Voice generation failed");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }, [busy, folderName, activeStyle, load, loadQuota]);

  const scenes = story?.scenes || [];
  const selectedScene: CrashStoryScene | null =
    scenes.find((s) => s.id === selectedSceneId) || null;

  if (hideOnNarrowStack) return null;

  const quotaOut = Boolean(quota && quota.remaining <= 0);

  return (
    <div
      style={{
        position: "absolute",
        left: `${geom.x}px`,
        top: `${geom.y}px`,
        width: `${geom.w}px`,
        height: `${geom.h}px`,
        backgroundColor: "#1a1a1a",
        border: "1px solid #333",
        borderRadius: "4px",
        display: "flex",
        flexDirection: "column",
        zIndex: z,
      }}
    >
      {/* Title bar */}
      <div
        onPointerDown={startMove}
        style={{
          height: CRASH_PANEL_TITLE_BAR,
          padding: "0 8px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: CRASH_PANEL_TITLE_COL,
          borderBottom: "1px solid #333",
          cursor: "grab",
          userSelect: "none",
        }}
      >
        <div>
          <div style={{ color: "#fff", fontSize: "12px", fontWeight: 600 }}>
            Voice gen
          </div>
          <div
            style={{
              color: CRASH_PANEL_SUBTITLE_COL,
              fontSize: "10px",
              marginTop: "2px",
            }}
          >
            {story ? story.campaignLabel : "No episode open"}
          </div>
        </div>
        <div style={{ display: "flex", gap: "4px" }}>
          <CrashLabCollapseBtn collapsed={collapsed} onToggle={togglePanel} />
        </div>
      </div>

      {!collapsed && (
        <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>
          {/* Quota strip */}
          <div
            style={{
              padding: "8px 12px",
              borderBottom: "1px solid #333",
              backgroundColor: "#0a0a0a",
              color: quotaOut ? "#e0a030" : "#888",
              fontSize: "10px",
            }}
          >
            {quota
              ? `Voice designs this month: ${quota.count}/${quota.limit}${quotaOut ? " — quota used up" : ""}`
              : "Voice design quota — loading…"}
          </div>

          {!story || !scenes.length ? (
            <div style={{ padding: "12px", color: "#666", fontSize: "11px", textAlign: "center" }}>
              Open an episode (Script upload → Import, or Open episode) to
              generate voices
            </div>
          ) : (
            <>
              {/* Generate button */}
              <div
                style={{
                  padding: "10px 12px",
                  borderBottom: "1px solid #333",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                }}
              >
                <button
                  type="button"
                  onClick={() => void handleGenerate()}
                  disabled={busy || !folderName || quotaOut}
                  style={{
                    padding: "8px",
                    backgroundColor: busy || quotaOut ? "#333" : "#1a3a1a",
                    color: quotaOut ? "#666" : "#8fef8f",
                    border: "1px solid #2a5a2a",
                    borderRadius: "3px",
                    fontSize: "10px",
                    cursor: busy || !folderName || quotaOut ? "default" : "pointer",
                  }}
                >
                  {busy
                    ? progress
                      ? `${progress.phase} ${progress.current}/${progress.total} — ${progress.label}`
                      : "Starting…"
                    : quotaOut
                      ? "Quota used up this month"
                      : "Generate all voices"}
                </button>
                {genError ? (
                  <div style={{ color: "#e05050", fontSize: "10px" }}>{genError}</div>
                ) : null}
                {result ? (
                  <div style={{ color: "#888", fontSize: "9px", lineHeight: 1.4 }}>
                    Cast: {result.cast.filter((r) => r.ok).length}/{result.cast.length} ·
                    {" "}Lines: {result.lines.filter((r) => r.ok).length}/{result.lines.length}
                    {result.quotaExceeded ? " · quota ran out mid-batch" : ""}
                  </div>
                ) : null}
              </div>

              {/* Scenes list */}
              <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>
                {scenes.map((scene) => {
                  const lines = scene.shots.reduce((n, sh) => n + sh.beats.length, 0);
                  const voiced = scene.shots.reduce(
                    (n, sh) => n + sh.beats.filter((b) => b.voiceFile?.trim()).length,
                    0,
                  );
                  return (
                    <div
                      key={scene.id}
                      onClick={() => setSelectedSceneId(scene.id)}
                      style={{
                        padding: "8px 12px",
                        borderBottom: "1px solid #222",
                        backgroundColor:
                          selectedSceneId === scene.id ? "#1a2f4a" : "transparent",
                        cursor: "pointer",
                        transition: "background-color 200ms",
                      }}
                    >
                      <div
                        style={{
                          color: "#42a5f5",
                          fontSize: "9px",
                          fontFamily: "monospace",
                          marginBottom: "2px",
                        }}
                      >
                        {scene.title}
                      </div>
                      <div style={{ color: "#aaa", fontSize: "10px" }}>
                        {voiced}/{lines} line(s) voiced
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Scene detail — beats with inline audio */}
              {selectedScene && (
                <div
                  style={{
                    borderTop: "1px solid #333",
                    padding: "12px",
                    backgroundColor: "#0a0a0a",
                    maxHeight: "220px",
                    overflow: "auto",
                    fontSize: "9px",
                  }}
                >
                  {selectedScene.shots.map((shot) => (
                    <div key={shot.id} style={{ marginBottom: "10px" }}>
                      {shot.beats.map((beat) => (
                        <div
                          key={beat.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            marginBottom: "4px",
                          }}
                        >
                          {beat.voiceFile?.trim() ? (
                            <BeatAudioMini
                              compact
                              src={`/api/crash/story/speak?styleId=${encodeURIComponent(activeStyle)}&beatId=${encodeURIComponent(beat.id)}&f=${encodeURIComponent(beat.voiceFile)}`}
                            />
                          ) : (
                            <span style={{ color: "#555", width: "20px", textAlign: "center" }}>
                              —
                            </span>
                          )}
                          <span style={{ color: "#51cf66", fontWeight: 600, flexShrink: 0 }}>
                            {beat.speaker}:
                          </span>
                          <span style={{ color: "#aaa", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {beat.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
