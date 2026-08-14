"use client";

import { useCallback, useEffect, useState } from "react";
import { CrashLabCollapseBtn } from "@/components/CrashLabCollapseBtn";
import { useCrashDeskMode } from "@/hooks/useCrashDeskMode";
import { usePanelPointerDrag } from "@/hooks/usePanelPointerDrag";
import { useCrashActiveStyle } from "@/hooks/useCrashActiveStyle";
import {
  CRASH_ACTIVE_EPISODE_EVENT,
  crashDeskStoryFetchUrl,
} from "@/lib/crashActiveEpisode";
import { CRASH_STORY_SAVED } from "@/lib/crashStyleSync";
import {
  CRASH_PANEL_TITLE_BAR,
  CRASH_PANEL_TITLE_COL,
  CRASH_PANEL_SUBTITLE_COL,
} from "@/lib/crashLabPanel";
import { bumpCrashLabZ } from "@/lib/crashLabZ";
import type { CrashStoryDoc, CrashStoryScene } from "@/lib/crashStoryTypes";

const STORYBOARD_MIN_W = 360;
const STORYBOARD_MIN_H = 280;

export function CrashScriptStoryboardCard() {
  const activeStyle = useCrashActiveStyle();
  const {
    geom,
    collapsed,
    mode,
    togglePanel,
    setGeom,
    hideOnNarrowStack,
  } = useCrashDeskMode("script-storyboard", {
    minW: STORYBOARD_MIN_W,
    minH: STORYBOARD_MIN_H,
  });

  const [z, setZ] = useState(40);
  const [story, setStory] = useState<CrashStoryDoc | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);

  const bringFront = useCallback(() => {
    setZ(bumpCrashLabZ());
  }, []);

  const { startMove } = usePanelPointerDrag({
    geom,
    setGeom,
    minW: STORYBOARD_MIN_W,
    minH: STORYBOARD_MIN_H,
    bringFront,
  });

  // Read the real, persisted story for whatever episode is currently open —
  // same source Storyboard/Animate/Populate use — instead of the ephemeral
  // "just parsed, not saved anywhere" preview this panel started as.
  const load = useCallback(async () => {
    const url = crashDeskStoryFetchUrl(activeStyle);
    if (!url) {
      setStory(null);
      setSelectedSceneId(null);
      return;
    }
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok && data.story) {
        setStory(data.story as CrashStoryDoc);
        setSelectedSceneId((data.story as CrashStoryDoc).scenes[0]?.id ?? null);
      }
    } catch {
      /* ignore */
    }
  }, [activeStyle]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onChange = () => void load();
    window.addEventListener(CRASH_STORY_SAVED, onChange);
    window.addEventListener(CRASH_ACTIVE_EPISODE_EVENT, onChange);
    return () => {
      window.removeEventListener(CRASH_STORY_SAVED, onChange);
      window.removeEventListener(CRASH_ACTIVE_EPISODE_EVENT, onChange);
    };
  }, [load]);

  const scenes = story?.scenes || [];
  const selectedScene: CrashStoryScene | null =
    scenes.find((s) => s.id === selectedSceneId) || null;

  if (hideOnNarrowStack) return null;

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
            Storyboard
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
          <CrashLabCollapseBtn
            collapsed={collapsed}
            onToggle={togglePanel}
          />
        </div>
      </div>

      {/* Content */}
      {!collapsed && (
        <div
          style={{
            flex: 1,
            overflow: "auto",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {!story || !scenes.length ? (
            <div
              style={{
                padding: "12px",
                color: "#666",
                fontSize: "11px",
                textAlign: "center",
              }}
            >
              Open an episode (Script upload → Import, or Open episode) to
              see its storyboard
            </div>
          ) : (
            <>
              {/* Episode info */}
              <div
                style={{
                  padding: "12px",
                  borderBottom: "1px solid #333",
                  backgroundColor: "#0a0a0a",
                }}
              >
                <div style={{ color: "#aaa", fontSize: "10px" }}>
                  {story.gagNote || "No logline"}
                </div>
              </div>

              {/* Scenes list */}
              <div
                style={{
                  flex: 1,
                  overflow: "auto",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {scenes.map((scene) => {
                  const lines = scene.shots.reduce(
                    (n, sh) => n + sh.beats.length,
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
                          selectedSceneId === scene.id
                            ? "#1a2f4a"
                            : "transparent",
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
                        {!scene.worldThumbKey ? " · no world card yet" : ""}
                      </div>
                      <div style={{ color: "#aaa", fontSize: "10px" }}>
                        {scene.shots.length} shot(s), {lines} line(s)
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Scene detail */}
              {selectedScene && (
                <div
                  style={{
                    borderTop: "1px solid #333",
                    padding: "12px",
                    backgroundColor: "#0a0a0a",
                    maxHeight: "180px",
                    overflow: "auto",
                    fontSize: "9px",
                  }}
                >
                  <div style={{ color: "#42a5f5", marginBottom: "8px" }}>
                    <strong>{selectedScene.title}</strong>
                  </div>

                  {selectedScene.shots.map((shot) => (
                    <div key={shot.id} style={{ marginBottom: "8px" }}>
                      {shot.summary ? (
                        <div style={{ color: "#aaa", lineHeight: "1.4", marginBottom: "4px" }}>
                          {shot.summary}
                        </div>
                      ) : null}
                      {shot.beats.length > 0 ? (
                        <div style={{ color: "#aaa", lineHeight: "1.6" }}>
                          {shot.beats.slice(0, 4).map((beat) => (
                            <div key={beat.id}>
                              <span style={{ color: "#51cf66", fontWeight: 600 }}>
                                {beat.speaker}
                              </span>
                              <br />
                              &quot;{beat.text}&quot;
                            </div>
                          ))}
                          {shot.beats.length > 4 && (
                            <div style={{ color: "#666" }}>
                              +{shot.beats.length - 4} more…
                            </div>
                          )}
                        </div>
                      ) : null}
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
