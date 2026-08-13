"use client";

import { useEffect, useMemo, useState, type DragEvent } from "react";
import {
  CopyFieldShell,
  copyImageUrl,
  copyText,
  downloadUrl,
} from "@/components/CopyBits";
import { SaveEditHistory, VoiceHistoryList } from "@/components/SaveHistory";
import { SceneFlow } from "@/components/SceneFlow";
import { Btn, Field, Panel, Select, TextArea, TextInput } from "@/components/ui";
import type {
  Character,
  CrashMorphEntry,
  Episode,
  EpisodeCastMember,
  Location,
  Scene,
  Shot,
  ShotBeat,
  ShotRender,
} from "@/lib/types";
import {
  emptyBeat,
  ensureShotBeats,
  formatDuration,
  MAX_SHOT_BEATS,
  mirrorBeat0,
  MIN_SHOT_BEATS,
  pushSavedText,
} from "@/lib/types";

type Props = {
  episodeId: string;
  episode: Episode;
  scene: Scene;
  shot: Shot;
  victim: Character | null;
  locations: Location[];
  renderNote: string;
  uploading: boolean;
  /** After top Save — refresh last-saved under prompt boxes. */
  promptsSavedAt?: number;
  onRenderNote: (v: string) => void;
  onPatchShot: (fn: (sh: Shot) => Shot) => void;
  onDropFiles: (
    files: FileList | File[],
    dest?: "success" | "park",
    beatId?: string,
  ) => void;
  onSetRenderStatus: (
    renderId: string,
    next: "approved" | "parked" | "rejected" | "pending",
  ) => void;
  onStatus: (msg: string) => void;
  onError: (msg: string) => void;
  onEpisode: (ep: Episode) => void;
  onAttachPlacePlate: () => Promise<void>;
  /** Patch any shot in this scene (summary one-liners) */
  onPatchShotById: (shotId: string, fn: (sh: Shot) => Shot) => void;
  onOpenShot: (shotId: string) => void;
  /** Save episode to disk before Gen so on-screen prompts aren't wiped */
  onEnsureSaved?: () => Promise<void>;
};

type DiskSnap = {
  global: string;
  aiNudgeGlobal: string;
  cutUnder: string;
  resolveNotes: string;
  script: string;
  beats: Record<
    string,
    {
      platePrompt: string;
      imageMotion: string;
      textSegment: string;
      actionSegment: string;
      aiNudge: string;
    }
  >;
};

/** Every beat shut — the desk opens tidy, you open what you're working on. */
function allBeatsCollapsed(sh: Shot): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const b of ensureShotBeats(sh).beats) out[b.id] = true;
  return out;
}

/** Every beat open. */
function allBeatsOpen(sh: Shot): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const b of ensureShotBeats(sh).beats) out[b.id] = false;
  return out;
}

const BEATS_DEFAULT_KEY = "skidmarks.beatsDefaultOpen";

function readBeatsDefaultOpen(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(BEATS_DEFAULT_KEY) === "open";
  } catch {
    return false;
  }
}

function snapFromShot(sh: Shot): DiskSnap {
  const s = ensureShotBeats(sh);
  const beats: DiskSnap["beats"] = {};
  for (const b of s.beats) {
    beats[b.id] = {
      platePrompt: b.platePrompt || "",
      imageMotion: b.imageMotion || "",
      textSegment: b.textSegment || "",
      actionSegment: b.actionSegment || "",
      aiNudge: b.aiNudge || "",
    };
  }
  return {
    global: s.global || "",
    aiNudgeGlobal: s.aiNudgeGlobal || "",
    cutUnder: s.cutUnder || "",
    resolveNotes: s.resolveNotes || "",
    script: s.script || "",
    beats,
  };
}

function settingsLine(shot: Shot) {
  const beats = ensureShotBeats(shot).beats;
  const bits = beats.map((b, i) => {
    const act = (b.actionSegment || "").trim()
      ? ` · ACTION ${b.actionSeconds || 4}s`
      : "";
    return `B${i + 1}: IMAGE ${b.imageSeconds}s · TEXT ${b.textSeconds || 6}s${act}`;
  });
  return `${shot.width}×${shot.height} · Guide ${shot.guide} · ${bits.join(" · ")} · Inpaint ${shot.inpaintOff ? "OFF" : "ON"}`;
}

function RenderCard({
  episodeId,
  render,
  bucket,
  onMove,
}: {
  episodeId: string;
  render: ShotRender;
  bucket: "success" | "park";
  onMove: (next: "approved" | "parked") => void;
}) {
  return (
    <li className="rounded-sm border border-[var(--line)] bg-[var(--panel-2)] p-2">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="text-[var(--acid)]">{render.version}</span>
          {render.durationSeconds ? (
            <span className="ml-2 font-mono text-xs text-[var(--ok)]">
              {formatDuration(render.durationSeconds)}
            </span>
          ) : null}
          {render.note ? (
            <span className="ml-2 text-xs text-[var(--chrome-dim)]">
              {render.note}
            </span>
          ) : null}
        </div>
        {bucket === "success" ? (
          <Btn tone="magenta" onClick={() => onMove("parked")}>
            → Park
          </Btn>
        ) : (
          <Btn tone="ok" onClick={() => onMove("approved")}>
            → Keeper
          </Btn>
        )}
      </div>
      <video
        controls
        src={`/api/episodes/${episodeId}/renders/${render.id}`}
        className="max-h-44 w-full rounded-sm bg-black"
      />
    </li>
  );
}

