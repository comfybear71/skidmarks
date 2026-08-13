"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Btn,
  Field,
  Panel,
  Select,
  TextArea,
  TextInput,
} from "@/components/ui";
import { readScriptDeskCharacterDraft } from "@/lib/crashScriptFields";
import {
  CRASH_STYLE_THUMB_SAVED,
  CRASH_WORLD_THUMB_SAVED,
} from "@/lib/crashStyleSync";
import type { ShowStyleId } from "@/lib/showStylePresets";
import type {
  Character,
  Episode,
  EpisodeCastMember,
  Location,
  Scene,
} from "@/lib/types";

type CrashFaceThumb = {
  key: string;
  name?: string;
  brief?: string;
};

type CrashPlaceThumb = {
  key: string;
  name?: string;
  brief?: string;
};

type Props = {
  episodeId: string;
  episode: Episode;
  scene: Scene;
  victim: Character | null;
  locations: Location[];
  onEpisode: (ep: Episode) => void;
  /** Persist shot prompts before Gen so they aren't wiped by the response */
  onEnsureSaved?: () => Promise<void>;
  onScenePatch: (fn: (sc: Scene) => Scene) => void;
  /** Merge a location after park / gen so the kit updates immediately */
  onLocation: (loc: Location) => void;
  onStatus: (msg: string) => void;
  onError: (msg: string) => void;
};

function faceThumb(c: EpisodeCastMember, episodeId: string) {
  const pending = [...(c.faceAttempts || [])]
    .reverse()
    .find((a) => a.status === "pending" && a.fileName);
  const id =
    pending?.id ||
    c.approvedFaceId ||
    c.faceAttempts.find((a) => a.fileName)?.id ||
    "";
  if (!id) return null;
  return `/api/episodes/${episodeId}/cast/${c.id}/faces/${id}`;
}

