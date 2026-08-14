"use client";

import { useCallback, useEffect, useState } from "react";
import { Btn } from "@/components/ui";
import { CrashLabCollapseBtn } from "@/components/CrashLabCollapseBtn";
import { useCrashDeskMode } from "@/hooks/useCrashDeskMode";
import { usePanelPointerDrag } from "@/hooks/usePanelPointerDrag";
import { useCrashActiveStyle } from "@/hooks/useCrashActiveStyle";
import {
  CRASH_PANEL_TITLE_BAR,
  CRASH_PANEL_TITLE_COL,
  CRASH_PANEL_SUBTITLE_COL,
} from "@/lib/crashLabPanel";
import { bumpCrashLabZ } from "@/lib/crashLabZ";
import { dispatchStorySaved } from "@/lib/crashStyleSync";
import type { ImportedScriptEpisode } from "@/lib/scriptImport";
import type { ProductionScript } from "@/lib/types";

const SCRIPT_UPLOAD_MIN_W = 320;
const SCRIPT_UPLOAD_MIN_H = 240;

export function CrashScriptUploadCard() {
  const activeStyle = useCrashActiveStyle();
  const {
    geom,
    collapsed,
    mode,
    togglePanel,
    setGeom,
    hideOnNarrowStack,
  } = useCrashDeskMode("script-upload", {
    minW: SCRIPT_UPLOAD_MIN_W,
    minH: SCRIPT_UPLOAD_MIN_H,
  });

  const [z, setZ] = useState(40);
  const [scriptText, setScriptText] = useState("");
  const [title, setTitle] = useState("Episode 1");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [parsedScript, setParsedScript] = useState<ProductionScript | null>(
    null,
  );
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState<ImportedScriptEpisode[] | null>(null);
  const [importError, setImportError] = useState("");

  const bringFront = useCallback(() => {
    setZ(bumpCrashLabZ());
  }, []);

  const { startMove } = usePanelPointerDrag({
    geom,
    setGeom,
    minW: SCRIPT_UPLOAD_MIN_W,
    minH: SCRIPT_UPLOAD_MIN_H,
    bringFront,
  });

  const handleUpload = useCallback(async () => {
    if (!scriptText.trim()) {
      setError("Please paste script text");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/crash/script/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: scriptText,
          showSlug: activeStyle,
          title,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Upload failed");
      }

      const parsed = (await response.json()) as ProductionScript;
      setParsedScript(parsed);
      setImported(null);
      setImportError("");
      setSuccess(
        `Parsed ${parsed.parsedEpisodes.length} episode(s), ${parsed.parsedCharacters.length} character(s)`,
      );

      // Dispatch event for character roster panel
      window.dispatchEvent(
        new CustomEvent("crash-script-parsed", {
          detail: { script: parsed, characters: parsed.parsedCharacters },
        }),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to parse script",
      );
    } finally {
      setLoading(false);
    }
  }, [scriptText, title, activeStyle]);

  // Parsing above never touches disk/cloud — this is the step that turns
  // parsed episodes into real, durable Crash Lab episode packs.
  const handleImport = useCallback(async () => {
    if (!parsedScript?.parsedEpisodes.length || importing) return;
    setImporting(true);
    setImportError("");
    try {
      const res = await fetch("/api/crash/script/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          styleId: activeStyle,
          episodes: parsedScript.parsedEpisodes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      setImported(data.imported as ImportedScriptEpisode[]);
      dispatchStorySaved();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }, [parsedScript, activeStyle, importing]);

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
            Script Upload
          </div>
          <div
            style={{
              color: CRASH_PANEL_SUBTITLE_COL,
              fontSize: "10px",
              marginTop: "2px",
            }}
          >
            {activeStyle}
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
            padding: "12px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          {/* Show */}
          <div>
            <label style={{ color: "#666", fontSize: "11px" }}>Show</label>
            <div style={{ color: "#fff", fontSize: "12px" }}>{activeStyle}</div>
          </div>

          {/* Title */}
          <div>
            <label style={{ color: "#666", fontSize: "11px" }}>Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Episode title"
              style={{
                width: "100%",
                padding: "6px",
                backgroundColor: "#222",
                color: "#fff",
                border: "1px solid #333",
                borderRadius: "3px",
                fontSize: "11px",
              }}
            />
          </div>

          {/* Script text area */}
          <div>
            <label style={{ color: "#666", fontSize: "11px" }}>Script</label>
            <textarea
              value={scriptText}
              onChange={(e) => setScriptText(e.target.value)}
              placeholder="Paste your script here..."
              style={{
                width: "100%",
                height: "120px",
                padding: "6px",
                backgroundColor: "#222",
                color: "#fff",
                border: "1px solid #333",
                borderRadius: "3px",
                fontSize: "10px",
                fontFamily: "monospace",
                resize: "none",
              }}
            />
          </div>

          {/* Status messages */}
          {error && (
            <div
              style={{
                padding: "8px",
                backgroundColor: "#330000",
                color: "#ff6b6b",
                borderRadius: "3px",
                fontSize: "11px",
              }}
            >
              ✗ {error}
            </div>
          )}
          {success && (
            <div
              style={{
                padding: "8px",
                backgroundColor: "#003300",
                color: "#51cf66",
                borderRadius: "3px",
                fontSize: "11px",
              }}
            >
              ✓ {success}
            </div>
          )}

          {/* Parsed output */}
          {parsedScript && (
            <div
              style={{
                padding: "8px",
                backgroundColor: "#1f1f2e",
                border: "1px solid #333",
                borderRadius: "3px",
                fontSize: "10px",
              }}
            >
              <div style={{ color: "#888", marginBottom: "4px" }}>
                <strong>Parsed:</strong>
              </div>
              {parsedScript.parsedEpisodes.map((ep, i) => (
                <div key={i} style={{ color: "#aaa", marginBottom: "4px" }}>
                  <div>
                    Ep {ep.episodeNum}: <strong>{ep.title}</strong>
                  </div>
                  <div style={{ color: "#666", fontSize: "9px" }}>
                    {ep.scenes.length} scenes, {ep.scenes.reduce((acc, s) => acc + s.dialogueLines.length, 0)} lines
                  </div>
                </div>
              ))}
            </div>
          )}

          {importError && (
            <div
              style={{
                padding: "8px",
                backgroundColor: "#330000",
                color: "#ff6b6b",
                borderRadius: "3px",
                fontSize: "11px",
              }}
            >
              ✗ {importError}
            </div>
          )}
          {imported && (
            <div
              style={{
                padding: "8px",
                backgroundColor: "#003300",
                color: "#51cf66",
                borderRadius: "3px",
                fontSize: "10px",
              }}
            >
              <div style={{ marginBottom: "4px" }}>
                <strong>Imported {imported.length} episode(s) into {activeStyle}:</strong>
              </div>
              {imported.map((ep) => (
                <div key={ep.folderName} style={{ fontSize: "9px" }}>
                  {ep.folderName} — {ep.scenes} scenes, {ep.lines} lines
                </div>
              ))}
            </div>
          )}

          {/* Upload button */}
          <Btn
            onClick={handleUpload}
            disabled={loading || !scriptText.trim()}
            style={{
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "Parsing..." : "Upload & Parse"}
          </Btn>

          {/* Import button — parse above never touches disk; this creates real packs */}
          {parsedScript && parsedScript.parsedEpisodes.length > 0 ? (
            <Btn
              onClick={() => void handleImport()}
              disabled={importing}
              style={{
                marginTop: "auto",
                opacity: importing ? 0.6 : 1,
              }}
            >
              {importing
                ? "Importing…"
                : `Import ${parsedScript.parsedEpisodes.length} episode(s) as Crash Lab packs`}
            </Btn>
          ) : null}
        </div>
      )}
    </div>
  );
}
