"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { downloadUrl } from "@/components/CopyBits";
import { Btn, Field, Panel, Pill, TextArea, TextInput } from "@/components/ui";
import {
  styleRealismLabel,
  type Character,
  type Location,
  type Room,
} from "@/lib/types";

/**
 * Everything about ONE location: describe it, generate a plate, approve /
 * reject / delete attempts. Most locations only ever have a single room
 * ("Main"), so the room layer stays hidden until a second room is added —
 * that's when the Rooms switcher and per-room panels show up.
 */
export function LocationEditor({
  locationId,
  onDeleted,
}: {
  locationId: string;
  onDeleted?: () => void;
}) {
  const [location, setLocation] = useState<Location | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [roomId, setRoomId] = useState("");
  const [newRoomName, setNewRoomName] = useState("");
  const [note, setNote] = useState("");
  const [styleRealism, setStyleRealism] = useState(60);
  const [refFile, setRefFile] = useState<File | null>(null);
  const [imageReady, setImageReady] = useState<boolean | null>(null);
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>(
    {},
  );
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ src: string; title: string } | null>(
    null,
  );

  const load = useCallback(async () => {
    const [lRes, cRes, gRes] = await Promise.all([
      fetch(`/api/locations/${locationId}`),
      fetch("/api/characters"),
      fetch(`/api/locations/${locationId}/generate`),
    ]);
    const data = await lRes.json();
    if (!lRes.ok) throw new Error(data.error || "Load failed");
    setLocation(data.location);
    setCharacters((await cRes.json()).characters || []);
    setImageReady(Boolean((await gRes.json().catch(() => ({}))).imageReady));
    setRoomId((prev) => {
      if (prev && data.location.rooms?.some((r: Room) => r.id === prev))
        return prev;
      return data.location.rooms?.[0]?.id || "";
    });
  }, [locationId]);

  useEffect(() => {
    load().catch((e) => setError(String(e)));
  }, [load]);

  const room = useMemo(
    () => location?.rooms.find((r) => r.id === roomId) || null,
    [location, roomId],
  );
  const multiRoom = (location?.rooms.length || 0) > 1;

  async function saveMeta() {
    if (!location) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/locations/${locationId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: location.name,
          notes: location.notes,
          lookNote: location.lookNote,
          characterIds: location.characterIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setLocation(data.location);
      setStatus("Saved");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function saveRoom() {
    if (!location || !room) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(
        `/api/locations/${locationId}/rooms/${room.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: room.name,
            notes: room.notes,
            lookNote: room.lookNote,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setLocation(data.location);
      setStatus("Saved");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  /** Single-room locations: one Save button, name + room notes/look together. */
  async function saveSingle() {
    if (!location || !room) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/locations/${locationId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: location.name,
          notes: location.notes,
          lookNote: location.lookNote,
          characterIds: location.characterIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      const res2 = await fetch(
        `/api/locations/${locationId}/rooms/${room.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: room.name,
            notes: room.notes,
            lookNote: room.lookNote,
          }),
        },
      );
      const data2 = await res2.json();
      if (!res2.ok) throw new Error(data2.error || "Save failed");
      setLocation(data2.location);
      setStatus("Saved");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function createRoom() {
    if (!newRoomName.trim()) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/locations/${locationId}/rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newRoomName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Create failed");
      setLocation(data.location);
      setRoomId(data.room.id);
      setNewRoomName("");
      setStatus(`Room "${data.room.name}" added`);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function removeRoom() {
    if (!room) return;
    if (!confirm(`Delete room "${room.name}"? Plates go with it.`)) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(
        `/api/locations/${locationId}/rooms/${room.id}`,
        { method: "DELETE" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      setLocation(data.location);
      setRoomId(data.location.rooms[0]?.id || "");
      setStatus("Room deleted");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function removeLocation() {
    if (!location) return;
    if (
      !confirm(
        `Delete "${location.name}" completely? Everything for it (plates, refs) is archived, not lost, but it's gone from this list.`,
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/locations/${locationId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
      onDeleted?.();
    } catch (e) {
      setError(String(e));
      setBusy(false);
    }
  }

  async function addReference() {
    if (!refFile || !room) return;
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.set("file", refFile);
      form.set("roomId", room.id);
      const res = await fetch(`/api/locations/${locationId}/refs`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setLocation(data.location);
      setRefFile(null);
      setStatus("Reference saved — Gen plate will use it");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function removeReference(refId: string) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(
        `/api/locations/${locationId}/refs/${refId}`,
        { method: "DELETE" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Remove failed");
      setLocation(data.location);
      setStatus("Reference removed");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function generate() {
    if (!room) return;
    setBusy(true);
    setError("");
    setStatus(`Generating…`);
    try {
      const res = await fetch(`/api/locations/${locationId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note, styleRealism, roomId: room.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generate failed");
      setLocation(data.location);
      setStatus("Plate ready — Approve or Reject");
    } catch (e) {
      setError(String(e));
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  async function setPlate(
    attemptId: string,
    next: "approved" | "rejected" | "parked",
  ) {
    if (!room) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(
        `/api/locations/${locationId}/rooms/${room.id}/plates/${attemptId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: next,
            reason:
              next === "parked"
                ? "Parked keeper"
                : rejectReasons[attemptId] || "",
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      setLocation(data.location);
      setStatus(
        next === "approved"
          ? "Locked — reuse forever"
          : next === "parked"
            ? "Parked — kept forever, not the active lock"
            : "Rejected",
      );
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function deletePlate(attemptId: string, wasApproved: boolean) {
    if (!room) return;
    if (
      wasApproved &&
      !confirm("This is the locked plate. Delete it and unlock this place?")
    )
      return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/locations/${locationId}/rooms/${room.id}/plates/${attemptId}`,
        { method: "DELETE" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      setLocation(data.location);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  function patchRoom(fn: (r: Room) => Room) {
    if (!location || !room) return;
    setLocation({
      ...location,
      rooms: location.rooms.map((r) => (r.id === room.id ? fn(r) : r)),
    });
  }

  if (!location && !error)
    return <p className="text-[var(--mute)]">Loading…</p>;
  if (!location) return <p className="text-[var(--fail)]">{error}</p>;

  const residents = location.characterIds
    .map((cid) => characters.find((c) => c.id === cid))
    .filter(Boolean) as Character[];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="display text-2xl md:text-3xl">{location.name}</h2>
          <div className="mt-1 flex flex-wrap gap-2">
            <Pill tone={location.approved ? "ok" : "mute"}>
              {location.approved ? "locked" : "not locked yet"}
            </Pill>
            {residents.map((c) => (
              <Pill key={c.id} tone="magenta">
                {c.name}
              </Pill>
            ))}
          </div>
        </div>
        <Btn tone="danger" disabled={busy} onClick={removeLocation}>
          Delete location
        </Btn>
      </div>

      <div
        className={
          multiRoom ? "grid gap-6 lg:grid-cols-[220px_1fr]" : "space-y-6"
        }
      >
        {multiRoom ? (
          <aside className="space-y-3">
            <Panel className="p-3">
              <h3 className="display mb-2 text-lg">Rooms</h3>
              <ul className="space-y-1">
                {location.rooms.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => setRoomId(r.id)}
                      className={`flex w-full items-center justify-between rounded-sm border px-2 py-2 text-left text-sm ${
                        r.id === roomId
                          ? "border-[var(--acid)] text-[var(--acid)]"
                          : "border-[var(--line)] text-[var(--chrome-dim)] hover:border-[var(--magenta)]"
                      }`}
                    >
                      <span>{r.name}</span>
                      <Pill tone={r.approved ? "ok" : "mute"}>
                        {r.approved ? "ok" : "…"}
                      </Pill>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="my-3 border-t border-[var(--line)]" />
              <Field label="+ Add another room/area">
                <TextInput
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="e.g. Platform, Kitchen…"
                />
              </Field>
              <Btn
                tone="accent"
                className="w-full"
                disabled={busy || !newRoomName.trim()}
                onClick={createRoom}
              >
                Add room
              </Btn>
            </Panel>
          </aside>
        ) : null}

        <div className="space-y-4">
          {multiRoom ? (
            <Panel className="p-4">
              <h3 className="display mb-2 text-lg">Shared across all rooms</h3>
              <Field label="Location name">
                <TextInput
                  value={location.name}
                  onChange={(e) =>
                    setLocation({ ...location, name: e.target.value })
                  }
                />
              </Field>
              <Field label="Overall place">
                <TextArea
                  value={location.notes}
                  onChange={(e) =>
                    setLocation({ ...location, notes: e.target.value })
                  }
                  rows={2}
                />
              </Field>
              <Field label="House-wide look (shared)">
                <TextArea
                  value={location.lookNote}
                  onChange={(e) =>
                    setLocation({ ...location, lookNote: e.target.value })
                  }
                  rows={2}
                />
              </Field>
              <Btn tone="default" disabled={busy} onClick={saveMeta}>
                Save
              </Btn>
            </Panel>
          ) : null}

          {/* Left = write the place · Right = make the picture (2-up on PC) */}
          <div className="grid gap-4 lg:grid-cols-2">
            {!multiRoom && room ? (
              <Panel className="p-4">
                <h3 className="display mb-1 text-lg">1 · Describe</h3>
                <p className="mb-3 text-xs text-[var(--mute)]">
                  Name it, say what it is, write the look. Hit Save.
                </p>
                <Field label="Name">
                  <TextInput
                    value={location.name}
                    onChange={(e) =>
                      setLocation({ ...location, name: e.target.value })
                    }
                  />
                </Field>
                <Field label="What is this place">
                  <TextArea
                    value={room.notes || ""}
                    onChange={(e) =>
                      patchRoom((r) => ({ ...r, notes: e.target.value }))
                    }
                    rows={2}
                    placeholder="Bridal boutique strip, bus terminal, hell itself…"
                  />
                </Field>
                <Field label="Look (materials, mood, weather)">
                  <TextArea
                    value={room.lookNote || ""}
                    onChange={(e) =>
                      patchRoom((r) => ({ ...r, lookNote: e.target.value }))
                    }
                    rows={5}
                    placeholder="Overcast grey daylight, wet cast iron, stained brick…"
                  />
                </Field>
                <Btn tone="accent" disabled={busy} onClick={saveSingle}>
                  Save
                </Btn>
                <div className="mt-3 border-t border-[var(--line)] pt-3">
                  <Field label="Extra area? (kitchen, platform…)">
                    <div className="flex gap-2">
                      <TextInput
                        value={newRoomName}
                        onChange={(e) => setNewRoomName(e.target.value)}
                        placeholder="e.g. Kitchen"
                      />
                      <Btn
                        tone="default"
                        disabled={busy || !newRoomName.trim()}
                        onClick={createRoom}
                      >
                        + Add
                      </Btn>
                    </div>
                  </Field>
                </div>
              </Panel>
            ) : null}

            {multiRoom && room ? (
              <Panel className="p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="display text-lg">1 · {room.name}</h3>
                  <Btn tone="danger" disabled={busy} onClick={removeRoom}>
                    Delete room
                  </Btn>
                </div>
                <Field label="Room name">
                  <TextInput
                    value={room.name}
                    onChange={(e) =>
                      patchRoom((r) => ({ ...r, name: e.target.value }))
                    }
                  />
                </Field>
                <Field label="This room">
                  <TextArea
                    value={room.notes}
                    onChange={(e) =>
                      patchRoom((r) => ({ ...r, notes: e.target.value }))
                    }
                    rows={2}
                  />
                </Field>
                <Field label="Room look">
                  <TextArea
                    value={room.lookNote}
                    onChange={(e) =>
                      patchRoom((r) => ({ ...r, lookNote: e.target.value }))
                    }
                    rows={4}
                  />
                </Field>
                <Btn tone="accent" disabled={busy} onClick={saveRoom}>
                  Save room
                </Btn>
              </Panel>
            ) : null}

            {room ? (
              <Panel className="p-4">
                <h3 className="display mb-1 text-lg">
                  2 · Generate{multiRoom ? ` — ${room.name}` : ""}
                </h3>
                <p className="mb-3 text-xs text-[var(--mute)]">
                  Optional ref → tweak look slider → type this try → Generate.
                  Make as many as you want.
                </p>
                {imageReady === false ? (
                  <p className="mb-3 text-sm text-[var(--fail)]">
                    Needs XAI_API_KEY.
                  </p>
                ) : null}
                <Field label="Reference (optional)">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setRefFile(e.target.files?.[0] || null)}
                    className="mb-2 block w-full text-sm text-[var(--chrome-dim)] file:mr-3 file:rounded-sm file:border file:border-[var(--line)] file:bg-[var(--panel-2)] file:px-3 file:py-1.5 file:text-[var(--chrome)]"
                  />
                  <Btn
                    tone="default"
                    disabled={busy || !refFile}
                    onClick={addReference}
                  >
                    Save as reference
                  </Btn>
                  {(room.references.length > 0 ||
                    location.references.length > 0) && (
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {[...room.references, ...location.references].map(
                        (r) => (
                          <li
                            key={r.id}
                            className="relative h-16 w-24 overflow-hidden rounded-sm border border-[var(--line)]"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={`/api/locations/${locationId}/refs/${r.id}`}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                            <button
                              type="button"
                              disabled={busy}
                              className="absolute inset-x-0 bottom-0 bg-black/70 text-[9px] text-[var(--fail)] disabled:opacity-40"
                              onClick={() => void removeReference(r.id)}
                            >
                              remove
                            </button>
                          </li>
                        ),
                      )}
                    </ul>
                  )}
                </Field>
                <Field label="Look — cartoon ←→ photo">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={styleRealism}
                    onChange={(e) => setStyleRealism(Number(e.target.value))}
                    className="w-full accent-[var(--acid)]"
                  />
                  <p className="mt-1 text-xs text-[var(--chrome-dim)]">
                    {styleRealism} · {styleRealismLabel(styleRealism)}
                  </p>
                </Field>
                <Field label="This attempt (empty place — no people)">
                  <TextArea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    placeholder="Sticky carpet, wet cast iron stools, grey overcast…"
                  />
                </Field>
                <Btn
                  tone="magenta"
                  className="w-full"
                  disabled={busy || imageReady === false}
                  onClick={generate}
                >
                  {busy ? "Working…" : "Generate plate"}
                </Btn>
                {status ? (
                  <p className="mt-2 text-sm text-[var(--acid)]">{status}</p>
                ) : null}
                {error ? (
                  <p className="mt-2 text-sm text-[var(--fail)]">{error}</p>
                ) : null}
              </Panel>
            ) : (
              <Panel className="p-4 text-[var(--mute)]">
                Add a room on the left.
              </Panel>
            )}
          </div>

          {room ? (
              <section>
                <h3 className="display mb-1 text-xl">3 · Plates</h3>
                <p className="mb-3 text-sm text-[var(--mute)]">
                  Keep generating. Approve one master; park the rest. Download
                  anytime.
                </p>
                {room.plateAttempts.length === 0 ? (
                  <Panel className="p-4 text-[var(--mute)]">
                    Nothing generated yet — use step 2.
                  </Panel>
                ) : (
                  <ul className="flex gap-3 overflow-x-auto pb-2">
                    {[...room.plateAttempts].reverse().map((a) => (
                      <li key={a.id} className="w-72 shrink-0">
                        <Panel className="overflow-hidden">
                          <div className="aspect-video bg-[var(--panel-2)]">
                            {a.fileName ? (
                              <button
                                type="button"
                                className="block h-full w-full"
                                title="Click to expand"
                                onClick={() =>
                                  setPreview({
                                    src: `/api/locations/${locationId}/rooms/${room.id}/plates/${a.id}`,
                                    title: location.name,
                                  })
                                }
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={`/api/locations/${locationId}/rooms/${room.id}/plates/${a.id}`}
                                  alt=""
                                  className="h-full w-full cursor-zoom-in object-cover hover:ring-1 hover:ring-[var(--acid)]"
                                />
                              </button>
                            ) : null}
                          </div>
                          <div className="space-y-2 p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <Pill
                                tone={
                                  a.status === "approved"
                                    ? "ok"
                                    : a.status === "rejected"
                                      ? "fail"
                                      : a.status === "parked"
                                        ? "magenta"
                                        : "mute"
                                }
                              >
                                {a.status === "parked" ? "parked" : a.status}
                              </Pill>
                              {a.fileName ? (
                                <Btn
                                  tone="default"
                                  className="!px-2 !py-1 text-xs"
                                  onClick={() =>
                                    downloadUrl(
                                      `/api/locations/${locationId}/rooms/${room.id}/plates/${a.id}`,
                                      a.fileName || `${location.name}.png`,
                                    )
                                  }
                                >
                                  Download
                                </Btn>
                              ) : null}
                            </div>
                            {a.note ? (
                              <p className="text-xs text-[var(--chrome-dim)]">
                                {a.note}
                              </p>
                            ) : null}
                            {a.status === "parked" ? (
                              <div className="space-y-2">
                                <p className="text-xs text-[var(--magenta-hot)]">
                                  Parked — kept forever.
                                </p>
                                <Btn
                                  tone="ok"
                                  className="w-full"
                                  disabled={busy}
                                  onClick={() => setPlate(a.id, "approved")}
                                >
                                  Re-lock as active
                                </Btn>
                              </div>
                            ) : a.status === "rejected" ? (
                              <div className="flex gap-2">
                                <Btn
                                  tone="magenta"
                                  className="flex-1"
                                  disabled={busy}
                                  onClick={() => setPlate(a.id, "parked")}
                                >
                                  Park
                                </Btn>
                                <Btn
                                  tone="danger"
                                  className="flex-1"
                                  disabled={busy}
                                  onClick={() => deletePlate(a.id, false)}
                                >
                                  Delete
                                </Btn>
                              </div>
                            ) : a.status === "approved" ? (
                              <div className="space-y-2">
                                <p className="text-sm text-[var(--acid)]">
                                  Locked in.
                                </p>
                                <div className="flex gap-2">
                                  <Btn
                                    tone="magenta"
                                    className="flex-1"
                                    disabled={busy}
                                    onClick={() => setPlate(a.id, "parked")}
                                  >
                                    Park (unlock)
                                  </Btn>
                                  <Btn
                                    tone="danger"
                                    className="flex-1"
                                    disabled={busy}
                                    onClick={() => deletePlate(a.id, true)}
                                  >
                                    Delete
                                  </Btn>
                                </div>
                              </div>
                            ) : (
                              <>
                                <TextInput
                                  value={rejectReasons[a.id] || ""}
                                  onChange={(e) =>
                                    setRejectReasons({
                                      ...rejectReasons,
                                      [a.id]: e.target.value,
                                    })
                                  }
                                  placeholder="Reject reason…"
                                />
                                <div className="flex flex-wrap gap-2">
                                  <Btn
                                    tone="ok"
                                    className="flex-1"
                                    disabled={busy}
                                    onClick={() => setPlate(a.id, "approved")}
                                  >
                                    Approve
                                  </Btn>
                                  <Btn
                                    tone="magenta"
                                    className="flex-1"
                                    disabled={busy}
                                    onClick={() => setPlate(a.id, "parked")}
                                  >
                                    Park
                                  </Btn>
                                  <Btn
                                    tone="danger"
                                    className="flex-1"
                                    disabled={busy}
                                    onClick={() => setPlate(a.id, "rejected")}
                                  >
                                    Reject
                                  </Btn>
                                </div>
                              </>
                            )}
                          </div>
                        </Panel>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
          ) : null}
        </div>
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
    </div>
  );
}