export function SceneKit({
  episodeId,
  episode,
  scene,
  victim,
  locations,
  onEpisode,
  onEnsureSaved,
  onScenePatch,
  onLocation,
  onStatus,
  onError,
}: Props) {
  const [busy, setBusy] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [placePrompt, setPlacePrompt] = useState("");
  const [placeFlash, setPlaceFlash] = useState("");
  const [faceFlash, setFaceFlash] = useState("");
  const [castId, setCastId] = useState("");
  const [newCastName, setNewCastName] = useState("");
  /** Stock image picked in the Cast face panel, before Save as reference */
  const [castRefFile, setCastRefFile] = useState<File | null>(null);
  /** Bump to remount the file input so it stops showing a stale filename */
  const [castRefInputKey, setCastRefInputKey] = useState(0);
  /** Who this cast member IS - sent on every Gen face, so it must be visible */
  const [roleNote, setRoleNote] = useState("");
  /** Voice casting prompt - sent on every Gen voice, so it must be visible */
  const [voiceDesc, setVoiceDesc] = useState("");
  /** Which voice take is in the single player - listen before Keep */
  const [voiceListenId, setVoiceListenId] = useState("");
  /** Collapsed by default - kit done, focus on shots */
  const [kitOpen, setKitOpen] = useState(false);
  const [castDeskOpen, setCastDeskOpen] = useState(false);
  /** Hide the CAST overview strip (faces still in Cast face below) */
  const [castOverviewOpen, setCastOverviewOpen] = useState(true);
  const [crashDeskOpen, setCrashDeskOpen] = useState(false);
  const [preview, setPreview] = useState<{ src: string; title: string } | null>(
    null,
  );
  const [morphPreview, setMorphPreview] = useState<{
    src: string;
    title: string;
    still?: boolean;
  } | null>(null);
  const [crashStyleId, setCrashStyleId] = useState<ShowStyleId | "">("");
  const [crashFaces, setCrashFaces] = useState<CrashFaceThumb[]>([]);
  const [crashPlaces, setCrashPlaces] = useState<CrashPlaceThumb[]>([]);
  const [crashPickKeys, setCrashPickKeys] = useState<string[]>([]);
  const [crashWorldKey, setCrashWorldKey] = useState("");
  const [crashTick, setCrashTick] = useState(0);

  const refreshCrashKeepers = useCallback(() => {
    const draft = readScriptDeskCharacterDraft();
    setCrashStyleId(draft.styleId || "");
    setCrashPickKeys(draft.styleCastKeys || []);
    setCrashWorldKey(draft.styleWorldKey || "");
    void (async () => {
      try {
        const [facesRes, placesRes] = await Promise.all([
          fetch("/api/crash/style-cards"),
          fetch("/api/crash/world-cards"),
        ]);
        const facesData = await facesRes.json();
        const placesData = await placesRes.json();
        const styleId = draft.styleId;
        if (!styleId) {
          setCrashFaces([]);
          setCrashPlaces([]);
          return;
        }
        const faceCard = Array.isArray(facesData.cards)
          ? facesData.cards.find(
              (c: { id?: string }) => c.id === styleId,
            )
          : null;
        const placeCard = Array.isArray(placesData.cards)
          ? placesData.cards.find(
              (c: { id?: string }) => c.id === styleId,
            )
          : null;
        setCrashFaces(
          Array.isArray(faceCard?.thumbs) ? faceCard.thumbs : [],
        );
        setCrashPlaces(
          Array.isArray(placeCard?.thumbs) ? placeCard.thumbs : [],
        );
      } catch {
        /* ignore */
      }
    })();
  }, []);

  useEffect(() => {
    if (!kitOpen) return;
    refreshCrashKeepers();
  }, [kitOpen, crashTick, refreshCrashKeepers]);

  useEffect(() => {
    const bump = () => setCrashTick((n) => n + 1);
    window.addEventListener(CRASH_STYLE_THUMB_SAVED, bump);
    window.addEventListener(CRASH_WORLD_THUMB_SAVED, bump);
    return () => {
      window.removeEventListener(CRASH_STYLE_THUMB_SAVED, bump);
      window.removeEventListener(CRASH_WORLD_THUMB_SAVED, bump);
    };
  }, []);

  const location = useMemo(
    () => locations.find((l) => l.id === scene.locationId) || null,
    [locations, scene.locationId],
  );

  /** Places for THIS episode's arsehole (+ shared). Stops Kim's Hell on a Darryl scene. */
  const episodePlaces = useMemo(() => {
    const victimId = episode.victimCharacterId || victim?.id || "";
    const usedOnEpisode = new Set(
      (episode.scenes || [])
        .map((s) => s.locationId)
        .filter(Boolean) as string[],
    );
    if (scene.locationId) usedOnEpisode.add(scene.locationId);

    return locations.filter((l) => {
      if (usedOnEpisode.has(l.id)) return true;
      if (!l.characterIds?.length) return true;
      if (victimId && l.characterIds.includes(victimId)) return true;
      return false;
    });
  }, [
    locations,
    episode.victimCharacterId,
    episode.scenes,
    victim?.id,
    scene.locationId,
  ]);

  const placeBelongsElsewhere = Boolean(
    location &&
    victim &&
    location.characterIds.length > 0 &&
    !location.characterIds.includes(victim.id),
  );
  const room = useMemo(() => {
    if (!location) return null;
    if (scene.roomId) {
      return location.rooms.find((r) => r.id === scene.roomId) || null;
    }
    // Location picked but room blank (old Kim scenes) - use Main / first room
    return location.rooms[0] || null;
  }, [location, scene.roomId]);

  // Persist blank roomId so Gen place / plates stay wired after refresh
  useEffect(() => {
    if (!location?.rooms.length) return;
    if (scene.roomId && location.rooms.some((r) => r.id === scene.roomId))
      return;
    const first = location.rooms[0]?.id;
    if (!first) return;
    onScenePatch((sc) => ({ ...sc, roomId: first }));
  }, [location, scene.roomId, onScenePatch]);

  // Prefill place prompt from the room's locked look note when you switch rooms
  useEffect(() => {
    if (!room) return;
    const baked = (room.lookNote || room.notes || "").trim();
    if (baked) setPlacePrompt(baked);
  }, [room?.id]);

  // Default cast selection + prefill face prompt from role note
  useEffect(() => {
    const list = episode.cast || [];
    if (!list.length) return;
    if (!castId || !list.some((c) => c.id === castId)) {
      setCastId(list[0].id);
    }
  }, [episode.cast, castId]);

  const selectedCast = useMemo(
    () => (episode.cast || []).find((c) => c.id === castId) || null,
    [episode.cast, castId],
  );

  useEffect(() => {
    if (!selectedCast) return;
    setRoleNote(selectedCast.roleNote || "");
    setVoiceDesc(selectedCast.voiceDescription || "");
    setFaceFlash("");
    const voices = selectedCast.voiceAttempts || [];
    const pick =
      voices.find((v) => v.id === selectedCast.approvedVoiceAttemptId) ||
      voices.find((v) => v.status === "pending" && v.fileName) ||
      voices.find((v) => v.fileName);
    setVoiceListenId(pick?.id || "");
  }, [selectedCast?.id]);

  // Keep listen selection valid when new samples arrive
  useEffect(() => {
    if (!selectedCast) return;
    const voices = selectedCast.voiceAttempts || [];
    if (!voices.length) {
      setVoiceListenId("");
      return;
    }
    if (voiceListenId && voices.some((v) => v.id === voiceListenId)) return;
    const pick =
      voices.find((v) => v.id === selectedCast.approvedVoiceAttemptId) ||
      voices.find((v) => v.status === "approved" && v.fileName) ||
      voices.find((v) => v.status === "pending" && v.fileName) ||
      voices.find((v) => v.fileName);
    setVoiceListenId(pick?.id || "");
  }, [selectedCast?.voiceAttempts, voiceListenId, selectedCast]);

  const listenVoice = useMemo(() => {
    if (!selectedCast || !voiceListenId) return null;
    return (
      selectedCast.voiceAttempts.find((v) => v.id === voiceListenId) || null
    );
  }, [selectedCast, voiceListenId]);

  const activeFace = useMemo(() => {
    if (!selectedCast) return null;
    // Newest pending take wins - otherwise Gen after lock looks like nothing happened
    const pending = [...selectedCast.faceAttempts]
      .reverse()
      .find((a) => a.status === "pending" && a.fileName);
    if (pending) return pending;
    const approved = selectedCast.faceAttempts.find(
      (a) =>
        a.id === selectedCast.approvedFaceId &&
        a.fileName &&
        a.status === "approved",
    );
    if (approved) return approved;
    return selectedCast.faceAttempts.find((a) => a.fileName) || null;
  }, [selectedCast]);

  const allFaceTakes = useMemo(
    () =>
      [...(selectedCast?.faceAttempts || [])]
        .filter((a) => a.fileName)
        .reverse(),
    [selectedCast],
  );

  const parkedFaces = useMemo(
    () =>
      (selectedCast?.faceAttempts || []).filter(
        (a) => a.status === "parked" && a.fileName,
      ),
    [selectedCast],
  );

  const activeFaceSrc = activeFace
    ? `/api/episodes/${episodeId}/cast/${selectedCast!.id}/faces/${activeFace.id}`
    : null;

  // Active place = newest pending try, else locked. Parked/rejected leave the slot empty unless pending exists.
  const activePlace = useMemo(() => {
    if (!room) return null;
    const pending = [...room.plateAttempts]
      .reverse()
      .find((p) => p.status === "pending" && p.fileName);
    if (pending) return pending;
    const approved = room.plateAttempts.find(
      (p) => p.id === room.approvedPlateId && p.fileName,
    );
    if (approved && approved.status === "approved") return approved;
    return null;
  }, [room]);

  const placePlateId = activePlace?.id || "";
  const placeSrc =
    location && room && placePlateId
      ? `/api/locations/${location.id}/rooms/${room.id}/plates/${placePlateId}`
      : "";

  const parkedPlates = useMemo(
    () =>
      (room?.plateAttempts || []).filter(
        (p) => p.status === "parked" && p.fileName,
      ),
    [room],
  );

  const victimFace =
    victim?.approvedFaceId ||
    victim?.faceAttempts.find((a) => a.fileName)?.id ||
    "";
  const victimSrc = victimFace
    ? `/api/characters/${victim!.id}/faces/${victimFace}`
    : "";

  async function createCastMember() {
    const name = newCastName.trim();
    if (!name) {
      onError("Type a name first");
      return;
    }
    setBusy("newCast");
    onError("");
    try {
      const res = await fetch(`/api/episodes/${episodeId}/cast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Add cast failed");
      onEpisode(data.episode);
      const list = data.episode.cast || [];
      const added =
        list.find((c: EpisodeCastMember) => c.name === name) ||
        list[list.length - 1];
      if (added) {
        setCastId(added.id);
        setRoleNote(added.roleNote || "");
      }
      setNewCastName("");
      onStatus(`Cast added: ${name}`);
    } catch (e) {
      onError(String(e));
    } finally {
      setBusy("");
    }
  }

  async function saveRoleNote() {
    if (!castId) return;
    setBusy(`role:${castId}`);
    onError("");
    setFaceFlash("");
    try {
      const res = await fetch(`/api/episodes/${episodeId}/cast/${castId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleNote }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      onEpisode(data.episode);
      setFaceFlash("Who they are - saved. This goes into every Gen face.");
    } catch (e) {
      onError(String(e));
    } finally {
      setBusy("");
    }
  }

  async function deleteParkedFace(targetCastId: string, attemptId: string) {
    setBusy(`faceDel:${attemptId}`);
    onError("");
    setFaceFlash("");
    try {
      const res = await fetch(
        `/api/episodes/${episodeId}/cast/${targetCastId}/faces/${attemptId}`,
        { method: "DELETE" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      onEpisode(data.episode);
      onStatus("Parked face removed");
    } catch (e) {
      onError(String(e));
    } finally {
      setBusy("");
    }
  }

  async function saveVoiceNote() {
    if (!castId) return;
    setBusy(`voiceNote:${castId}`);
    onError("");
    try {
      const res = await fetch(`/api/episodes/${episodeId}/cast/${castId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceDescription: voiceDesc }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      onEpisode(data.episode);
      onStatus("Voice prompt saved - hit Gen voice for new takes");
    } catch (e) {
      onError(String(e));
    } finally {
      setBusy("");
    }
  }

  async function addCastRef() {
    if (!castId || !castRefFile) return;
    setBusy(`ref:${castId}`);
    onError("");
    setFaceFlash("");
    try {
      const form = new FormData();
      form.append("file", castRefFile);
      form.append("label", castRefFile.name);
      const res = await fetch(
        `/api/episodes/${episodeId}/cast/${castId}/refs`,
        { method: "POST", body: form },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      onEpisode(data.episode);
      setCastRefFile(null);
      setCastRefInputKey((k) => k + 1);
      setFaceFlash("Reference saved - not the final face. Hit Gen face.");
    } catch (e) {
      onError(String(e));
    } finally {
      setBusy("");
    }
  }

  async function removeCastRef(refId: string) {
    if (!castId) return;
    setBusy(`ref:${refId}`);
    onError("");
    try {
      const res = await fetch(
        `/api/episodes/${episodeId}/cast/${castId}/refs/${refId}`,
        { method: "DELETE" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Remove failed");
      onEpisode(data.episode);
      setCastRefFile(null);
      setCastRefInputKey((k) => k + 1);
    } catch (e) {
      onError(String(e));
    } finally {
      setBusy("");
    }
  }

  async function genCastFace(targetCastId?: string) {
    const id = targetCastId || castId;
    if (!id) {
      onError("Pick a cast member first");
      return;
    }
    setBusy(`face:${id}`);
    onError("");
    setFaceFlash("");
    try {
      // Persist shot prompts + role note so Gen can't wipe them
      if (onEnsureSaved) await onEnsureSaved();
      if (id === castId && roleNote !== (selectedCast?.roleNote || "")) {
        const saveRes = await fetch(`/api/episodes/${episodeId}/cast/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roleNote }),
        });
        const saveData = await saveRes.json();
        if (!saveRes.ok)
          throw new Error(saveData.error || "Could not save who they are");
        onEpisode(saveData.episode);
      }
      const res = await fetch(
        `/api/episodes/${episodeId}/cast/${id}/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            note: id === castId ? roleNote : undefined,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generate failed");
      onEpisode(data.episode);
      setFaceFlash(
        data.usedReferences
          ? `New take from your ${data.usedReferences} reference image(s) - Approve, Park, or Reject`
          : "New take ready - Approve, Park, or Reject (write avoid reason)",
      );
      onStatus("Face generated - check the big preview (newest pending)");
    } catch (e) {
      onError(String(e));
    } finally {
      setBusy("");
    }
  }

  async function setFaceStatus(
    targetCastId: string,
    attemptId: string,
    status: "approved" | "rejected" | "parked",
  ) {
    setBusy(`faceStatus:${status}`);
    onError("");
    setFaceFlash("");
    try {
      const res = await fetch(
        `/api/episodes/${episodeId}/cast/${targetCastId}/faces/${attemptId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status,
            reason:
              status === "rejected"
                ? rejectReason.trim() || "Not skidmarky enough"
                : status === "parked"
                  ? "Parked keeper"
                  : "",
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      onEpisode(data.episode);
      const msg =
        status === "approved"
          ? "Face APPROVED - locked"
          : status === "parked"
            ? "Face parked - kept forever"
            : `Rejected - next Gen will avoid: ${rejectReason.trim() || "that look"}`;
      setFaceFlash(msg);
      onStatus(msg);
      if (status === "rejected") {
        // keep reason in the box so next Gen uses it as reject hint
      }
    } catch (e) {
      onError(String(e));
    } finally {
      setBusy("");
    }
  }

  async function importCrashFace(thumbKey: string, name?: string) {
    if (!crashStyleId) {
      onError("Pick a show style in Crash Lab Script desk first");
      return;
    }
    setBusy(`crashFace:${thumbKey}`);
    onError("");
    try {
      const res = await fetch(
        `/api/episodes/${episodeId}/cast/import-style-card`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            styleId: crashStyleId,
            thumbKey,
            name,
            approve: true,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      onEpisode(data.episode);
      if (data.castId) {
        setCastId(data.castId);
        setCastDeskOpen(true);
        setCastOverviewOpen(true);
      }
      onStatus(
        data.created
          ? "Crash face pulled into cast (locked)"
          : "Crash face locked onto existing cast",
      );
    } catch (e) {
      onError(String(e));
    } finally {
      setBusy("");
    }
  }

  async function importCrashPlace(thumbKey: string, name?: string) {
    if (!crashStyleId) {
      onError("Pick a show style in Crash Lab Script desk first");
      return;
    }
    setBusy(`crashPlace:${thumbKey}`);
    onError("");
    setPlaceFlash("");
    try {
      const intoCurrent = Boolean(location && room);
      const res = await fetch("/api/locations/import-world-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          styleId: crashStyleId,
          thumbKey,
          name,
          locationId: intoCurrent ? location!.id : undefined,
          roomId: intoCurrent ? room!.id : undefined,
          characterIds:
            !intoCurrent && (episode.victimCharacterId || victim?.id)
              ? [episode.victimCharacterId || victim!.id]
              : undefined,
          approve: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      onLocation(data.location);
      onScenePatch((sc) => ({
        ...sc,
        locationId: data.location.id,
        roomId: data.roomId || sc.roomId,
      }));
      window.dispatchEvent(new CustomEvent("skidmarks-locations-refresh"));
      const msg = intoCurrent
        ? "Crash place locked on this room"
        : "Crash place pulled into Location Lab (locked)";
      setPlaceFlash(msg);
      onStatus(msg);
    } catch (e) {
      onError(String(e));
    } finally {
      setBusy("");
    }
  }

  async function pullScriptDeskPicks() {
    if (!crashStyleId) {
      onError("Pick a show style in Crash Lab Script desk first");
      return;
    }
    const faceKeys = crashPickKeys.length
      ? crashPickKeys
      : [];
    const placeKey = crashWorldKey;
    if (!faceKeys.length && !placeKey) {
      onError("No Script desk cast/place picks yet — lock them in Crash Lab");
      return;
    }
    setBusy("crashPull");
    onError("");
    try {
      for (const key of faceKeys) {
        const face = crashFaces.find((f) => f.key === key);
        const res = await fetch(
          `/api/episodes/${episodeId}/cast/import-style-card`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              styleId: crashStyleId,
              thumbKey: key,
              name: face?.name,
              approve: true,
            }),
          },
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Cast import failed");
        onEpisode(data.episode);
      }
      if (placeKey) {
        const place = crashPlaces.find((p) => p.key === placeKey);
        const intoCurrent = Boolean(location && room);
        const res = await fetch("/api/locations/import-world-card", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            styleId: crashStyleId,
            thumbKey: placeKey,
            name: place?.name,
            locationId: intoCurrent ? location!.id : undefined,
            roomId: intoCurrent ? room!.id : undefined,
            characterIds:
              !intoCurrent && (episode.victimCharacterId || victim?.id)
                ? [episode.victimCharacterId || victim!.id]
                : undefined,
            approve: true,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Place import failed");
        onLocation(data.location);
        onScenePatch((sc) => ({
          ...sc,
          locationId: data.location.id,
          roomId: data.roomId || sc.roomId,
        }));
        window.dispatchEvent(new CustomEvent("skidmarks-locations-refresh"));
      }
      setCastOverviewOpen(true);
      onStatus("Script desk picks pulled into this scene kit");
    } catch (e) {
      onError(String(e));
    } finally {
      setBusy("");
    }
  }

  async function genCastVoice(castId: string) {
    setBusy(`voice:${castId}`);
    onError("");
    try {
      if (onEnsureSaved) await onEnsureSaved();
      if (
        castId === selectedCast?.id &&
        voiceDesc !== (selectedCast.voiceDescription || "")
      ) {
        const saveRes = await fetch(
          `/api/episodes/${episodeId}/cast/${castId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ voiceDescription: voiceDesc }),
          },
        );
        const saveData = await saveRes.json();
        if (!saveRes.ok)
          throw new Error(saveData.error || "Could not save voice prompt");
        onEpisode(saveData.episode);
      }
      const res = await fetch(
        `/api/episodes/${episodeId}/cast/${castId}/voices/design`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Voice design failed");
      onEpisode(data.episode);
      onStatus(`${data.count} voice samples - pick one`);
    } catch (e) {
      onError(String(e));
    } finally {
      setBusy("");
    }
  }

  async function removeCrashEntry(entryId: string) {
    setBusy(`crash-del:${entryId}`);
    onError("");
    try {
      const res = await fetch(`/api/episodes/${episodeId}/crash-lab/remove`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Remove failed");
      onEpisode(data.episode);
      onStatus("Removed from Crash Lab shelf");
    } catch (e) {
      onError(String(e));
    } finally {
      setBusy("");
    }
  }

  async function setVoiceStatus(
    castId: string,
    attemptId: string,
    status: "approved" | "rejected",
  ) {
    setBusy(`voiceStatus:${attemptId}`);
    onError("");
    try {
      const res = await fetch(
        `/api/episodes/${episodeId}/cast/${castId}/voices/${attemptId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status,
            reason: status === "rejected" ? rejectReason : "",
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      onEpisode(data.episode);
      onStatus(
        status === "approved"
          ? data.freedVoiceId
            ? "Voice locked - old one deleted from ElevenLabs, slot freed"
            : "Voice locked"
          : "Voice dud",
      );
    } catch (e) {
      onError(String(e));
    } finally {
      setBusy("");
    }
  }

  async function deleteVoiceTake(castId: string, attemptId: string) {
    setBusy(`voiceDel:${attemptId}`);
    onError("");
    try {
      const res = await fetch(
        `/api/episodes/${episodeId}/cast/${castId}/voices/${attemptId}`,
        { method: "DELETE" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      if (voiceListenId === attemptId) setVoiceListenId("");
      onEpisode(data.episode);
      onStatus("Voice take removed");
    } catch (e) {
      onError(String(e));
    } finally {
      setBusy("");
    }
  }

  async function setPlaceStatus(
    attemptId: string,
    status: "approved" | "rejected" | "parked",
    reason = "",
  ) {
    if (!location || !room) return;
    setBusy(`placeStatus:${status}`);
    onError("");
    setPlaceFlash("");
    try {
      const res = await fetch(
        `/api/locations/${location.id}/rooms/${room.id}/plates/${attemptId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status, reason }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      onLocation(data.location);
      const msg =
        status === "approved"
          ? "Place APPROVED - locked for this room"
          : status === "parked"
            ? "Parked - active cleared, kept under Parked"
            : "Rejected - Gen place again";
      setPlaceFlash(msg);
      onStatus(msg);
      window.dispatchEvent(new CustomEvent("skidmarks-locations-refresh"));
    } catch (e) {
      onError(String(e));
    } finally {
      setBusy("");
    }
  }

  async function relockParked(attemptId: string) {
    await setPlaceStatus(attemptId, "approved");
  }

  async function genPlace() {
    if (!location || !room) {
      onError("Pick a place + room first");
      return;
    }
    const note =
      placePrompt.trim() ||
      room.notes ||
      scene.notes ||
      "empty establishing plate";
    // Positive-only empty lock - naming people/animals pulls them in
    const noteLocked = `${note}. Empty place only - architecture and materials; cast arrives later on shot plates.`;
    setBusy("place");
    onError("");
    try {
      if (onEnsureSaved) await onEnsureSaved();
      const res = await fetch(`/api/locations/${location.id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: room.id,
          note: noteLocked,
          styleRealism: 60,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Place generate failed");
      if (data.location) onLocation(data.location);
      setPlaceFlash(
        "New place plate ready - Approve in Location Lab or Park it",
      );
      onStatus("Place plate generated - click thumb to check it");
      window.dispatchEvent(new CustomEvent("skidmarks-locations-refresh"));
    } catch (e) {
      onError(String(e));
    } finally {
      setBusy("");
    }
  }

  const castLocked = (episode.cast || []).filter(
    (c) => c.approvedFaceId,
  ).length;
  const castTotal = (episode.cast || []).length;
  const kitSummary = [
    location?.name || "no place",
    room?.name,
    victim?.name,
    castTotal ? `${castLocked}/${castTotal} cast faces` : null,
  ]
    .filter(Boolean)
    .join(" | ");

  return (
    <Panel className="space-y-4 p-4">
      <button
        type="button"
        className="w-full text-left"
        onClick={() => setKitOpen((o) => !o)}
        aria-expanded={kitOpen}
      >
        <h3 className="display text-xl">
          <span className="mr-2 text-[var(--acid)]">{kitOpen ? "-" : "+"}</span>
          Scene kit
        </h3>
        {!kitOpen && kitSummary ? (
          <p className="text-xs text-[var(--mute)]">{kitSummary}</p>
        ) : null}
      </button>

      {kitOpen ? (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Place (Location Lab)">
              <Select
                value={scene.locationId || ""}
                onChange={(e) => {
                  const locId = e.target.value;
                  const loc = locations.find((l) => l.id === locId);
                  const firstRoom = loc?.rooms[0]?.id || "";
                  onScenePatch((sc) => ({
                    ...sc,
                    locationId: locId,
                    roomId: firstRoom,
                  }));
                }}
              >
                <option value=""> - pick place - </option>
                {episodePlaces.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
              {placeBelongsElsewhere ? (
                <p className="mt-1 text-xs text-[var(--fail)]">
                  This place is tied to someone else - switch to a{" "}
                  {victim?.name || "this episode"} place or you&apos;ll cut the
                  wrong world.
                </p>
              ) : (
                <p className="mt-1 text-[11px] text-[var(--mute)]">
                  Only places for this episode&apos;s arsehole (plus shared).
                  Full list lives in Location Lab.
                </p>
              )}
            </Field>
            <Field label="Room (cutaways share this)">
              <Select
                value={scene.roomId || ""}
                disabled={!location}
                onChange={(e) =>
                  onScenePatch((sc) => ({ ...sc, roomId: e.target.value }))
                }
              >
                <option value=""> - pick room - </option>
                {(location?.rooms || []).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Place prompt (EMPTY room/street only - people come later on shots)">
            <TextArea
              rows={3}
              value={placePrompt}
              onChange={(e) => setPlacePrompt(e.target.value)}
              placeholder="Dirty Dog bar floor empty: sticky carpet, wet cast iron stools, beer-glow shelves, grey overcast through frosted windows..."
            />
          </Field>

          <div className="rounded-sm border border-[var(--acid)]/40 p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[var(--acid)]">
                  From Crash Lab
                </p>
                <p className="text-[11px] text-[var(--mute)]">
                  {crashStyleId
                    ? `Pull locked faces + places into this scene (${crashStyleId})`
                    : "Open Crash Lab Script desk and pick a show style first"}
                </p>
              </div>
              <Btn
                tone="accent"
                disabled={!crashStyleId || Boolean(busy)}
                onClick={() => void pullScriptDeskPicks()}
              >
                {busy === "crashPull" ? "..." : "Pull Script desk picks"}
              </Btn>
            </div>
            {crashStyleId ? (
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <p className="mb-1 text-[10px] uppercase tracking-wider text-[var(--mute)]">
                    Faces — click to add cast
                  </p>
                  {crashFaces.length === 0 ? (
                    <p className="text-xs text-[var(--mute)]">
                      No Crash faces yet
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {crashFaces.map((f) => {
                        const picked = crashPickKeys.includes(f.key);
                        const src = `/api/crash/style-cards/file?styleId=${encodeURIComponent(crashStyleId)}&thumb=${encodeURIComponent(f.key)}&v=${crashTick}`;
                        return (
                          <button
                            key={f.key}
                            type="button"
                            disabled={Boolean(busy)}
                            title={
                              f.name
                                ? `${f.name}${picked ? " (Script pick)" : ""} — add to cast`
                                : "Add to cast"
                            }
                            onClick={() => void importCrashFace(f.key, f.name)}
                            className={`w-16 overflow-hidden rounded-sm border ${
                              picked
                                ? "border-[var(--acid)]"
                                : "border-[var(--line)]"
                            } hover:border-[var(--magenta)] disabled:opacity-40`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={src}
                              alt={f.name || "face"}
                              className="aspect-[3/4] w-full object-cover"
                            />
                            <span className="block truncate px-0.5 py-0.5 text-[9px]">
                              {f.name || "?"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div>
                  <p className="mb-1 text-[10px] uppercase tracking-wider text-[var(--mute)]">
                    Places — click to lock on scene
                    {location && room
                      ? ` (${location.name} / ${room.name})`
                      : " (makes a new place)"}
                  </p>
                  {crashPlaces.length === 0 ? (
                    <p className="text-xs text-[var(--mute)]">
                      No Crash places yet
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {crashPlaces.map((p) => {
                        const picked = crashWorldKey === p.key;
                        const src = `/api/crash/world-cards/file?styleId=${encodeURIComponent(crashStyleId)}&thumb=${encodeURIComponent(p.key)}&v=${crashTick}`;
                        return (
                          <button
                            key={p.key}
                            type="button"
                            disabled={Boolean(busy)}
                            title={
                              p.name
                                ? `${p.name}${picked ? " (Script pick)" : ""} — use as place`
                                : "Use as place"
                            }
                            onClick={() =>
                              void importCrashPlace(p.key, p.name)
                            }
                            className={`w-24 overflow-hidden rounded-sm border ${
                              picked
                                ? "border-[var(--acid)]"
                                : "border-[var(--line)]"
                            } hover:border-[var(--magenta)] disabled:opacity-40`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={src}
                              alt={p.name || "place"}
                              className="aspect-video w-full object-cover"
                            />
                            <span className="block truncate px-0.5 py-0.5 text-[9px]">
                              {p.name || "?"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          <div className="grid gap-4 lg:grid-cols-12">
            {/* Asshole (episode prick - Character Lab) */}
            <div className="rounded-sm border border-[var(--magenta)] p-3 lg:col-span-3">
              <p className="mb-2 text-[10px] uppercase tracking-wider text-[var(--magenta-hot)]">
                Asshole
              </p>
              {victimSrc ? (
                <button
                  type="button"
                  className="mb-2 block w-full"
                  title="Click to expand"
                  onClick={() =>
                    setPreview({
                      src: victimSrc,
                      title: victim?.name || "Asshole",
                    })
                  }
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={victimSrc}
                    alt={victim?.name || "Asshole"}
                    className="aspect-[3/4] w-full rounded-sm object-cover hover:ring-1 hover:ring-[var(--acid)]"
                  />
                </button>
              ) : (
                <div className="mb-2 flex aspect-[3/4] items-center justify-center bg-[var(--panel-2)] text-xs text-[var(--mute)]">
                  no face
                </div>
              )}
              <p className="truncate text-base">{victim?.name || " - "}</p>
              {victim ? (
                <Link
                  href={`/lab/${victim.id}`}
                  className="text-[10px] text-[var(--acid)] hover:underline"
                >
                  Edit in Character Lab {"->"}
                </Link>
              ) : (
                <Link
                  href="/lab"
                  className="text-[10px] text-[var(--acid)] hover:underline"
                >
                  Character Lab {"->"}
                </Link>
              )}
            </div>

            {/* Place - big */}
            <div className="rounded-sm border border-[var(--line)] p-3 lg:col-span-6">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[10px] uppercase tracking-wider text-[var(--mute)]">
                  Place (active)
                </p>
                <p className="truncate text-sm text-[var(--chrome)]">
                  {location ? location.name : " - "}
                  {room ? ` | ${room.name}` : ""}
                  {placeSrc ? " | click image to enlarge" : ""}
                </p>
              </div>
              {placeSrc ? (
                <button
                  type="button"
                  className="mb-3 block w-full"
                  title="Click to expand"
                  onClick={() =>
                    setPreview({
                      src: placeSrc,
                      title: location
                        ? `${location.name} - ${room?.name || ""}`
                        : "Place",
                    })
                  }
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={placeSrc}
                    alt={room?.name || "Place"}
                    className="aspect-[16/9] max-h-[360px] w-full rounded-sm object-cover hover:ring-1 hover:ring-[var(--acid)]"
                  />
                </button>
              ) : (
                <div className="mb-3 flex aspect-[16/9] max-h-[360px] flex-col items-center justify-center gap-1 bg-[var(--panel-2)] px-2 text-center text-sm text-[var(--mute)]">
                  <span>empty slot</span>
                  <span className="text-xs">
                    {parkedPlates.length
                      ? `${parkedPlates.length} parked - Gen a new empty plate`
                      : "Gen place (empty of people)"}
                  </span>
                </div>
              )}
              {placeFlash ? (
                <p className="mb-2 text-sm leading-snug text-[var(--magenta-hot)]">
                  {placeFlash}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Btn
                  tone="accent"
                  disabled={!location || !room || Boolean(busy)}
                  onClick={() => void genPlace()}
                >
                  {busy === "place" ? "..." : "Gen place"}
                </Btn>
                {!location ? (
                  <p className="self-center text-xs text-[var(--fail)]">
                    Pick a place above first
                  </p>
                ) : !room ? (
                  <p className="self-center text-xs text-[var(--fail)]">
                    Pick a room above first
                  </p>
                ) : null}
                {activePlace && activePlace.status === "pending" ? (
                  <>
                    <Btn
                      tone="ok"
                      disabled={Boolean(busy)}
                      onClick={() =>
                        void setPlaceStatus(activePlace.id, "approved")
                      }
                    >
                      {busy === "placeStatus:approved" ? "..." : "Approve"}
                    </Btn>
                    <Btn
                      tone="magenta"
                      disabled={Boolean(busy)}
                      onClick={() =>
                        void setPlaceStatus(
                          activePlace.id,
                          "parked",
                          "Parked keeper from scene kit",
                        )
                      }
                    >
                      Park this
                    </Btn>
                    <Btn
                      tone="danger"
                      disabled={Boolean(busy)}
                      onClick={() =>
                        void setPlaceStatus(
                          activePlace.id,
                          "rejected",
                          rejectReason || "Not skidmarky enough",
                        )
                      }
                    >
                      Reject
                    </Btn>
                  </>
                ) : null}
                {activePlace && activePlace.status === "approved" ? (
                  <>
                    <span className="self-center text-sm text-[var(--acid)]">
                      Locked OK
                    </span>
                    <Btn
                      tone="magenta"
                      disabled={Boolean(busy)}
                      onClick={() =>
                        void setPlaceStatus(
                          activePlace.id,
                          "parked",
                          "Parked keeper from scene kit",
                        )
                      }
                    >
                      Park (unlock)
                    </Btn>
                  </>
                ) : null}
              </div>
              {parkedPlates.length > 0 ? (
                <div className="mt-3 border-t border-[var(--line)] pt-3">
                  <p className="mb-2 text-[10px] uppercase tracking-wider text-[var(--magenta-hot)]">
                    Parked places
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {parkedPlates.map((p) => {
                      const src = `/api/locations/${location!.id}/rooms/${room!.id}/plates/${p.id}`;
                      return (
                        <div key={p.id} className="w-28">
                          <button
                            type="button"
                            className="block w-full"
                            title="Expand parked"
                            onClick={() =>
                              setPreview({
                                src,
                                title: `Parked - ${location!.name}`,
                              })
                            }
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={src}
                              alt="Parked"
                              className="aspect-video w-full rounded-sm object-cover ring-1 ring-[var(--magenta)]"
                            />
                          </button>
                          <button
                            type="button"
                            className="mt-1 w-full text-[10px] text-[var(--acid)] hover:underline"
                            disabled={Boolean(busy)}
                            onClick={() => void relockParked(p.id)}
                          >
                            re-lock
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Cast overview - hide with X */}
            {castOverviewOpen ? (
              <div className="relative rounded-sm border border-[var(--line)] p-3 lg:col-span-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-[10px] uppercase tracking-wider text-[var(--acid)]">
                    Cast
                  </p>
                  <button
                    type="button"
                    title="Hide cast strip"
                    className="rounded-sm border border-[var(--line)] px-1.5 py-0.5 text-xs text-[var(--mute)] hover:border-[var(--fail)] hover:text-[var(--fail)]"
                    onClick={() => setCastOverviewOpen(false)}
                  >
                    X
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  {(episode.cast || []).map((c) => {
                    const thumb = faceThumb(c, episodeId);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setCastId(c.id);
                          setCastDeskOpen(true);
                        }}
                        className={`rounded-sm border p-1.5 text-left ${
                          c.id === castId
                            ? "border-[var(--acid)] bg-[var(--panel-2)]"
                            : "border-[var(--line)] hover:border-[var(--magenta)]"
                        }`}
                      >
                        {thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={thumb}
                            alt={c.name}
                            className="mb-1 aspect-[3/4] w-full rounded-sm object-cover"
                          />
                        ) : (
                          <div className="mb-1 flex aspect-[3/4] items-center justify-center bg-[var(--panel-2)] text-[10px] text-[var(--mute)]">
                            ?
                          </div>
                        )}
                        <span className="block truncate text-xs">{c.name}</span>
                        <span className="text-[9px] text-[var(--mute)]">
                          {c.approvedFaceId ? "locked" : "needs face"}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-[10px] text-[var(--mute)]">
                  Click a face {"->"} Cast face below. Park first; delete only
                  from Parked.
                </p>
              </div>
            ) : (
              <div className="flex items-center justify-center rounded-sm border border-dashed border-[var(--line)] p-3 lg:col-span-3">
                <button
                  type="button"
                  className="text-xs text-[var(--acid)] hover:underline"
                  onClick={() => setCastOverviewOpen(true)}
                >
                  Show cast strip
                </button>
              </div>
            )}
          </div>
        </>
      ) : null}

      {/* Cast face desk - same loop as Place */}
      <div className="rounded-sm border border-[var(--line)] p-4">
        <button
          type="button"
          className="mb-1 flex w-full flex-wrap items-start justify-between gap-2 text-left"
          onClick={() => setCastDeskOpen((o) => !o)}
          aria-expanded={castDeskOpen}
        >
          <div>
            <h4 className="display text-lg">
              <span className="mr-2 text-[var(--acid)]">
                {castDeskOpen ? "-" : "+"}
              </span>
              Cast face
            </h4>
            <p className="text-xs text-[var(--mute)]">
              {castDeskOpen
                ? "Pick cast -> prompt prefills -> Gen face -> Approve / Park / Reject. Reject reason steers the next take."
                : `${castLocked}/${castTotal || 0} faces locked - click to edit faces / voices`}
            </p>
          </div>
          <span className="rounded-sm border border-[var(--line)] px-2 py-1 text-[10px] uppercase tracking-wider text-[var(--mute)]">
            {castDeskOpen ? "Hide" : "Show"}
          </span>
        </button>
        {castDeskOpen ? (
          <div className="mt-3 grid gap-4 lg:grid-cols-12">
            <div className="space-y-3 lg:col-span-7">
              <Field label="New cast member">
                <div className="flex flex-wrap gap-2">
                  <TextInput
                    className="min-w-[10rem] flex-1"
                    value={newCastName}
                    onChange={(e) => setNewCastName(e.target.value)}
                    placeholder="Chloe, Sarah, Mum…"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void createCastMember();
                    }}
                  />
                  <Btn
                    tone="accent"
                    disabled={Boolean(busy) || !newCastName.trim()}
                    onClick={() => void createCastMember()}
                  >
                    {busy === "newCast" ? "Adding…" : "Add cast"}
                  </Btn>
                </div>
              </Field>
              <Field label="Character (episode cast)">
                <Select
                  value={castId}
                  onChange={(e) => setCastId(e.target.value)}
                >
                  <option value=""> - pick cast - </option>
                  {(episode.cast || []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.approvedFaceId ? " OK" : ""}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Who they are (goes into every Gen face)">
                <TextArea
                  rows={3}
                  value={roleNote}
                  onChange={(e) => setRoleNote(e.target.value)}
                  placeholder="Look, age, hair, build - not what they're holding"
                  disabled={!selectedCast}
                />
                <div className="mt-2">
                  <Btn
                    tone="default"
                    disabled={
                      !selectedCast ||
                      Boolean(busy) ||
                      roleNote === (selectedCast?.roleNote || "")
                    }
                    onClick={() => void saveRoleNote()}
                  >
                    {busy === `role:${castId}`
                      ? "Saving..."
                      : "Save who they are"}
                  </Btn>
                </div>
              </Field>
              <Field label="Reference image (your stock picture - not the final face)">
                <input
                  key={castRefInputKey}
                  type="file"
                  accept="image/*"
                  onChange={(e) => setCastRefFile(e.target.files?.[0] || null)}
                  disabled={!selectedCast}
                  className="mb-2 block w-full text-sm text-[var(--chrome-dim)] file:mr-3 file:rounded-sm file:border file:border-[var(--line)] file:bg-[var(--panel-2)] file:px-3 file:py-1.5 file:text-[var(--chrome)]"
                />
                <Btn
                  tone="default"
                  disabled={!selectedCast || !castRefFile || Boolean(busy)}
                  onClick={() => void addCastRef()}
                >
                  {busy === `ref:${castId}` ? "Saving..." : "Save as reference"}
                </Btn>
                {(selectedCast?.references || []).length > 0 ? (
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {(selectedCast?.references || []).map((r) => (
                      <li
                        key={r.id}
                        className="relative h-20 w-16 overflow-hidden rounded-sm border border-[var(--line)]"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/api/episodes/${episodeId}/cast/${castId}/refs/${r.id}`}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                        <button
                          type="button"
                          disabled={Boolean(busy)}
                          className="absolute inset-x-0 bottom-0 bg-black/70 text-[9px] text-[var(--fail)] disabled:opacity-40"
                          onClick={() => void removeCastRef(r.id)}
                        >
                          remove
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </Field>
              <Field label="Reject / avoid in next take">
                <TextInput
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="metal nameplate on mouth / too pretty / wrong age..."
                  disabled={!selectedCast}
                />
              </Field>
              {faceFlash ? (
                <p className="text-sm text-[var(--magenta-hot)]">{faceFlash}</p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Btn
                  tone="accent"
                  disabled={!selectedCast || Boolean(busy)}
                  onClick={() => void genCastFace()}
                >
                  {busy.startsWith("face:") ? "Generating..." : "Gen face"}
                </Btn>
                {selectedCast ? (
                  <Btn
                    tone="accent"
                    disabled={Boolean(busy)}
                    onClick={() => void genCastVoice(selectedCast.id)}
                  >
                    {busy === `voice:${selectedCast.id}` ? "..." : "Gen voice"}
                  </Btn>
                ) : null}
              </div>
              {selectedCast ? (
                <details className="rounded-sm border border-[var(--line)] p-2">
                  <summary className="cursor-pointer text-[10px] uppercase tracking-wider text-[var(--mute)]">
                    Voice
                    {selectedCast.approvedVoiceId
                      ? ` - locked OK (${selectedCast.approvedVoiceId.slice(0, 8)}...)`
                      : " - not locked"}
                    {(selectedCast.voiceAttempts || []).length
                      ? ` | ${(selectedCast.voiceAttempts || []).length} takes`
                      : ""}
                  </summary>
                  <div className="mt-2 space-y-2">
                    <Field label="Voice prompt (goes into every Gen voice)">
                      <TextArea
                        rows={3}
                        value={voiceDesc}
                        onChange={(e) => setVoiceDesc(e.target.value)}
                        placeholder="Age, accent, delivery - say what you want, not what you don't"
                      />
                    </Field>
                    <Btn
                      tone="default"
                      disabled={
                        Boolean(busy) ||
                        voiceDesc === (selectedCast.voiceDescription || "")
                      }
                      onClick={() => void saveVoiceNote()}
                    >
                      {busy === `voiceNote:${castId}`
                        ? "Saving..."
                        : "Save voice prompt"}
                    </Btn>
                    <p className="text-xs text-[var(--mute)]">
                      All takes kept (old ones too). Click {"->"} listen {"->"}{" "}
                      Keep to switch. Then Rebuild mp3 (Speaker ={" "}
                      {selectedCast.name}).
                    </p>
                    {(selectedCast.voiceAttempts || []).length === 0 ? (
                      <p className="text-sm text-[var(--mute)]">
                        No samples yet - hit Gen voice
                      </p>
                    ) : (
                      <>
                        <ul className="max-h-40 space-y-1 overflow-y-auto">
                          {[...(selectedCast.voiceAttempts || [])]
                            .reverse()
                            .map((v, i) => {
                              const selected = v.id === voiceListenId;
                              const label =
                                v.status === "approved"
                                  ? "KEEPER"
                                  : v.reason === "Superseded"
                                    ? "OLD"
                                    : v.status === "rejected"
                                      ? "DUD"
                                      : "pending";
                              return (
                                <li
                                  key={v.id}
                                  className={`flex items-stretch gap-0 rounded-sm border ${
                                    selected
                                      ? "border-[var(--acid)] bg-[var(--panel-2)]"
                                      : v.status === "approved"
                                        ? "border-[var(--acid)]/50"
                                        : "border-[var(--line)]"
                                  }`}
                                >
                                  <button
                                    type="button"
                                    title="Remove this take"
                                    disabled={Boolean(busy)}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void deleteVoiceTake(
                                        selectedCast.id,
                                        v.id,
                                      );
                                    }}
                                    className="px-2 text-sm text-[var(--magenta-hot)] hover:bg-[var(--magenta)]/20 disabled:opacity-40"
                                  >
                                    X
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setVoiceListenId(v.id)}
                                    className="flex min-w-0 flex-1 items-center justify-between gap-2 px-2 py-1.5 text-left text-sm hover:bg-white/5"
                                  >
                                    <span>
                                      Take {i + 1}
                                      {selected ? (
                                        <span className="ml-2 text-[10px] text-[var(--acid)]">
                                          {" "}
                                          OK
                                        </span>
                                      ) : null}
                                    </span>
                                    <span
                                      className={`text-[10px] uppercase ${
                                        v.status === "approved"
                                          ? "text-[var(--acid)]"
                                          : "text-[var(--mute)]"
                                      }`}
                                    >
                                      {label}
                                    </span>
                                  </button>
                                </li>
                              );
                            })}
                        </ul>

                        {listenVoice?.fileName ? (
                          <div className="rounded-sm border border-[var(--acid)]/40 p-2">
                            <audio
                              key={listenVoice.id}
                              controls
                              autoPlay={false}
                              src={`/api/episodes/${episodeId}/cast/${selectedCast.id}/voices/${listenVoice.id}`}
                              className="w-full"
                            />
                            <div className="mt-2 flex flex-wrap gap-2">
                              {listenVoice.status === "approved" ? (
                                <span className="text-sm text-[var(--acid)]">
                                  Locked keeper OK - Rebuild mp3 on shots
                                </span>
                              ) : (
                                <>
                                  <Btn
                                    tone="ok"
                                    disabled={Boolean(busy)}
                                    onClick={() =>
                                      void setVoiceStatus(
                                        selectedCast.id,
                                        listenVoice.id,
                                        "approved",
                                      )
                                    }
                                  >
                                    Keep voice
                                  </Btn>
                                  {listenVoice.status !== "rejected" ||
                                  listenVoice.reason === "Superseded" ? (
                                    <Btn
                                      tone="danger"
                                      disabled={Boolean(busy)}
                                      onClick={() =>
                                        void setVoiceStatus(
                                          selectedCast.id,
                                          listenVoice.id,
                                          "rejected",
                                        )
                                      }
                                    >
                                      Dud
                                    </Btn>
                                  ) : null}
                                </>
                              )}
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-[var(--mute)]">
                            Click a take to listen
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </details>
              ) : null}
            </div>

            <div className="rounded-sm border border-[var(--line)] p-3 lg:col-span-5">
              <p className="mb-2 text-[10px] uppercase tracking-wider text-[var(--acid)]">
                Face (active){selectedCast ? ` - ${selectedCast.name}` : ""}
              </p>
              {activeFaceSrc ? (
                <button
                  type="button"
                  className="mb-3 block w-full"
                  onClick={() =>
                    setPreview({
                      src: activeFaceSrc,
                      title: selectedCast?.name || "Cast",
                    })
                  }
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={activeFaceSrc}
                    alt={selectedCast?.name || "Cast"}
                    className="mx-auto aspect-[3/4] max-h-[420px] w-full max-w-sm rounded-sm object-cover hover:ring-1 hover:ring-[var(--acid)]"
                  />
                </button>
              ) : (
                <div className="mb-3 flex aspect-[3/4] max-h-[420px] items-center justify-center bg-[var(--panel-2)] text-sm text-[var(--mute)]">
                  no face yet
                </div>
              )}
              {activeFace?.status === "pending" ? (
                <div className="flex flex-wrap gap-2">
                  <Btn
                    tone="ok"
                    disabled={Boolean(busy)}
                    onClick={() =>
                      void setFaceStatus(
                        selectedCast!.id,
                        activeFace.id,
                        "approved",
                      )
                    }
                  >
                    Approve
                  </Btn>
                  <Btn
                    tone="magenta"
                    disabled={Boolean(busy)}
                    onClick={() =>
                      void setFaceStatus(
                        selectedCast!.id,
                        activeFace.id,
                        "parked",
                      )
                    }
                  >
                    Park this
                  </Btn>
                  <Btn
                    tone="danger"
                    disabled={Boolean(busy)}
                    onClick={() =>
                      void setFaceStatus(
                        selectedCast!.id,
                        activeFace.id,
                        "rejected",
                      )
                    }
                  >
                    Reject
                  </Btn>
                </div>
              ) : null}
              {activeFace?.status === "approved" ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-[var(--acid)]">Locked OK</span>
                  <Btn
                    tone="magenta"
                    disabled={Boolean(busy)}
                    onClick={() =>
                      void setFaceStatus(
                        selectedCast!.id,
                        activeFace.id,
                        "parked",
                      )
                    }
                  >
                    Park (unlock)
                  </Btn>
                </div>
              ) : null}
              {allFaceTakes.length > 0 ? (
                <div className="mt-3 border-t border-[var(--line)] pt-3">
                  <p className="mb-2 text-[10px] uppercase text-[var(--mute)]">
                    All face takes ({allFaceTakes.length}) - click to preview
                  </p>
                  <div className="flex max-h-48 flex-wrap gap-2 overflow-y-auto">
                    {allFaceTakes.map((p) => {
                      const src = `/api/episodes/${episodeId}/cast/${selectedCast!.id}/faces/${p.id}`;
                      const isActive = activeFace?.id === p.id;
                      const isLocked = selectedCast?.approvedFaceId === p.id;
                      return (
                        <div key={p.id} className="group relative w-16">
                          <button
                            type="button"
                            title={`${p.status}${p.note ? ` - ${p.note}` : ""}`}
                            className={`relative w-full overflow-hidden rounded-sm border ${
                              isActive
                                ? "border-[var(--acid)]"
                                : "border-[var(--line)]"
                            }`}
                            onClick={() =>
                              setPreview({
                                src,
                                title: `${selectedCast?.name || "Cast"} (${p.status})`,
                              })
                            }
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={src}
                              alt=""
                              className="aspect-[3/4] w-full object-cover"
                            />
                            <span className="absolute inset-x-0 bottom-0 bg-black/70 text-center text-[8px] uppercase text-[var(--chrome)]">
                              {p.status === "approved"
                                ? "lock"
                                : p.status === "parked"
                                  ? "park"
                                  : p.status === "rejected"
                                    ? "dud"
                                    : "new"}
                            </span>
                          </button>
                          {!isLocked ? (
                            <button
                              type="button"
                              title="Delete this take"
                              disabled={Boolean(busy)}
                              onClick={(e) => {
                                e.stopPropagation();
                                void deleteParkedFace(selectedCast!.id, p.id);
                              }}
                              className="absolute right-0 top-0 z-10 flex h-5 w-5 items-center justify-center rounded-sm bg-black/80 text-xs leading-none text-[var(--fail)] opacity-0 hover:bg-[var(--fail)]/40 group-hover:opacity-100 disabled:opacity-40"
                            >
                              X
                            </button>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
              {parkedFaces.length > 0 ? (
                <div className="mt-3 border-t border-[var(--line)] pt-3">
                  <p className="mb-2 text-[10px] uppercase text-[var(--magenta-hot)]">
                    Parked faces - re-lock or remove
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {parkedFaces.map((p) => {
                      const src = `/api/episodes/${episodeId}/cast/${selectedCast!.id}/faces/${p.id}`;
                      return (
                        <div key={p.id} className="relative w-20">
                          <button
                            type="button"
                            className="w-full"
                            title="Re-lock"
                            onClick={() =>
                              void setFaceStatus(
                                selectedCast!.id,
                                p.id,
                                "approved",
                              )
                            }
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={src}
                              alt="Parked"
                              className="aspect-[3/4] w-full rounded-sm object-cover ring-1 ring-[var(--magenta)]"
                            />
                            <span className="text-[10px] text-[var(--acid)]">
                              re-lock
                            </span>
                          </button>
                          <button
                            type="button"
                            title="Delete this picture"
                            disabled={Boolean(busy)}
                            onClick={() =>
                              void deleteParkedFace(selectedCast!.id, p.id)
                            }
                            className="absolute right-0 top-0 flex h-5 w-5 items-center justify-center rounded-sm bg-black/75 text-xs leading-none text-[var(--fail)] hover:bg-[var(--fail)]/30 disabled:opacity-40"
                          >
                            X
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {/* Crash Lab - morph clips shelf (separate from Cast face) */}
      <div className="mt-4 rounded-sm border border-[var(--line)] p-4">
        <button
          type="button"
          className="mb-1 flex w-full flex-wrap items-start justify-between gap-2 text-left"
          onClick={() => setCrashDeskOpen((o) => !o)}
          aria-expanded={crashDeskOpen}
        >
          <div>
            <h4 className="text-sm font-semibold text-[var(--magenta-hot)]">
              <span className="mr-2 text-[var(--magenta)]">
                {crashDeskOpen ? "-" : "+"}
              </span>
              Crash Lab
            </h4>
            <p className="text-xs text-[var(--mute)]">
              {crashDeskOpen
                ? "Shelf from Crash Lab Morph. Put on a beat via Crash Lab -> on Shot Desk. X removes from shelf."
                : `${(episode.crashMorphs || []).length} morph${
                    (episode.crashMorphs || []).length === 1 ? "" : "s"
                  } - click to browse`}
            </p>
          </div>
          <span className="rounded-sm border border-[var(--line)] px-2 py-1 text-[10px] uppercase tracking-wider text-[var(--mute)]">
            {crashDeskOpen ? "Hide" : "Show"}
          </span>
        </button>
        {crashDeskOpen ? (
          <div className="mt-3 space-y-3">
            {(episode.crashMorphs || []).length === 0 ? (
              <p className="text-xs text-[var(--mute)]">
                No morphs yet - add from{" "}
                <Link
                  href="/crash"
                  className="text-[var(--acid)] hover:underline"
                >
                  Crash Lab Morph
                </Link>
                .
              </p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {(episode.crashMorphs || []).map((m) => {
                  const sc = episode.scenes.find((s) => s.id === m.sceneId);
                  const sh = sc?.shots.find((x) => x.id === m.shotId);
                  const src = `/api/episodes/${episodeId}/plates/${encodeURIComponent(m.fileName)}`;
                  const isStill =
                    m.kind === "still" || !m.fileName.endsWith(".mp4");
                  const assigned = Boolean(m.sceneId && m.shotId && m.beatId);
                  const shotLabel =
                    `${sc?.title || sc?.slug || "scene"} | ${sh?.code || ""} ${sh?.title || ""}`.trim();
                  const kindLabel = isStill ? "Still" : "Morph";
                  return (
                    <div
                      key={m.id}
                      className="relative w-[160px] overflow-hidden rounded-sm border border-[var(--line)]"
                    >
                      <button
                        type="button"
                        className="absolute right-0 top-0 z-[1] flex h-4 w-4 items-center justify-center bg-black/70 text-[11px] font-bold leading-none text-[var(--chrome)] hover:bg-[var(--fail)] hover:text-white"
                        title="Remove from Crash Lab"
                        disabled={busy === `crash-del:${m.id}`}
                        onClick={() => void removeCrashEntry(m.id)}
                      >
                        X
                      </button>
                      <button
                        type="button"
                        className="w-full text-left hover:opacity-90"
                        onClick={() =>
                          setMorphPreview({
                            src,
                            title: assigned
                              ? shotLabel
                              : `${kindLabel} - ${m.fileName}`,
                            still: isStill,
                          })
                        }
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
                      </button>
                      <div className="space-y-0.5 px-1.5 py-1.5">
                        <p
                          className={`truncate text-[10px] ${
                            assigned
                              ? "text-[var(--acid-deep)]"
                              : "text-[var(--chrome)]"
                          }`}
                        >
                          {assigned ? "On beat *" : "Off beat"}
                        </p>
                        <p
                          className="truncate text-[9px] text-[var(--mute)]"
                          title={m.fileName}
                        >
                          {assigned
                            ? shotLabel
                            : `${kindLabel} - ${m.fileName}`}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}
      </div>

      {preview ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={preview.title}
          onClick={() => setPreview(null)}
        >
          <div
            className="relative max-h-[92vh] max-w-[min(960px,96vw)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="display text-xl text-[var(--chrome)]">
                {preview.title}
              </p>
              <Btn tone="magenta" onClick={() => setPreview(null)}>
                Close
              </Btn>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview.src}
              alt={preview.title}
              className="max-h-[85vh] w-auto max-w-full rounded-sm border border-[var(--line)] object-contain"
            />
            <p className="mt-2 text-center text-xs text-[var(--mute)]">
              Click outside or Close
            </p>
          </div>
        </div>
      ) : null}

      {morphPreview ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={morphPreview.title}
          onClick={() => setMorphPreview(null)}
        >
          <div
            className="relative max-h-[92vh] max-w-[min(960px,96vw)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-sm text-[var(--chrome)]">
                {morphPreview.title}
              </p>
              <Btn
                tone="magenta"
                className="!px-2 !py-0.5 !text-[11px]"
                onClick={() => setMorphPreview(null)}
              >
                Close
              </Btn>
            </div>
            {morphPreview.still ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={morphPreview.src}
                alt={morphPreview.title}
                className="mx-auto block h-auto max-h-[80vh] w-auto max-w-full rounded-sm border border-[var(--line)] object-contain"
              />
            ) : (
              <video
                src={morphPreview.src}
                controls
                autoPlay
                className="mx-auto block h-auto max-h-[80vh] w-auto max-w-full rounded-sm border border-[var(--line)] bg-black object-contain"
              />
            )}
          </div>
        </div>
      ) : null}
    </Panel>
  );
}