export function ShotDesk({
  episodeId,
  episode,
  scene,
  shot: shotProp,
  victim,
  locations,
  renderNote,
  uploading,
  promptsSavedAt = 0,
  onRenderNote,
  onPatchShot,
  onDropFiles,
  onSetRenderStatus,
  onStatus,
  onError,
  onEpisode,
  onAttachPlacePlate,
  onPatchShotById,
  onOpenShot,
  onEnsureSaved,
}: Props) {
  const shot = useMemo(() => ensureShotBeats(shotProp), [shotProp]);
  const beats = shot.beats;

  const [copied, setCopied] = useState("");
  const [buildingPlate, setBuildingPlate] = useState<string>("");
  const [buildingVoice, setBuildingVoice] = useState<string>("");
  const [plateNonce, setPlateNonce] = useState(0);
  const [voiceNonce, setVoiceNonce] = useState(0);
  const [preview, setPreview] = useState<{ src: string; title: string } | null>(
    null,
  );
  const [zoneHot, setZoneHot] = useState<"success" | "park" | null>(null);
  const [diskSnap, setDiskSnap] = useState<DiskSnap>(() =>
    snapFromShot(shotProp),
  );
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() =>
    readBeatsDefaultOpen()
      ? allBeatsOpen(shotProp)
      : allBeatsCollapsed(shotProp),
  );
  /** true = beats start open; false = start shut. Remembers in this browser. */
  const [beatsDefaultOpen, setBeatsDefaultOpen] = useState(false);
  const [fieldSaving, setFieldSaving] = useState("");
  const [drafting, setDrafting] = useState("");
  const [crashLabPickerBeatId, setCrashLabPickerBeatId] = useState<
    string | null
  >(null);
  const [assigningCrashId, setAssigningCrashId] = useState("");

  useEffect(() => {
    setBeatsDefaultOpen(readBeatsDefaultOpen());
  }, []);

  /**
   * Draft one prompt box from the show rules, the locked looks and this beat.
   * Lands in the box unsaved — read it, change it, then Save.
   */
  async function assignCrashMorph(entryId: string, beatId: string) {
    setAssigningCrashId(entryId);
    onError("");
    try {
      const res = await fetch(
        `/api/episodes/${episodeId}/crash-lab/assign`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entryId,
            sceneId: scene.id,
            shotId: shot.id,
            beatId,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Assign failed");
      onEpisode(data.episode);
      setPlateNonce((n) => n + 1);
      setCrashLabPickerBeatId(null);
      onStatus("Crash Lab morph on beat");
    } catch (e) {
      onError(String(e));
    } finally {
      setAssigningCrashId("");
    }
  }

  async function draftBeatField(
    beatId: string,
    field: "platePrompt" | "imageMotion" | "textSegment" | "actionSegment",
  ) {
    const beat = beats.find((b) => b.id === beatId);
    if (!beat) return;
    setDrafting(`${field}-${beatId}`);
    onError("");
    try {
      const res = await fetch(
        `/api/episodes/${episodeId}/scenes/${scene.id}/shots/${shot.id}/beats/${beatId}/draft`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            field,
            nudge: beat.aiNudge || "",
            beat: {
              label: beat.label,
              speaker: beat.speaker,
              platePrompt: beat.platePrompt || "",
              imageMotion: beat.imageMotion || "",
              textSegment: beat.textSegment || "",
              actionSegment: beat.actionSegment || "",
            },
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Draft failed");
      patchBeat(beatId, { [field]: data.text });
      onStatus(`${data.label} drafted — read it, change it, then Save`);
    } catch (e) {
      onError(String(e));
    } finally {
      setDrafting("");
    }
  }

  /** Draft GLOBAL — the once-per-queue lip-sync line. Lands unsaved. */
  async function draftGlobal() {
    setDrafting("global");
    onError("");
    try {
      const res = await fetch(
        `/api/episodes/${episodeId}/scenes/${scene.id}/shots/${shot.id}/draft-global`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nudge: shot.aiNudgeGlobal || "",
            global: shot.global || "",
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Draft failed");
      onPatchShot((sh) => ({ ...sh, global: data.text }));
      onStatus(`${data.label} drafted — read it, change it, then Save`);
    } catch (e) {
      onError(String(e));
    } finally {
      setDrafting("");
    }
  }

  useEffect(() => {
    setDiskSnap(snapFromShot(shotProp));
    setCollapsed(
      beatsDefaultOpen
        ? allBeatsOpen(shotProp)
        : allBeatsCollapsed(shotProp),
    );
    // Only when switching shots or after top-bar Save — not on every keystroke
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [shotProp.id, promptsSavedAt, beatsDefaultOpen]);

  function setBeatsDefault(open: boolean) {
    setBeatsDefaultOpen(open);
    try {
      window.localStorage.setItem(BEATS_DEFAULT_KEY, open ? "open" : "shut");
    } catch {
      /* ignore */
    }
    setCollapsed(open ? allBeatsOpen(shot) : allBeatsCollapsed(shot));
  }

  function promptPayload(from?: Shot) {
    const s = ensureShotBeats(from || shot);
    return {
      global: s.global,
      aiNudgeGlobal: s.aiNudgeGlobal || "",
      cutUnder: s.cutUnder,
      resolveNotes: s.resolveNotes,
      script: s.script || "",
      globalHistory: s.globalHistory || [],
      cutUnderHistory: s.cutUnderHistory || [],
      resolveNotesHistory: s.resolveNotesHistory || [],
      scriptHistory: s.scriptHistory || [],
      beats: s.beats.map((b) => ({
        id: b.id,
        label: b.label,
        speaker: b.speaker,
        platePrompt: b.platePrompt,
        imageMotion: b.imageMotion,
        textSegment: b.textSegment,
        imageSeconds: b.imageSeconds,
        textSeconds: b.textSeconds,
        actionSegment: b.actionSegment,
        actionSeconds: b.actionSeconds,
        gapAfterSeconds: b.gapAfterSeconds,
        aiNudge: b.aiNudge || "",
        voiceFile: b.voiceFile,
        plateFile: b.plateFile,
        platePromptHistory: b.platePromptHistory || [],
        imageMotionHistory: b.imageMotionHistory || [],
        textSegmentHistory: b.textSegmentHistory || [],
        actionSegmentHistory: b.actionSegmentHistory || [],
        voiceHistory: b.voiceHistory || [],
      })),
    };
  }

  function markPromptsSavedFromEpisode(ep: Episode) {
    const sc = ep.scenes.find((s) => s.id === scene.id);
    const sh = sc?.shots.find((s) => s.id === shot.id);
    if (sh) setDiskSnap(snapFromShot(sh));
  }

  const promptsDirty = useMemo(() => {
    if (shot.global !== diskSnap.global) return true;
    if ((shot.cutUnder || "") !== diskSnap.cutUnder) return true;
    if ((shot.resolveNotes || "") !== diskSnap.resolveNotes) return true;
    if ((shot.script || "") !== (diskSnap.script || "")) return true;
    for (const b of beats) {
      const d = diskSnap.beats[b.id];
      if (!d) return true;
      if ((b.platePrompt || "") !== (d.platePrompt || "")) return true;
      if ((b.imageMotion || "") !== d.imageMotion) return true;
      if ((b.textSegment || "") !== d.textSegment) return true;
      if ((b.actionSegment || "") !== (d.actionSegment || "")) return true;
    }
    // Beat count changed (Add beat) — must persist or Build plate wipes Beat 3
    if (Object.keys(diskSnap.beats).length !== beats.length) return true;
    return false;
  }, [
    shot.global,
    shot.cutUnder,
    shot.resolveNotes,
    shot.script,
    beats,
    diskSnap,
  ]);

  const keepers = useMemo(
    () =>
      (shot.renders || []).filter(
        (r) => r.status === "approved" && r.fileName,
      ),
    [shot.renders],
  );
  const keeperDuration = useMemo(
    () => keepers.reduce((sum, r) => sum + (r.durationSeconds || 0), 0),
    [keepers],
  );
  const parked = useMemo(
    () =>
      (shot.renders || []).filter(
        (r) => r.status === "parked" && r.fileName,
      ),
    [shot.renders],
  );

  const location = locations.find((l) => l.id === scene.locationId);
  const room = location?.rooms.find((r) => r.id === scene.roomId);
  const placePlate =
    room?.plateAttempts.find((p) => p.id === room.approvedPlateId) ||
    room?.plateAttempts.find((p) => p.status === "approved" && p.fileName);
  const placeSrc =
    location && room && placePlate?.fileName
      ? `/api/locations/${location.id}/rooms/${room.id}/plates/${placePlate.id}`
      : "";

  const victimSrc = useMemo(() => {
    if (!victim) return "";
    const a =
      victim.faceAttempts.find((f) => f.id === victim.approvedFaceId) ||
      victim.faceAttempts.find((f) => f.status === "approved" && f.fileName);
    return a?.fileName
      ? `/api/characters/${victim.id}/faces/${a.id}`
      : "";
  }, [victim]);

  const castFaces = useMemo(() => {
    const out: { cast: EpisodeCastMember; src: string }[] = [];
    for (const cast of episode.cast || []) {
      const a =
        cast.faceAttempts.find((f) => f.id === cast.approvedFaceId) ||
        cast.faceAttempts.find((f) => f.status === "approved" && f.fileName);
      if (!a?.fileName) continue;
      out.push({
        cast,
        src: `/api/episodes/${episodeId}/cast/${cast.id}/faces/${a.id}`,
      });
    }
    return out;
  }, [episode.cast, episodeId]);

  const speakerOptions = useMemo(() => {
    const opts: string[] = [];
    if (victim?.name) opts.push(victim.name);
    for (const c of episode.cast || []) {
      if (c.name) opts.push(c.name);
    }
    return opts;
  }, [victim, episode.cast]);

  function patchBeats(fn: (beats: ShotBeat[]) => ShotBeat[]) {
    onPatchShot((sh) => {
      const s = ensureShotBeats(sh);
      return mirrorBeat0({ ...s, beats: fn([...s.beats]) });
    });
  }

  function patchBeat(beatId: string, patch: Partial<ShotBeat>) {
    patchBeats((list) =>
      list.map((b) => (b.id === beatId ? { ...b, ...patch } : b)),
    );
  }

  async function persistShotState(nextShot: Shot, statusMsg?: string) {
    const res = await fetch(
      `/api/episodes/${episodeId}/scenes/${scene.id}/shots/${shot.id}/save-prompts`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(promptPayload(nextShot)),
      },
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Save failed");
    onEpisode(data.episode);
    markPromptsSavedFromEpisode(data.episode);
    if (statusMsg) onStatus(statusMsg);
    return data.episode as Episode;
  }

  async function saveShotField(
    key: "global" | "cutUnder" | "resolveNotes" | "script",
    histKey:
      | "globalHistory"
      | "cutUnderHistory"
      | "resolveNotesHistory"
      | "scriptHistory",
  ) {
    setFieldSaving(key);
    onError("");
    try {
      const current = shot[key] || "";
      const prev = diskSnap[key] || "";
      const history = pushSavedText(shot[histKey], prev);
      const nextShot = mirrorBeat0({
        ...ensureShotBeats(shot),
        [key]: current,
        [histKey]: history,
      });
      onPatchShot(() => nextShot);
      await persistShotState(nextShot, "Saved");
    } catch (e) {
      onError(String(e));
    } finally {
      setFieldSaving("");
    }
  }

  async function saveBeatField(
    beatId: string,
    field: "platePrompt" | "imageMotion" | "textSegment" | "actionSegment",
  ) {
    const histKey =
      field === "platePrompt"
        ? "platePromptHistory"
        : field === "imageMotion"
          ? "imageMotionHistory"
          : field === "textSegment"
            ? "textSegmentHistory"
            : "actionSegmentHistory";
    setFieldSaving(`${field}-${beatId}`);
    onError("");
    try {
      const beat = beats.find((b) => b.id === beatId);
      if (!beat) return;
      const current = beat[field] || "";
      const prev = diskSnap.beats[beatId]?.[field] || "";
      const history = pushSavedText(beat[histKey], prev);
      const nextBeats = beats.map((b) =>
        b.id === beatId ? { ...b, [field]: current, [histKey]: history } : b,
      );
      const nextShot = mirrorBeat0({
        ...ensureShotBeats(shot),
        beats: nextBeats,
      });
      onPatchShot(() => nextShot);
      await persistShotState(nextShot, "Saved");
    } catch (e) {
      onError(String(e));
    } finally {
      setFieldSaving("");
    }
  }

  /** Nudges have no history, just a plain Save when dirty — same look as the rest. */
  async function saveGlobalNudge() {
    setFieldSaving("aiNudgeGlobal");
    onError("");
    try {
      await persistShotState(ensureShotBeats(shot), "Saved");
    } catch (e) {
      onError(String(e));
    } finally {
      setFieldSaving("");
    }
  }

  async function saveBeatNudge(beatId: string) {
    setFieldSaving(`aiNudge-${beatId}`);
    onError("");
    try {
      await persistShotState(ensureShotBeats(shot), "Saved");
    } catch (e) {
      onError(String(e));
    } finally {
      setFieldSaving("");
    }
  }

  async function deleteShotHistory(
    histKey:
      | "globalHistory"
      | "cutUnderHistory"
      | "resolveNotesHistory"
      | "scriptHistory",
    id: string,
  ) {
    const nextShot = mirrorBeat0({
      ...ensureShotBeats(shot),
      [histKey]: (shot[histKey] || []).filter((h) => h.id !== id),
    });
    onPatchShot(() => nextShot);
    try {
      await persistShotState(nextShot);
    } catch (e) {
      onError(String(e));
    }
  }

  async function deleteBeatHistory(
    beatId: string,
    histKey:
      | "platePromptHistory"
      | "imageMotionHistory"
      | "textSegmentHistory"
      | "actionSegmentHistory",
    id: string,
  ) {
    const nextBeats = beats.map((b) =>
      b.id === beatId
        ? { ...b, [histKey]: (b[histKey] || []).filter((h) => h.id !== id) }
        : b,
    );
    const nextShot = mirrorBeat0({
      ...ensureShotBeats(shot),
      beats: nextBeats,
    });
    onPatchShot(() => nextShot);
    try {
      await persistShotState(nextShot);
    } catch (e) {
      onError(String(e));
    }
  }

  async function useVoiceTake(beatId: string, fileName: string) {
    const beat = beats.find((b) => b.id === beatId);
    if (!beat || !fileName) return;
    const cur = beat.voiceFile;
    let voiceHistory = [...(beat.voiceHistory || [])];
    if (cur && cur !== fileName) {
      const spoken = (beat.textSegment || "")
        .replace(/\[[^\]]*\]/g, " ")
        .replace(/["“”]/g, "")
        .replace(/\s+/g, " ")
        .trim();
      voiceHistory = [
        {
          id: `voc_${Date.now().toString(36)}`,
          fileName: cur,
          savedAt: new Date().toISOString(),
          label: spoken
            ? spoken.length > 56
              ? `${spoken.slice(0, 56)}…`
              : spoken
            : cur,
        },
        ...voiceHistory.filter((v) => v.fileName !== cur && v.fileName !== fileName),
      ].slice(0, 10);
    } else {
      voiceHistory = voiceHistory.filter((v) => v.fileName !== fileName);
    }
    const nextBeats = beats.map((b) =>
      b.id === beatId ? { ...b, voiceFile: fileName, voiceHistory } : b,
    );
    const nextShot = mirrorBeat0({
      ...ensureShotBeats(shot),
      beats: nextBeats,
    });
    onPatchShot(() => nextShot);
    try {
      await persistShotState(nextShot, "Using previous mp3");
      setVoiceNonce(Date.now());
    } catch (e) {
      onError(String(e));
    }
  }

  async function deleteVoiceTake(
    beatId: string,
    histId: string,
    fileName: string,
  ) {
    const beat = beats.find((b) => b.id === beatId);
    if (!beat) return;
    const nextBeats = beats.map((b) =>
      b.id === beatId
        ? {
            ...b,
            voiceHistory: (b.voiceHistory || []).filter((v) => v.id !== histId),
          }
        : b,
    );
    const nextShot = mirrorBeat0({
      ...ensureShotBeats(shot),
      beats: nextBeats,
    });
    onPatchShot(() => nextShot);
    try {
      await persistShotState(nextShot);
      if (fileName && fileName !== beat.voiceFile) {
        await fetch(
          `/api/episodes/${episodeId}/voices/${encodeURIComponent(fileName)}`,
          { method: "DELETE" },
        );
      }
    } catch (e) {
      onError(String(e));
    }
  }

  async function flashCopy(key: string, ok: boolean) {
    if (!ok) {
      onError("Copy failed — use Download instead");
      return;
    }
    setCopied(key);
    onStatus("Copied");
    window.setTimeout(() => setCopied((c) => (c === key ? "" : c)), 1200);
  }

  async function persistPromptsQuiet(): Promise<boolean> {
    if (!promptsDirty) return true;
    const res = await fetch(
      `/api/episodes/${episodeId}/scenes/${scene.id}/shots/${shot.id}/save-prompts`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(promptPayload()),
      },
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not save prompts");
    onEpisode(data.episode);
    markPromptsSavedFromEpisode(data.episode);
    return true;
  }

  async function buildBeatPlate(beatId: string) {
    const beat = beats.find((b) => b.id === beatId);
    if (!beat) return;
    const platePrompt = (beat.platePrompt || "").trim();
    if (!platePrompt) {
      onError(
        "Write PLATE PROMPT first — who, pose, props — then Build plate",
      );
      return;
    }
    setBuildingPlate(beatId);
    onError("");
    onStatus(
      promptsDirty
        ? "Saving beats (keeps Beat 3), then building plate…"
        : "Building plate from PLATE PROMPT…",
    );
    try {
      await persistPromptsQuiet();
      const res = await fetch(
        `/api/episodes/${episodeId}/scenes/${scene.id}/shots/${shot.id}/generate-plate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...promptPayload(),
            beatId,
            platePrompt,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Build failed");
      onEpisode(data.episode);
      markPromptsSavedFromEpisode(data.episode);
      setPlateNonce(Date.now());
      const who = Array.isArray(data.people)
        ? data.people.join(" + ")
        : "check faces";
      onStatus(`Plate ready (${who}) — prompts kept`);
    } catch (e) {
      onError(String(e));
      onStatus("");
    } finally {
      setBuildingPlate("");
    }
  }

  async function generateBeatLine(beatId: string) {
    const beat = beats.find((b) => b.id === beatId);
    if (!beat) return;
    if (!beat.speaker?.trim()) {
      onError("Pick Speaker on this beat first — or you’ll get the wrong voice");
      return;
    }
    const textForVoice = (beat.textSegment || "").trim();
    if (!textForVoice) {
      onError("Type the line in TEXT first — Rebuild speaks that box");
      return;
    }
    setBuildingVoice(beatId);
    onError("");
    onStatus(`Generating ${beat.speaker}'s line from TEXT…`);
    try {
      await persistPromptsQuiet();
      // TEXT first in the body so it can't get lost under promptPayload
      const res = await fetch(
        `/api/episodes/${episodeId}/scenes/${scene.id}/shots/${shot.id}/generate-voice`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...promptPayload(),
            beatId,
            speaker: beat.speaker,
            textSegment: textForVoice,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Voice failed");
      onEpisode(data.episode);
      markPromptsSavedFromEpisode(data.episode);
      setVoiceNonce(Date.now());
      const dur =
        typeof data.durationSec === "number"
          ? ` · ~${data.durationSec}s`
          : "";
      const spoken =
        typeof data.line === "string" && data.line
          ? ` Spoke: “${data.line.slice(0, 90)}${data.line.length > 90 ? "…" : ""}”`
          : "";
      const short =
        typeof data.durationSec === "number" && data.durationSec < 6
          ? " (under 6s — pad the line; lip sync likes longer)"
          : "";
      onStatus(
        `Line ready (${data.speaker})${dur}${short}.${spoken} — play player below`,
      );
    } catch (e) {
      onError(String(e));
      onStatus("");
    } finally {
      setBuildingVoice("");
    }
  }

  function addBeat() {
    if (beats.length >= MAX_SHOT_BEATS) return;
    const nextList = (() => {
      const next = beats.map((b, i) =>
        i === beats.length - 1
          ? { ...b, gapAfterSeconds: b.gapAfterSeconds || 1 }
          : b,
      );
      next.push(
        emptyBeat({
          label: `Beat ${next.length + 1}`,
          gapAfterSeconds: 0,
        }),
      );
      return next;
    })();
    const newId = nextList[nextList.length - 1]?.id;
    if (newId) {
      setCollapsed((c) => ({ ...c, [newId]: !beatsDefaultOpen }));
    }
    const nextShot = mirrorBeat0({
      ...ensureShotBeats(shot),
      beats: nextList,
    });
    onPatchShot(() => nextShot);
    // Save straight away — otherwise Build plate used to wipe the new beat
    void persistShotState(nextShot, "Beat added — drop plate, then IMAGE + mp3").catch(
      (e) => onError(String(e)),
    );
  }

  function removeBeat(beatId: string) {
    if (beats.length <= MIN_SHOT_BEATS) return;
    const nextList = beats
      .filter((b) => b.id !== beatId)
      .map((b, i, arr) => ({
        ...b,
        label: b.label || `Beat ${i + 1}`,
        gapAfterSeconds: i < arr.length - 1 ? b.gapAfterSeconds || 1 : 0,
      }));
    const nextShot = mirrorBeat0({
      ...ensureShotBeats(shot),
      beats: nextList,
    });
    onPatchShot(() => nextShot);
    void persistShotState(nextShot, "Beat removed").catch((e) =>
      onError(String(e)),
    );
  }

  function onZoneDragOver(e: DragEvent, zone: "success" | "park") {
    e.preventDefault();
    setZoneHot(zone);
  }

  function onZoneDrop(e: DragEvent, zone: "success" | "park") {
    e.preventDefault();
    setZoneHot(null);
    if (e.dataTransfer.files?.length) {
      onDropFiles(e.dataTransfer.files, zone);
    }
  }

  return (
    <Panel className="space-y-4 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="display text-2xl">
            {shot.code} — {shot.title}
            {shot.cutaway ? (
              <span className="ml-2 text-sm text-[var(--magenta-hot)]">
                cutaway
              </span>
            ) : null}
          </h3>
        </div>
        <label className="flex items-center gap-2 text-sm text-[var(--mute)]">
          <input
            type="checkbox"
            checked={shot.done}
            onChange={(e) =>
              onPatchShot((sh) => ({ ...sh, done: e.target.checked }))
            }
          />
          Shot done
        </label>
      </div>

      <SceneFlow
        scene={scene}
        activeShotId={shot.id}
        onPatchShot={onPatchShotById}
        onOpenShot={onOpenShot}
      />

      <div className="grid gap-4 lg:grid-cols-12">
        {/* ASSETS kit */}
        <div className="space-y-4 lg:col-span-4">
          <div className="mb-3 grid gap-3">
            <Field label="Code">
              <TextInput
                value={shot.code}
                onChange={(e) =>
                  onPatchShot((sh) => ({ ...sh, code: e.target.value }))
                }
              />
            </Field>
            <Field label="Title">
              <TextInput
                value={shot.title}
                onChange={(e) =>
                  onPatchShot((sh) => ({ ...sh, title: e.target.value }))
                }
              />
            </Field>
            <Field label="Kind">
              <Select
                value={shot.kind}
                onChange={(e) =>
                  onPatchShot((sh) => ({
                    ...sh,
                    kind: e.target.value as Shot["kind"],
                  }))
                }
              >
                <option value="talk">Talk (2–4 plates + mp3s)</option>
                <option value="story">Story (still needs mp3 per beat)</option>
                <option value="silent">Quiet vibe (still needs mp3 per beat)</option>
              </Select>
            </Field>
          </div>

          <CopyFieldShell
            label="Settings"
            copied={copied === "settings"}
            onCopy={() =>
              void copyText(settingsLine(shot)).then((ok) =>
                flashCopy("settings", ok),
              )
            }
          >
            <div className="rounded-sm border border-[var(--line)] bg-[var(--panel-2)] px-3 py-2 font-mono text-xs text-[var(--chrome)]">
              {settingsLine(shot)}
            </div>
          </CopyFieldShell>

          <div className="grid grid-cols-3 gap-2">
            <Field label="W">
              <TextInput
                type="number"
                value={shot.width}
                onChange={(e) =>
                  onPatchShot((sh) => ({
                    ...sh,
                    width: Number(e.target.value) || 768,
                  }))
                }
              />
            </Field>
            <Field label="H">
              <TextInput
                type="number"
                value={shot.height}
                onChange={(e) =>
                  onPatchShot((sh) => ({
                    ...sh,
                    height: Number(e.target.value) || 512,
                  }))
                }
              />
            </Field>
            <Field label="Guide">
              <TextInput
                type="number"
                step="0.05"
                value={shot.guide}
                onChange={(e) =>
                  onPatchShot((sh) => ({
                    ...sh,
                    guide: Number(e.target.value) || 0.45,
                  }))
                }
              />
            </Field>
          </div>

          <div className="rounded-sm border border-[var(--line)] p-3">
            <p className="mb-2 text-[10px] uppercase tracking-wider text-[var(--mute)]">
              Faces (kit)
            </p>
            <div className="grid grid-cols-2 gap-2">
              {victimSrc ? (
                <div className="rounded-sm border border-[var(--magenta)] p-1.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={victimSrc}
                    alt={victim?.name || "Victim"}
                    className="aspect-[3/4] w-full rounded-sm object-cover"
                  />
                  <p className="mt-1 truncate text-[10px]">{victim?.name}</p>
                </div>
              ) : null}
              {castFaces.map(({ cast, src }) => (
                <div
                  key={cast.id}
                  className="rounded-sm border border-[var(--line)] p-1.5"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={cast.name}
                    className="aspect-[3/4] w-full rounded-sm object-cover"
                  />
                  <p className="mt-1 truncate text-[10px]">{cast.name}</p>
                </div>
              ))}
            </div>
          </div>

          <details className="rounded-sm border border-[var(--line)] p-3">
            <summary className="cursor-pointer text-[10px] uppercase tracking-wider text-[var(--mute)]">
              Empty place ref — advanced
            </summary>
            {placeSrc ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={placeSrc}
                  alt="Place"
                  className="my-2 aspect-video w-full rounded-sm object-cover"
                />
                <Btn tone="magenta" onClick={() => void onAttachPlacePlate()}>
                  Use empty place as beat 1 plate
                </Btn>
              </>
            ) : (
              <p className="mt-2 text-sm text-[var(--mute)]">No place locked.</p>
            )}
          </details>
        </div>

        {/* Stack + GLOBAL */}
        <div className="space-y-4 lg:col-span-8">
          <CopyFieldShell
            label="GLOBAL (once for the whole queue)"
            copied={copied === "global"}
            onAi={() => void draftGlobal()}
            aiBusy={drafting === "global"}
            onCopy={() =>
              void copyText(shot.global).then((ok) => flashCopy("global", ok))
            }
            footer={
              <SaveEditHistory
                dirty={(shot.global || "") !== diskSnap.global}
                saving={fieldSaving === "global"}
                onSave={() => void saveShotField("global", "globalHistory")}
                history={shot.globalHistory || []}
                onUse={(text) =>
                  onPatchShot((sh) => ({ ...sh, global: text }))
                }
                onDelete={(id) => void deleteShotHistory("globalHistory", id)}
              />
            }
          >
            <TextArea
              rows={4}
              value={shot.global}
              onChange={(e) =>
                onPatchShot((sh) => ({ ...sh, global: e.target.value }))
              }
            />
          </CopyFieldShell>

          <div className="flex items-center justify-end gap-1.5">
            <span className="text-[10px] text-[var(--chrome-dim)]">Beats</span>
            <button
              type="button"
              role="switch"
              aria-checked={beatsDefaultOpen}
              aria-label={
                beatsDefaultOpen
                  ? "Beats open by default"
                  : "Beats shut by default"
              }
              title={beatsDefaultOpen ? "Beats open" : "Beats shut"}
              onClick={() => setBeatsDefault(!beatsDefaultOpen)}
              className={`relative h-3.5 w-6 shrink-0 rounded-full border transition-colors ${
                beatsDefaultOpen
                  ? "border-[var(--acid)] bg-[var(--acid)]"
                  : "border-[var(--line)] bg-[var(--panel-2)]"
              }`}
            >
              <span
                className={`absolute top-[1px] h-2.5 w-2.5 rounded-full transition-[transform,background-color] ${
                  beatsDefaultOpen
                    ? "translate-x-[11px] bg-[var(--void)]"
                    : "translate-x-[1px] bg-[var(--chrome-dim)]"
                }`}
              />
            </button>
          </div>

          {beats.map((beat, i) => {
            const isCollapsed = Boolean(collapsed[beat.id]);
            const motionDirty =
              (beat.imageMotion || "") !==
              (diskSnap.beats[beat.id]?.imageMotion || "");
            const textDirty =
              (beat.textSegment || "") !==
              (diskSnap.beats[beat.id]?.textSegment || "");
            const actionDirty =
              (beat.actionSegment || "") !==
              (diskSnap.beats[beat.id]?.actionSegment || "");
            return (
              <div
                key={beat.id}
                className="rounded-sm border-2 border-[var(--magenta)] bg-[var(--panel-2)]"
              >
                <div className="flex items-center gap-2 px-4 py-3">
                  <button
                    type="button"
                    className="display min-w-0 flex-1 text-left text-xl text-[var(--magenta-hot)]"
                    onClick={() =>
                      setCollapsed((c) => ({
                        ...c,
                        [beat.id]: !c[beat.id],
                      }))
                    }
                  >
                    {isCollapsed ? "▸" : "▾"} Beat {i + 1}
                    {beat.label && beat.label !== `Beat ${i + 1}`
                      ? ` — ${beat.label}`
                      : ""}
                    {beat.speaker ? ` · ${beat.speaker}` : ""}
                  </button>
                  {beats.length > MIN_SHOT_BEATS ? (
                    <button
                      type="button"
                      title="Delete beat"
                      className="shrink-0 rounded-sm border border-[var(--fail)]/50 px-2 py-0.5 text-sm leading-none text-[var(--fail)] hover:bg-[var(--fail)]/15"
                      onClick={() => removeBeat(beat.id)}
                    >
                      ✕
                    </button>
                  ) : null}
                </div>

                {!isCollapsed ? (
                  <div className="space-y-3 border-t border-[var(--line)] px-4 pb-3 pt-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      <Field label="Label">
                        <TextInput
                          value={beat.label}
                          onChange={(e) =>
                            patchBeat(beat.id, { label: e.target.value })
                          }
                          placeholder="Darryl mansplain"
                        />
                      </Field>
                      <Field label="Speaker (voice)">
                        <Select
                          value={beat.speaker}
                          onChange={(e) =>
                            patchBeat(beat.id, { speaker: e.target.value })
                          }
                        >
                          <option value="">— pick —</option>
                          {speakerOptions.map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </Select>
                      </Field>
                    </div>

                    <div className="grid grid-cols-[108px_1fr] items-start gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="w-full cursor-pointer rounded-sm border border-[var(--acid)] bg-[var(--acid)] text-center font-semibold text-[var(--void)] disabled:opacity-40"
                          style={{ fontSize: 11, lineHeight: 1.2, padding: "3px 6px" }}
                        >
                          {uploading ? "Uploading…" : beat.plateFile ? "Replace plate" : "Drop / pick plate"}
                          <input
                            type="file"
                            accept="image/*,.png,.jpg,.jpeg,.webp,.mp4,video/mp4"
                            className="hidden"
                            disabled={uploading}
                            onChange={(e) => {
                              const files = e.target.files;
                              if (files?.length)
                                onDropFiles(files, undefined, beat.id);
                              e.target.value = "";
                            }}
                          />
                        </label>
                        {beat.plateFile ? (
                          <button
                            type="button"
                            onClick={() =>
                              void copyImageUrl(
                                `/api/episodes/${episodeId}/plates/${encodeURIComponent(beat.plateFile)}`,
                              ).then((ok) =>
                                flashCopy(`plate-${beat.id}`, ok),
                              )
                            }
                            className="w-full rounded-sm border border-[var(--acid)] bg-[var(--acid)] font-semibold text-[var(--void)]"
                            style={{ fontSize: 11, lineHeight: 1.2, padding: "3px 6px" }}
                          >
                            {copied === `plate-${beat.id}`
                              ? "Copied"
                              : "Copy image"}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => setCrashLabPickerBeatId(beat.id)}
                          className="pt-0.5 text-left text-[var(--magenta-hot)] hover:underline"
                          style={{ fontSize: 14, lineHeight: 1.2 }}
                        >
                          Crash Lab →
                        </button>
                        <p className="text-[10px] text-[var(--mute)]">
                          Plate from image gen / Crash Lab
                        </p>
                      </div>
                      {beat.plateFile ? (
                        <div className="flex min-w-0 flex-col items-center justify-self-center">
                          <button
                            type="button"
                            className="block max-w-full"
                            onClick={() =>
                              setPreview({
                                src: `/api/episodes/${episodeId}/plates/${encodeURIComponent(beat.plateFile)}?t=${plateNonce}`,
                                title: `${shot.code} beat ${i + 1}`,
                              })
                            }
                          >
                            {beat.plateFile.endsWith(".mp4") ? (
                              <video
                                src={`/api/episodes/${episodeId}/plates/${encodeURIComponent(beat.plateFile)}?t=${plateNonce}`}
                                muted
                                preload="metadata"
                                className="block h-auto max-h-[200px] w-auto max-w-[min(100%,300px)] rounded-sm border border-[var(--magenta)] bg-black object-contain"
                              />
                            ) : (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={`/api/episodes/${episodeId}/plates/${encodeURIComponent(beat.plateFile)}?t=${plateNonce}`}
                                alt={`Beat ${i + 1} plate`}
                                className="block h-auto max-h-[200px] w-auto max-w-[min(100%,300px)] rounded-sm border border-[var(--magenta)] object-contain"
                              />
                            )}
                          </button>
                          <button
                            type="button"
                            className="mt-1 text-[9px] leading-none text-[var(--chrome-dim)] hover:text-[var(--chrome)]"
                            onClick={() =>
                              downloadUrl(
                                `/api/episodes/${episodeId}/plates/${encodeURIComponent(beat.plateFile)}`,
                                beat.plateFile,
                              )
                            }
                          >
                            Download
                          </button>
                        </div>
                      ) : null}
                    </div>

                    <CopyFieldShell
                      label={`IMAGE${i + 1} — [VISUAL] / [SPEECH] under plate`}
                      copied={copied === `motion-${beat.id}`}
                      onAi={() => void draftBeatField(beat.id, "imageMotion")}
                      aiBusy={drafting === `imageMotion-${beat.id}`}
                      onCopy={() =>
                        void copyText(beat.imageMotion).then((ok) =>
                          flashCopy(`motion-${beat.id}`, ok),
                        )
                      }
                      footer={
                        <SaveEditHistory
                          dirty={motionDirty}
                          saving={fieldSaving === `imageMotion-${beat.id}`}
                          onSave={() =>
                            void saveBeatField(beat.id, "imageMotion")
                          }
                          history={beat.imageMotionHistory || []}
                          onUse={(text) =>
                            patchBeat(beat.id, { imageMotion: text })
                          }
                          onDelete={(id) =>
                            void deleteBeatHistory(
                              beat.id,
                              "imageMotionHistory",
                              id,
                            )
                          }
                        />
                      }
                    >
                      <TextArea
                        rows={5}
                        value={beat.imageMotion}
                        placeholder={`[VISUAL]: who, props, action, light\n[SPEECH]: Name says: "exact line matching mp3"`}
                        onChange={(e) =>
                          patchBeat(beat.id, { imageMotion: e.target.value })
                        }
                      />
                    </CopyFieldShell>

                    <CopyFieldShell
                      label={`TEXT${i + 1} — line for mp3 (v3 tags ok: [whispers] [shouts])`}
                      copied={copied === `text-${beat.id}`}
                      onAi={() => void draftBeatField(beat.id, "textSegment")}
                      aiBusy={drafting === `textSegment-${beat.id}`}
                      onCopy={() =>
                        void copyText(beat.textSegment).then((ok) =>
                          flashCopy(`text-${beat.id}`, ok),
                        )
                      }
                      footer={
                        <SaveEditHistory
                          dirty={textDirty}
                          saving={fieldSaving === `textSegment-${beat.id}`}
                          onSave={() =>
                            void saveBeatField(beat.id, "textSegment")
                          }
                          history={beat.textSegmentHistory || []}
                          onUse={(text) =>
                            patchBeat(beat.id, { textSegment: text })
                          }
                          onDelete={(id) =>
                            void deleteBeatHistory(
                              beat.id,
                              "textSegmentHistory",
                              id,
                            )
                          }
                        />
                      }
                    >
                      <TextArea
                        rows={3}
                        value={beat.textSegment}
                        onChange={(e) =>
                          patchBeat(beat.id, { textSegment: e.target.value })
                        }
                      />
                    </CopyFieldShell>

                    {/* Slim mp3 row */}
                    <div className="rounded-sm border border-[var(--acid)]/40 px-2 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] uppercase tracking-wider text-[var(--acid)]">
                          mp3
                        </span>
                        <Btn
                          tone="accent"
                          className="!px-2 !py-1 text-xs"
                          disabled={
                            buildingVoice === beat.id ||
                            !beat.textSegment?.trim()
                          }
                          onClick={() => void generateBeatLine(beat.id)}
                        >
                          {buildingVoice === beat.id
                            ? "…"
                            : beat.voiceFile
                              ? "Rebuild"
                              : "Generate"}
                        </Btn>
                        {beat.voiceFile ? (
                          <>
                            <audio
                              key={`${beat.voiceFile}-${voiceNonce}`}
                              controls
                              src={`/api/episodes/${episodeId}/voices/${encodeURIComponent(beat.voiceFile)}?v=${voiceNonce}`}
                              className="h-8 min-w-[160px] max-w-[260px] flex-1"
                            />
                            <Btn
                              tone="ghost"
                              className="!px-2 !py-1 text-xs"
                              onClick={() =>
                                downloadUrl(
                                  `/api/episodes/${episodeId}/voices/${encodeURIComponent(beat.voiceFile)}`,
                                  `${shot.code}_b${i + 1}.mp3`,
                                )
                              }
                            >
                              ↓
                            </Btn>
                          </>
                        ) : (
                          <span className="text-[11px] text-[var(--mute)]">
                            quotes in TEXT → Generate
                          </span>
                        )}
                      </div>
                      <VoiceHistoryList
                        history={beat.voiceHistory || []}
                        onUse={(fileName) =>
                          void useVoiceTake(beat.id, fileName)
                        }
                        onDelete={(id, fileName) =>
                          void deleteVoiceTake(beat.id, id, fileName)
                        }
                      />
                    </div>

                    <CopyFieldShell
                      label={`SEGMENT TEXT — action (Add Text after beat ${i + 1})`}
                      copied={copied === `action-${beat.id}`}
                      onAi={() =>
                        void draftBeatField(beat.id, "actionSegment")
                      }
                      aiBusy={drafting === `actionSegment-${beat.id}`}
                      onCopy={() =>
                        void copyText(beat.actionSegment || "").then((ok) =>
                          flashCopy(`action-${beat.id}`, ok),
                        )
                      }
                      footer={
                        <SaveEditHistory
                          dirty={actionDirty}
                          saving={fieldSaving === `actionSegment-${beat.id}`}
                          onSave={() =>
                            void saveBeatField(beat.id, "actionSegment")
                          }
                          history={beat.actionSegmentHistory || []}
                          onUse={(text) =>
                            patchBeat(beat.id, { actionSegment: text })
                          }
                          onDelete={(id) =>
                            void deleteBeatHistory(
                              beat.id,
                              "actionSegmentHistory",
                              id,
                            )
                          }
                        />
                      }
                    >
                      <TextArea
                        rows={3}
                        value={beat.actionSegment || ""}
                        placeholder="Body action only — no plate. e.g. Chloe flicks her hair… Same two people, same props."
                        onChange={(e) =>
                          patchBeat(beat.id, {
                            actionSegment: e.target.value,
                          })
                        }
                      />
                    </CopyFieldShell>

                    {/* Cut under / Resolve — under last beat */}
                    {i === beats.length - 1 ? (
                      <div className="space-y-3 border-t border-[var(--line)] pt-3">
                        <CopyFieldShell
                          label="Cut under (Resolve)"
                          copied={copied === "cut"}
                          onCopy={() =>
                            void copyText(shot.cutUnder).then((ok) =>
                              flashCopy("cut", ok),
                            )
                          }
                          footer={
                            <SaveEditHistory
                              dirty={
                                (shot.cutUnder || "") !== diskSnap.cutUnder
                              }
                              saving={fieldSaving === "cutUnder"}
                              onSave={() =>
                                void saveShotField(
                                  "cutUnder",
                                  "cutUnderHistory",
                                )
                              }
                              history={shot.cutUnderHistory || []}
                              onUse={(text) =>
                                onPatchShot((sh) => ({
                                  ...sh,
                                  cutUnder: text,
                                }))
                              }
                              onDelete={(id) =>
                                void deleteShotHistory("cutUnderHistory", id)
                              }
                            />
                          }
                        >
                          <TextInput
                            value={shot.cutUnder}
                            onChange={(e) =>
                              onPatchShot((sh) => ({
                                ...sh,
                                cutUnder: e.target.value,
                              }))
                            }
                            placeholder="before D6 / under S1…"
                          />
                        </CopyFieldShell>

                        <CopyFieldShell
                          label="Resolve notes"
                          copied={copied === "resolve"}
                          onCopy={() =>
                            void copyText(shot.resolveNotes).then((ok) =>
                              flashCopy("resolve", ok),
                            )
                          }
                          footer={
                            <SaveEditHistory
                              dirty={
                                (shot.resolveNotes || "") !==
                                diskSnap.resolveNotes
                              }
                              saving={fieldSaving === "resolveNotes"}
                              onSave={() =>
                                void saveShotField(
                                  "resolveNotes",
                                  "resolveNotesHistory",
                                )
                              }
                              history={shot.resolveNotesHistory || []}
                              onUse={(text) =>
                                onPatchShot((sh) => ({
                                  ...sh,
                                  resolveNotes: text,
                                }))
                              }
                              onDelete={(id) =>
                                void deleteShotHistory(
                                  "resolveNotesHistory",
                                  id,
                                )
                              }
                            />
                          }
                        >
                          <TextArea
                            rows={2}
                            value={shot.resolveNotes}
                            onChange={(e) =>
                              onPatchShot((sh) => ({
                                ...sh,
                                resolveNotes: e.target.value,
                              }))
                            }
                          />
                        </CopyFieldShell>
                      </div>
                    ) : (
                      <p className="text-center text-xs text-[var(--mute)]">
                        ↓ AUDIO GAP {beat.gapAfterSeconds || 1}s ↓
                      </p>
                    )}
                  </div>
                ) : null}

                {beats.length > MIN_SHOT_BEATS ? (
                  <div className="flex justify-end border-t border-[var(--line)] px-4 py-2">
                    <Btn
                      tone="ghost"
                      className="!px-2 !py-0.5 text-[11px] text-[var(--fail)] hover:bg-[var(--fail)]/10"
                      onClick={() => removeBeat(beat.id)}
                    >
                      Delete beat
                    </Btn>
                  </div>
                ) : null}
              </div>
            );
          })}

          {beats.length < MAX_SHOT_BEATS ? (
            <Btn tone="magenta" onClick={addBeat}>
              + Add beat card
            </Btn>
          ) : (
            <p className="text-xs text-[var(--mute)]">
              Max {MAX_SHOT_BEATS} beats on a stack
            </p>
          )}
        </div>
      </div>

      {/* Keeper / Park */}
      <div className="border-t border-[var(--line)] pt-4">
        <h4 className="display mb-1 flex items-center gap-2 text-xl">
          Comfy results — {shot.code}
          {keeperDuration ? (
            <span className="font-mono text-sm text-[var(--ok)]">
              {formatDuration(keeperDuration)}
            </span>
          ) : null}
        </h4>
        <p className="mb-3 text-xs text-[var(--mute)]">
          One mp4 from the whole stack. Drop on Keeper or Park. Editable any
          time — a Keeper never locks the shot.
        </p>
        <div className="mb-3 max-w-md">
          <Field label="Note (optional)">
            <TextInput
              value={renderNote}
              onChange={(e) => onRenderNote(e.target.value)}
              placeholder="face drifted / good mouth / use first 2s"
            />
          </Field>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div
            className={`rounded-sm border-2 border-dashed p-3 transition ${
              zoneHot === "success"
                ? "border-[var(--ok)] bg-[var(--ok)]/10"
                : "border-[var(--ok)]/50"
            }`}
            onDragEnter={(e) => onZoneDragOver(e, "success")}
            onDragOver={(e) => onZoneDragOver(e, "success")}
            onDragLeave={() => setZoneHot(null)}
            onDrop={(e) => onZoneDrop(e, "success")}
          >
            <div className="mb-3 text-center">
              <p className="display text-2xl text-[var(--ok)]">Keeper</p>
              <p className="text-xs text-[var(--mute)]">Works — drop mp4 here</p>
              <label className="mt-2 inline-flex cursor-pointer">
                <input
                  type="file"
                  accept="video/mp4,video/webm,.mp4,.webm"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => {
                    const f = e.target.files;
                    if (f?.length) onDropFiles(f, "success");
                    e.target.value = "";
                  }}
                />
                <span className="rounded-sm border border-[var(--ok)] px-2 py-1 text-[10px] uppercase tracking-wider text-[var(--ok)]">
                  {uploading && zoneHot === "success"
                    ? "Saving…"
                    : "Or pick file"}
                </span>
              </label>
            </div>
            {keepers.length === 0 ? (
              <p className="py-6 text-center text-sm text-[var(--mute)]">
                Empty — good takes land here
              </p>
            ) : (
              <ul className="space-y-3">
                {keepers.map((r) => (
                  <RenderCard
                    key={r.id}
                    episodeId={episodeId}
                    render={r}
                    bucket="success"
                    onMove={(next) => onSetRenderStatus(r.id, next)}
                  />
                ))}
              </ul>
            )}
          </div>

          <div
            className={`rounded-sm border-2 border-dashed p-3 transition ${
              zoneHot === "park"
                ? "border-[var(--magenta)] bg-[var(--magenta)]/10"
                : "border-[var(--magenta)]/50"
            }`}
            onDragEnter={(e) => onZoneDragOver(e, "park")}
            onDragOver={(e) => onZoneDragOver(e, "park")}
            onDragLeave={() => setZoneHot(null)}
            onDrop={(e) => onZoneDrop(e, "park")}
          >
            <div className="mb-3 text-center">
              <p className="display text-2xl text-[var(--magenta-hot)]">Park</p>
              <p className="text-xs text-[var(--mute)]">
                Not quite — keep for salvage
              </p>
              <label className="mt-2 inline-flex cursor-pointer">
                <input
                  type="file"
                  accept="video/mp4,video/webm,.mp4,.webm"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => {
                    const f = e.target.files;
                    if (f?.length) onDropFiles(f, "park");
                    e.target.value = "";
                  }}
                />
                <span className="rounded-sm border border-[var(--magenta)] px-2 py-1 text-[10px] uppercase tracking-wider text-[var(--magenta-hot)]">
                  {uploading && zoneHot === "park"
                    ? "Saving…"
                    : "Or pick file"}
                </span>
              </label>
            </div>
            {parked.length === 0 ? (
              <p className="py-6 text-center text-sm text-[var(--mute)]">
                Empty — near-misses live here
              </p>
            ) : (
              <ul className="space-y-3">
                {parked.map((r) => (
                  <RenderCard
                    key={r.id}
                    episodeId={episodeId}
                    render={r}
                    bucket="park"
                    onMove={(next) => onSetRenderStatus(r.id, next)}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {preview ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-4"
          onClick={() => setPreview(null)}
        >
          <div
            className="relative max-h-[92vh] max-w-[min(960px,96vw)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="display text-xl">{preview.title}</p>
              <Btn tone="magenta" onClick={() => setPreview(null)}>
                Close
              </Btn>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview.src}
              alt={preview.title}
              className="max-h-[85vh] w-auto max-w-full rounded-sm object-contain"
            />
          </div>
        </div>
      ) : null}

      {crashLabPickerBeatId ? (
        <CrashLabPickerModal
          episodeId={episodeId}
          episode={episode}
          beatLabel={
            beats.find((b) => b.id === crashLabPickerBeatId)?.label ||
            "this beat"
          }
          assigningId={assigningCrashId}
          onClose={() => setCrashLabPickerBeatId(null)}
          onAssign={(entryId) =>
            void assignCrashMorph(entryId, crashLabPickerBeatId)
          }
        />
      ) : null}
    </Panel>
  );
}

/** Pick a Crash Lab shelf morph/still onto this beat — stay on Shot Desk. */
function CrashLabPickerModal({
  episodeId,
  episode,
  beatLabel,
  assigningId,
  onClose,
  onAssign,
}: {
  episodeId: string;
  episode: Episode;
  beatLabel: string;
  assigningId: string;
  onClose: () => void;
  onAssign: (entryId: string) => void;
}) {
  const items = episode.crashMorphs || [];

  return (
    <div
      className="fixed inset-0 z-[85] flex items-center justify-center bg-black/85 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Crash Lab"
      onClick={onClose}
    >
      <div
        className="max-h-[88vh] w-full max-w-2xl overflow-auto rounded-sm border border-[var(--magenta)] bg-[var(--panel)] p-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[var(--magenta-hot)]">
              Crash Lab
            </p>
            <p className="text-[11px] text-[var(--mute)]">
              Put on beat: {beatLabel || "this beat"}
            </p>
          </div>
          <Btn
            tone="ghost"
            className="!px-2 !py-0.5 !text-[11px]"
            onClick={onClose}
          >
            Close
          </Btn>
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-[var(--mute)]">
            Nothing on the shelf yet. Make a morph in{" "}
            <a
              href="/crash"
              className="text-[var(--magenta-hot)] hover:underline"
            >
              Crash Lab Morph
            </a>
            , then come back here.
          </p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {items.map((m: CrashMorphEntry) => {
              const src = `/api/episodes/${episodeId}/plates/${encodeURIComponent(m.fileName)}`;
              const isStill =
                m.kind === "still" || !m.fileName.endsWith(".mp4");
              const busy = assigningId === m.id;
              const onBeat = Boolean(m.sceneId && m.shotId && m.beatId);
              return (
                <button
                  key={m.id}
                  type="button"
                  disabled={Boolean(assigningId)}
                  onClick={() => onAssign(m.id)}
                  className="w-[150px] overflow-hidden rounded-sm border border-[var(--line)] text-left hover:border-[var(--magenta)] disabled:opacity-50"
                >
                  {isStill ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={src}
                      alt=""
                      className="aspect-video w-full bg-black object-contain"
                    />
                  ) : (
                    <video
                      src={src}
                      muted
                      preload="metadata"
                      className="aspect-video w-full bg-black object-contain"
                    />
                  )}
                  <div className="space-y-0.5 px-1.5 py-1.5">
                    <p className="truncate text-[10px] text-[var(--chrome)]">
                      {busy
                        ? "Adding…"
                        : onBeat
                          ? "On beat - use again"
                          : isStill
                            ? "Still"
                            : "Morph"}
                    </p>
                    <p className="truncate text-[9px] text-[var(--mute)]">
                      {m.fileName}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
