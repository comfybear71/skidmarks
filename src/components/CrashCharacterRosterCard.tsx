"use client";

import { useCallback, useEffect, useState } from "react";
import { Btn } from "@/components/ui";
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
import type { ScriptCharacterData } from "@/lib/types";

const ROSTER_MIN_W = 320;
const ROSTER_MIN_H = 240;

type RosterChar = ScriptCharacterData & { tempVoiceType?: string };

export function CrashCharacterRosterCard() {
  const { activeShow } = useActiveShow();
  const {
    geom,
    collapsed,
    mode,
    togglePanel,
    setGeom,
    hideOnNarrowStack,
  } = useCrashDeskMode("character-roster", {
    minW: ROSTER_MIN_W,
    minH: ROSTER_MIN_H,
  });

  const [z, setZ] = useState(40);
  const [characters, setCharacters] = useState<RosterChar[]>([]);
  const [selectedChar, setSelectedChar] = useState<string | null>(null);
  const [editingVoiceType, setEditingVoiceType] = useState("");

  const bringFront = useCallback(() => {
    setZ(bumpCrashLabZ());
  }, []);

  const { startMove } = usePanelPointerDrag({
    geom,
    setGeom,
    minW: ROSTER_MIN_W,
    minH: ROSTER_MIN_H,
    bringFront,
  });

  // Listen for script parse events
  useEffect(() => {
    const handleScriptParsed = (
      e: Event,
    ) => {
      const evt = e as CustomEvent;
      if (evt.detail?.characters) {
        setCharacters(evt.detail.characters);
        if (evt.detail.characters.length > 0) {
          setSelectedChar(evt.detail.characters[0].name);
        }
      }
    };

    window.addEventListener("crash-script-parsed", handleScriptParsed);
    return () => {
      window.removeEventListener("crash-script-parsed", handleScriptParsed);
    };
  }, []);

  const handleVoiceTypeChange = useCallback(
    (name: string, voiceType: string) => {
      setCharacters((prev) =>
        prev.map((c) =>
          c.name === name ? { ...c, tempVoiceType: voiceType } : c,
        ),
      );
    },
    [],
  );

  const handleSave = useCallback(() => {
    // Dispatch event with final roster
    const finalRoster = characters.map((c) => ({
      ...c,
      voiceType: c.tempVoiceType || c.voiceType,
    }));

    window.dispatchEvent(
      new CustomEvent("crash-roster-saved", {
        detail: { characters: finalRoster },
      }),
    );
  }, [characters]);

  const selectedCharData = characters.find((c) => c.name === selectedChar);

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
            Character Roster
          </div>
          <div
            style={{
              color: CRASH_PANEL_SUBTITLE_COL,
              fontSize: "10px",
              marginTop: "2px",
            }}
          >
            {characters.length} character{characters.length !== 1 ? "s" : ""}
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
          {characters.length === 0 ? (
            <div
              style={{
                padding: "12px",
                color: "#666",
                fontSize: "11px",
                textAlign: "center",
              }}
            >
              Parse a script to see characters
            </div>
          ) : (
            <>
              {/* Character list */}
              <div
                style={{
                  borderRight: "1px solid #333",
                  maxWidth: "50%",
                  minWidth: "100px",
                  overflow: "auto",
                }}
              >
                {characters.map((char) => (
                  <div
                    key={char.name}
                    onClick={() => setSelectedChar(char.name)}
                    style={{
                      padding: "8px 12px",
                      borderBottom: "1px solid #222",
                      backgroundColor:
                        selectedChar === char.name ? "#0d47a1" : "transparent",
                      color: "#fff",
                      fontSize: "11px",
                      cursor: "pointer",
                      transition: "background-color 200ms",
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{char.name}</div>
                    <div style={{ color: "#888", fontSize: "9px" }}>
                      {char.voiceType || "—"}
                    </div>
                  </div>
                ))}
              </div>

              {/* Detail panel */}
              {selectedCharData && (
                <div
                  style={{
                    flex: 1,
                    padding: "12px",
                    overflow: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                  }}
                >
                  <div>
                    <label style={{ color: "#666", fontSize: "10px" }}>
                      Name
                    </label>
                    <div style={{ color: "#fff", fontSize: "11px" }}>
                      {selectedCharData.name}
                    </div>
                  </div>

                  <div>
                    <label style={{ color: "#666", fontSize: "10px" }}>
                      Voice Type
                    </label>
                    <input
                      type="text"
                      value={
                        selectedCharData.tempVoiceType ||
                        selectedCharData.voiceType ||
                        ""
                      }
                      onChange={(e) =>
                        handleVoiceTypeChange(selectedCharData.name, e.target.value)
                      }
                      placeholder="e.g., gruff-male-40s"
                      style={{
                        width: "100%",
                        padding: "6px",
                        backgroundColor: "#222",
                        color: "#fff",
                        border: "1px solid #333",
                        borderRadius: "3px",
                        fontSize: "10px",
                        marginTop: "4px",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ color: "#666", fontSize: "10px" }}>
                      Appearance
                    </label>
                    <div
                      style={{
                        color: "#aaa",
                        fontSize: "10px",
                        backgroundColor: "#0a0a0a",
                        padding: "8px",
                        borderRadius: "3px",
                        lineHeight: "1.4",
                        maxHeight: "80px",
                        overflow: "auto",
                      }}
                    >
                      {selectedCharData.appearance || "—"}
                    </div>
                  </div>

                  <div>
                    <label style={{ color: "#666", fontSize: "10px" }}>
                      Description
                    </label>
                    <div
                      style={{
                        color: "#aaa",
                        fontSize: "10px",
                        backgroundColor: "#0a0a0a",
                        padding: "8px",
                        borderRadius: "3px",
                        lineHeight: "1.4",
                        maxHeight: "100px",
                        overflow: "auto",
                      }}
                    >
                      {selectedCharData.description || "—"}
                    </div>
                  </div>

                  <Btn
                    onClick={handleSave}
                    style={{ marginTop: "auto" }}
                  >
                    Save Roster
                  </Btn>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
