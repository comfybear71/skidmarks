"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { Btn } from "@/components/ui";
import { CrashLabCollapseBtn } from "@/components/CrashLabCollapseBtn";
import { useCrashDeskMode } from "@/hooks/useCrashDeskMode";
import { usePanelPointerDrag } from "@/hooks/usePanelPointerDrag";
import { useFaceLayerDrag, type FaceLayerGeom } from "@/hooks/useFaceLayerDrag";
import { useCrashActiveStyle } from "@/hooks/useCrashActiveStyle";
import {
  CRASH_ACTIVE_EPISODE_EVENT,
  crashDeskStoryFetchUrl,
} from "@/lib/crashActiveEpisode";
import { CRASH_STORY_SAVED, dispatchStorySaved } from "@/lib/crashStyleSync";
import { bumpCrashLabZ } from "@/lib/crashLabZ";
import type { CrashStoryDoc, CrashStoryScene, CrashStoryShot } from "@/lib/crashStoryTypes";
import type { Character } from "@/lib/types";

const COMPOSITOR_MIN_W = 420;
const COMPOSITOR_MIN_H = 520;

// Fixed preview frame — matches buildShotPlatePrompt's existing "Wide shot,
// 768 by 512" convention, so on-screen coordinates are the real output
// pixels and Save as plate needs no scale-correction math.
const FRAME_W = 768;
const FRAME_H = 512;
const BASE_FACE_W = 190;

type FaceLayer = {
  characterId: string;
  name: string;
  attemptId: string;
  geom: FaceLayerGeom;
  naturalW: number;
  naturalH: number;
};

function defaultLayerGeom(index: number, count: number): FaceLayerGeom {
  const usable = Math.max(0, FRAME_W - BASE_FACE_W - 40);
  const x =
    count > 1 ? 20 + (usable * index) / (count - 1) : (FRAME_W - BASE_FACE_W) / 2;
  return { x, y: FRAME_H - BASE_FACE_W * 1.25 - 24, scale: 1 };
}

function FaceLayerImg({
  layer,
  onGeomChange,
}: {
  layer: FaceLayer;
  onGeomChange: (geom: FaceLayerGeom) => void;
}) {
  const { startMove, startScale } = useFaceLayerDrag({
    geom: layer.geom,
    setGeom: onGeomChange,
  });
  const w = BASE_FACE_W * layer.geom.scale;
  const h =
    layer.naturalW > 0
      ? (w * layer.naturalH) / layer.naturalW
      : w;

  return (
    <div
      onPointerDown={startMove}
      style={{
        position: "absolute",
        left: `${layer.geom.x}px`,
        top: `${layer.geom.y}px`,
        width: `${w}px`,
        height: `${h}px`,
        cursor: "grab",
        touchAction: "none",
      }}
    >
      <img
        src={`/api/characters/${layer.characterId}/faces/${layer.attemptId}`}
        alt={layer.name}
        draggable={false}
        style={{ width: "100%", height: "100%", objectFit: "cover", userSelect: "none" }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-4px",
          left: "50%",
          fontSize: "8px",
          color: "#fff",
          background: "rgba(0,0,0,0.6)",
          padding: "1px 4px",
          borderRadius: "2px",
          transform: "translate(-50%, 100%)",
          whiteSpace: "nowrap",
          pointerEvents: "none",
        }}
      >
        {layer.name}
      </div>
      <div
        onPointerDown={startScale}
        style={{
          position: "absolute",
          right: "-6px",
          bottom: "-6px",
          width: "14px",
          height: "14px",
          borderRadius: "50%",
          background: "#42a5f5",
          border: "2px solid #fff",
          cursor: "nwse-resize",
          touchAction: "none",
        }}
      />
    </div>
  );
}

