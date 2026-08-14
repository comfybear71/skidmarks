"use client";

import { useCallback, useEffect, useState } from "react";
import { CrashLabCollapseBtn } from "@/components/CrashLabCollapseBtn";
import { useCrashDeskMode } from "@/hooks/useCrashDeskMode";
import { usePanelPointerDrag } from "@/hooks/usePanelPointerDrag";
import { useActiveShow } from "@/hooks/useActiveShow";
import {
  CRASH_PANEL_TITLE_BAR,
  CRASH_PANEL_TITLE_COL,
  CRASH_PANEL_SUBTITLE_COL,
} from "@/lib/crashLabPanel";
import { bumpCrashLabZ } from "@/lib/crashLabZ";
import type { ProductionScript, ScriptSceneData } from "@/lib/types";

const STORYBOARD_MIN_W = 360;
const STORYBOARD_MIN_H = 280;

export function CrashScriptStoryboardCard() {
  const { activeShow } = useActiveShow();
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
  const [script, setScript] = useState<ProductionScript | null>(null);
  const [selectedAct, setSelectedAct] = useState<number>(1);
  const [selectedScene, setSelectedScene] = useState<ScriptSceneData | null>(
    null,
  );

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

  // Listen for script parse events
  useEffect(() => {
    const handleScriptParsed = (e: Event) => {
      const evt = e as CustomEvent;
      if (evt.detail?.script) {
        setScript(evt.detail.script);
        if (evt.detail.script.parsedEpisodes?.[0]) {
          const firstScene =
            evt.detail.script.parsedEpisodes[0].scenes?.[0];
          if (firstScene) {
            setSelectedAct(firstScene.act);
            setSelectedScene(firstScene);
          }
        }
      }
    };

    window.addEventListener("crash-script-parsed", handleScriptParsed);
    return () => {
      window.removeEventListener("crash-script-parsed", handleScriptParsed);
    };
  }, []);

  const episodes = script?.parsedEpisodes || [];
  const currentEpisode = episodes[0];
  const allScenes = currentEpisode?.scenes || [];
  const acts = Array.from(new Set(allScenes.map((s) => s.act))).sort(
    (a, b) => a - b,
  );
  const scenesInAct = allScenes.filter((s) => s.act === selectedAct);

  const actLabels: Record<number, string> = {
    1: "Act I",
    2: "Act II",
    3: "Act III",
    4: "Act IV",
    5: "Act V",
  };

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
            {currentEpisode
              ? `Ep ${currentEpisode.episodeNum}: ${currentEpisode.title}`
              : "No episode"}
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
          {!currentEpisode ? (
            <div
              style={{
                padding: "12px",
                color: "#666",
                fontSize: "11px",
                textAlign: "center",
              }}
            >
              Parse a script to see storyboard
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
                  {currentEpisode.logline || "No logline"}
                </div>
              </div>

              {/* Act tabs */}
              <div
                style={{
                  display: "flex",
                  borderBottom: "1px solid #333",
                  backgroundColor: "#111",
                  overflowX: "auto",
                }}
              >
                {acts.map((act) => (
                  <button
                    key={act}
                    onClick={() => {
                      setSelectedAct(act);
                      setSelectedScene(scenesInAct[0] || null);
                    }}
                    style={{
                      padding: "8px 12px",
                      backgroundColor:
                        selectedAct === act ? "#0d47a1" : "transparent",
                      color: "#fff",
                      border: "none",
                      borderBottom:
                        selectedAct === act ? "2px solid #42a5f5" : "none",
                      cursor: "pointer",
                      fontSize: "10px",
                      fontWeight: selectedAct === act ? 600 : 400,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {actLabels[act] || `Act ${act}`}
                  </button>
                ))}
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
                {scenesInAct.map((scene, i) => (
                  <div
                    key={i}
                    onClick={() => setSelectedScene(scene)}
                    style={{
                      padding: "8px 12px",
                      borderBottom: "1px solid #222",
                      backgroundColor:
                        selectedScene === scene ? "#1a2f4a" : "transparent",
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
                      {scene.heading}
                    </div>
                    <div style={{ color: "#aaa", fontSize: "10px" }}>
                      {scene.dialogueLines.length} lines
                    </div>
                  </div>
                ))}
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
                    <strong>{selectedScene.heading}</strong>
                  </div>

                  {selectedScene.action.length > 0 && (
                    <div style={{ marginBottom: "8px" }}>
                      <div style={{ color: "#666", marginBottom: "4px" }}>
                        ACTION:
                      </div>
                      <div style={{ color: "#aaa", lineHeight: "1.4" }}>
                        {selectedScene.action.slice(0, 3).join(" ")}
                        {selectedScene.action.length > 3 && "…"}
                      </div>
                    </div>
                  )}

                  {selectedScene.dialogueLines.length > 0 && (
                    <div>
                      <div style={{ color: "#666", marginBottom: "4px" }}>
                        DIALOGUE:
                      </div>
                      <div style={{ color: "#aaa", lineHeight: "1.6" }}>
                        {selectedScene.dialogueLines.slice(0, 2).map((d, i) => (
                          <div key={i}>
                            <span style={{ color: "#51cf66", fontWeight: 600 }}>
                              {d.character}
                            </span>
                            <br />
                            "{d.line}"
                          </div>
                        ))}
                        {selectedScene.dialogueLines.length > 2 && (
                          <div style={{ color: "#666" }}>
                            +{selectedScene.dialogueLines.length - 2} more…
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