export function CrashCompositorCard() {
  const activeStyle = useCrashActiveStyle();
  const {
    geom,
    collapsed,
    togglePanel,
    setGeom,
    hideOnNarrowStack,
  } = useCrashDeskMode("compositor", {
    minW: COMPOSITOR_MIN_W,
    minH: COMPOSITOR_MIN_H,
  });

  const [z, setZ] = useState(40);
  const [story, setStory] = useState<CrashStoryDoc | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [selectedShotId, setSelectedShotId] = useState<string | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [layers, setLayers] = useState<FaceLayer[]>([]);
  const [missingSpeakers, setMissingSpeakers] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const frameRef = useRef<HTMLDivElement>(null);

  const bringFront = useCallback(() => {
    setZ(bumpCrashLabZ());
  }, []);

  const { startMove } = usePanelPointerDrag({
    geom,
    setGeom,
    minW: COMPOSITOR_MIN_W,
    minH: COMPOSITOR_MIN_H,
    bringFront,
  });

  const load = useCallback(async () => {
    const url = crashDeskStoryFetchUrl(activeStyle);
    if (!url) {
      setStory(null);
      setSelectedSceneId(null);
      setSelectedShotId(null);
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

  useEffect(() => {
    fetch("/api/characters")
      .then((r) => r.json())
      .then((data) => setCharacters(data.characters || []))
      .catch(() => {});
  }, []);

  const scenes = story?.scenes || [];
  const selectedScene: CrashStoryScene | null =
    scenes.find((s) => s.id === selectedSceneId) || null;
  const shots = selectedScene?.shots || [];
  const selectedShot: CrashStoryShot | null =
    shots.find((sh) => sh.id === selectedShotId) || shots[0] || null;

  // Rebuild face layers (default positions) whenever the selected shot
  // changes — one layer per unique speaker with an approved face.
  useEffect(() => {
    if (!selectedShot) {
      setLayers([]);
      setMissingSpeakers([]);
      return;
    }
    const speakers = [
      ...new Set(selectedShot.beats.map((b) => b.speaker.trim()).filter(Boolean)),
    ];
    const found: FaceLayer[] = [];
    const missing: string[] = [];
    speakers.forEach((speaker, i) => {
      const character = characters.find(
        (c) => c.name.trim().toLowerCase() === speaker.toLowerCase(),
      );
      if (!character || !character.approvedFaceId) {
        missing.push(speaker);
        return;
      }
      found.push({
        characterId: character.id,
        name: character.name,
        attemptId: character.approvedFaceId,
        geom: defaultLayerGeom(found.length, speakers.length),
        naturalW: 0,
        naturalH: 0,
      });
    });
    setLayers(found);
    setMissingSpeakers(missing);
    setSaveMsg("");
  }, [selectedShot, characters]);

  const updateLayerGeom = useCallback((characterId: string, geom: FaceLayerGeom) => {
    setLayers((prev) =>
      prev.map((l) => (l.characterId === characterId ? { ...l, geom } : l)),
    );
  }, []);

  const noteNaturalSize = useCallback(
    (characterId: string, w: number, h: number) => {
      setLayers((prev) =>
        prev.map((l) =>
          l.characterId === characterId && !l.naturalW
            ? { ...l, naturalW: w, naturalH: h }
            : l,
        ),
      );
    },
    [],
  );

  const saveAsPlate = useCallback(async () => {
    if (!story || !selectedScene || !selectedShot || saving) return;
    setSaving(true);
    setSaveMsg("");
    try {
      const canvas = document.createElement("canvas");
      canvas.width = FRAME_W;
      canvas.height = FRAME_H;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable");

      if (selectedScene.worldThumbKey) {
        const bg = await loadImage(
          `/api/crash/world-cards/file?styleId=${encodeURIComponent(activeStyle)}&thumb=${encodeURIComponent(selectedScene.worldThumbKey)}`,
        );
        // object-fit: cover onto the fixed frame
        const scale = Math.max(FRAME_W / bg.width, FRAME_H / bg.height);
        const dw = bg.width * scale;
        const dh = bg.height * scale;
        ctx.drawImage(bg, (FRAME_W - dw) / 2, (FRAME_H - dh) / 2, dw, dh);
      } else {
        ctx.fillStyle = "#222";
        ctx.fillRect(0, 0, FRAME_W, FRAME_H);
      }

      for (const layer of layers) {
        const img = await loadImage(
          `/api/characters/${layer.characterId}/faces/${layer.attemptId}`,
        );
        const w = BASE_FACE_W * layer.geom.scale;
        const h = (w * img.height) / img.width;
        ctx.drawImage(img, layer.geom.x, layer.geom.y, w, h);
      }

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (!blob) throw new Error("Could not export image");

      const form = new FormData();
      form.append("file", blob, "plate.png");
      form.append("styleId", activeStyle);
      form.append("castNames", JSON.stringify(layers.map((l) => l.name)));
      form.append("placeName", selectedScene.placeName || "");

      const res = await fetch("/api/crash/script/plate/save", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok || !data.fileName) {
        setSaveMsg(data.error || "Save failed");
        return;
      }

      const nextScenes = story.scenes.map((sc) => {
        if (sc.id !== selectedScene.id) return sc;
        return {
          ...sc,
          shots: sc.shots.map((sh) =>
            sh.id === selectedShot.id ? { ...sh, plateFile: data.fileName } : sh,
          ),
        };
      });
      const nextStory: CrashStoryDoc = {
        ...story,
        scenes: nextScenes,
        updatedAt: new Date().toISOString(),
      };
      const putRes = await fetch("/api/crash/story", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ story: nextStory }),
      });
      if (!putRes.ok) {
        setSaveMsg("Plate saved but story update failed — try again");
        return;
      }
      setStory(nextStory);
      dispatchStorySaved();
      setSaveMsg("Saved as plate");
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [story, selectedScene, selectedShot, layers, activeStyle, saving]);

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
          padding: "6px 8px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: "#222",
          borderBottom: "1px solid #333",
          cursor: "grab",
          userSelect: "none",
        }}
      >
        <div>
          <div style={{ color: "#fff", fontSize: "12px", fontWeight: 600 }}>
            Compositor
          </div>
          <div style={{ color: "#888", fontSize: "10px", marginTop: "2px" }}>
            {selectedScene ? selectedScene.title : "No episode open"}
          </div>
        </div>
        <div style={{ display: "flex", gap: "4px" }}>
          <CrashLabCollapseBtn collapsed={collapsed} onToggle={togglePanel} />
        </div>
      </div>

      {!collapsed && (
        <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>
          {!story || !scenes.length ? (
            <div style={{ padding: "12px", color: "#666", fontSize: "11px", textAlign: "center" }}>
              Open an episode with a script-imported story to composite plates
            </div>
          ) : (
            <>
              {/* Scene / shot pickers */}
              <div style={{ display: "flex", gap: "6px", padding: "8px", borderBottom: "1px solid #333" }}>
                <select
                  value={selectedSceneId || ""}
                  onChange={(e) => {
                    setSelectedSceneId(e.target.value);
                    setSelectedShotId(null);
                  }}
                  style={selectStyle}
                >
                  {scenes.map((sc) => (
                    <option key={sc.id} value={sc.id}>
                      {sc.title}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedShot?.id || ""}
                  onChange={(e) => setSelectedShotId(e.target.value)}
                  style={selectStyle}
                >
                  {shots.map((sh) => (
                    <option key={sh.id} value={sh.id}>
                      {sh.title || sh.id}
                      {sh.plateFile ? " ✓" : ""}
                    </option>
                  ))}
                </select>
              </div>

              {!selectedScene?.worldThumbKey ? (
                <div style={{ padding: "8px 12px", color: "#e0a030", fontSize: "10px" }}>
                  This scene has no location image yet — run Stage 1 image
                  generation first for a real background.
                </div>
              ) : null}

              {missingSpeakers.length > 0 ? (
                <div style={{ padding: "8px 12px", color: "#e0a030", fontSize: "10px" }}>
                  Approve a face for {missingSpeakers.join(", ")} in Character
                  Lab first — not composited yet.
                </div>
              ) : null}

              {/* Preview frame */}
              <div style={{ padding: "12px", display: "flex", justifyContent: "center" }}>
                <div
                  ref={frameRef}
                  style={{
                    position: "relative",
                    width: `${FRAME_W}px`,
                    height: `${FRAME_H}px`,
                    maxWidth: "100%",
                    aspectRatio: `${FRAME_W} / ${FRAME_H}`,
                    backgroundColor: "#000",
                    overflow: "hidden",
                    border: "1px solid #333",
                  }}
                >
                  {selectedScene?.worldThumbKey ? (
                    <img
                      src={`/api/crash/world-cards/file?styleId=${encodeURIComponent(activeStyle)}&thumb=${encodeURIComponent(selectedScene.worldThumbKey)}`}
                      alt="Background"
                      draggable={false}
                      style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        userSelect: "none",
                      }}
                    />
                  ) : null}
                  {layers.map((layer) => (
                    <FaceLayerImgWithLoad
                      key={layer.characterId}
                      layer={layer}
                      onGeomChange={(g) => updateLayerGeom(layer.characterId, g)}
                      onNaturalSize={(w, h) => noteNaturalSize(layer.characterId, w, h)}
                    />
                  ))}
                </div>
              </div>

              <div style={{ padding: "0 12px 12px", display: "flex", alignItems: "center", gap: "8px" }}>
                <Btn onClick={() => void saveAsPlate()} disabled={saving || !layers.length}>
                  {saving ? "Saving…" : "Save as plate"}
                </Btn>
                {saveMsg ? (
                  <span style={{ color: "#888", fontSize: "10px" }}>{saveMsg}</span>
                ) : null}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const selectStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  backgroundColor: "#222",
  color: "#fff",
  border: "1px solid #333",
  borderRadius: "3px",
  fontSize: "10px",
  padding: "4px",
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${src}`));
    img.src = src;
  });
}

/** Wraps FaceLayerImg to report natural image size back up once loaded. */
function FaceLayerImgWithLoad({
  layer,
  onGeomChange,
  onNaturalSize,
}: {
  layer: FaceLayer;
  onGeomChange: (geom: FaceLayerGeom) => void;
  onNaturalSize: (w: number, h: number) => void;
}) {
  const reportedRef = useRef(false);
  useEffect(() => {
    reportedRef.current = false;
  }, [layer.characterId, layer.attemptId]);
  return (
    <div
      onLoadCapture={(e) => {
        const img = e.target as HTMLImageElement;
        if (!reportedRef.current && img.naturalWidth) {
          reportedRef.current = true;
          onNaturalSize(img.naturalWidth, img.naturalHeight);
        }
      }}
    >
      <FaceLayerImg layer={layer} onGeomChange={onGeomChange} />
    </div>
  );
}
