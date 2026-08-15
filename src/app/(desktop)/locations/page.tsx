"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Btn, Field, Panel, Pill, Select, TextArea, TextInput } from "@/components/ui";
import type { Character, Location } from "@/lib/types";

const NONE_KEY = "__none__";

function bestLocPlate(locs: Location[]): {
  locId: string;
  roomId: string;
  plateId: string;
} | null {
  // Prefer locked plates, then any file on disk
  for (const l of locs) {
    for (const r of l.rooms || []) {
      const locked = r.plateAttempts.find(
        (a) => a.id === r.approvedPlateId && a.fileName,
      );
      if (locked)
        return { locId: l.id, roomId: r.id, plateId: locked.id };
    }
  }
  for (const l of locs) {
    for (const r of l.rooms || []) {
      const any = [...r.plateAttempts]
        .reverse()
        .find((a) => a.fileName);
      if (any) return { locId: l.id, roomId: r.id, plateId: any.id };
    }
  }
  return null;
}

function charFaceSrc(c: Character): string | null {
  const id =
    c.approvedFaceId ||
    c.faceAttempts.find((a) => a.status === "approved" && a.fileName)?.id ||
    c.faceAttempts.find((a) => a.fileName)?.id ||
    "";
  if (!id) return null;
  return `/api/characters/${c.id}/faces/${id}`;
}

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [lookNote, setLookNote] = useState("");
  const [characterId, setCharacterId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);

  async function refresh() {
    const [lRes, cRes] = await Promise.all([
      fetch("/api/locations"),
      fetch("/api/characters"),
    ]);
    setLocations((await lRes.json()).locations || []);
    setCharacters((await cRes.json()).characters || []);
  }

  useEffect(() => {
    refresh().catch((e) => setError(String(e)));
  }, []);

  async function create() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          notes,
          lookNote,
          characterIds: characterId ? [characterId] : [],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Create failed");
      window.location.href = `/locations/${data.location.id}`;
    } catch (e) {
      setError(String(e));
      setBusy(false);
    }
  }

  const groups = useMemo(() => {
    const map = new Map<string, Location[]>();
    for (const c of characters) map.set(c.id, []);
    map.set(NONE_KEY, []);
    for (const l of locations) {
      if (!l.characterIds.length) {
        map.get(NONE_KEY)!.push(l);
        continue;
      }
      for (const cid of l.characterIds) {
        if (!map.has(cid)) map.set(cid, []);
        map.get(cid)!.push(l);
      }
    }
    return map;
  }, [locations, characters]);

  function CharacterTile({ c }: { c: Character }) {
    const locs = groups.get(c.id) || [];
    const plate = bestLocPlate(locs);
    const face = charFaceSrc(c);
    const thumbSrc = plate
      ? `/api/locations/${plate.locId}/rooms/${plate.roomId}/plates/${plate.plateId}`
      : face;
    const plateCount = locs.reduce(
      (n, l) =>
        n +
        l.rooms.reduce(
          (m, r) => m + r.plateAttempts.filter((a) => a.fileName).length,
          0,
        ),
      0,
    );
    return (
      <Link
        href={`/locations/character/${c.id}`}
        className="flex gap-3 rounded-sm border border-[var(--line)] bg-[var(--panel)] p-3 transition hover:border-[var(--acid)]"
      >
        <div className="h-24 w-32 shrink-0 overflow-hidden rounded-sm border border-[var(--line)] bg-[var(--panel-2)]">
          {thumbSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbSrc}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-[10px] text-[var(--mute)]">
              no plate
            </div>
          )}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="display text-lg">
              {c.name}
              {c.approved ? " ✓" : ""}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            <Pill tone={locs.length ? "ok" : "mute"}>
              {locs.length} location{locs.length === 1 ? "" : "s"}
            </Pill>
            {plateCount > 0 ? (
              <Pill tone="magenta">
                {plateCount} image{plateCount === 1 ? "" : "s"}
              </Pill>
            ) : null}
          </div>
        </div>
      </Link>
    );
  }

  const shared = groups.get(NONE_KEY) || [];

  return (
    <div className="grid gap-8 lg:grid-cols-[1.35fr_0.65fr]">
      <section>
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--acid)]">
          Shared pool · reuse forever
        </p>
        <h2 className="display mb-2 text-3xl">Location Lab</h2>
        <p className="mb-6 max-w-lg text-sm text-[var(--chrome-dim)]">
          Pick a character to see their places. Generate as many plates as you
          want per location. Faces &amp; voices live on the episode Cast desk;
          assholes themselves are in{" "}
          <Link href="/lab" className="text-[var(--magenta-hot)] underline">
            Character Lab
          </Link>
          .
        </p>

        {characters.length === 0 && locations.length === 0 ? (
          <Panel className="p-6 text-[var(--mute)]">
            No locations yet. Add one on the right.
          </Panel>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {characters.map((c) => (
              <CharacterTile key={c.id} c={c} />
            ))}

            {shared.length > 0 ? (
              <Link
                href="/locations/character/__shared__"
                className="flex gap-3 rounded-sm border border-dashed border-[var(--line)] bg-[var(--panel)] p-3 transition hover:border-[var(--magenta)]"
              >
                <div className="flex h-24 w-32 shrink-0 items-center justify-center rounded-sm border border-[var(--line)] bg-[var(--panel-2)] text-[10px] text-[var(--mute)]">
                  shared
                </div>
                <div className="min-w-0">
                  <span className="display text-lg">
                    Shared / no character
                  </span>
                  <Pill tone="mute">{shared.length}</Pill>
                </div>
              </Link>
            ) : null}
          </div>
        )}
        {error ? (
          <p className="mt-4 text-sm text-[var(--fail)]">{error}</p>
        ) : null}
      </section>

      <section className="space-y-4">
        <Panel className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="display text-xl">New location</h3>
            {formOpen ? (
              <button
                onClick={() => setFormOpen(false)}
                className="text-xs text-[var(--mute)] hover:underline"
              >
                Collapse
              </button>
            ) : null}
          </div>
          {!formOpen ? (
            <Btn tone="accent" onClick={() => setFormOpen(true)}>
              + Add a location
            </Btn>
          ) : (
            <>
              <Field label="Tied to character">
                <Select
                  value={characterId}
                  onChange={(e) => setCharacterId(e.target.value)}
                >
                  <option value="">— none / shared —</option>
                  {characters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.approved ? " ✓" : ""}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Name">
                <TextInput
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Darryl's house"
                />
              </Field>
              <Field label="What is this place">
                <TextArea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Filthy rental, nicotine walls…"
                />
              </Field>
              <Field label="Look notes (for Generate)">
                <TextArea
                  value={lookNote}
                  onChange={(e) => setLookNote(e.target.value)}
                  rows={3}
                  placeholder="Overcast through dirty blinds, stained carpet…"
                />
              </Field>
              <Btn
                tone="accent"
                disabled={busy || !name.trim()}
                onClick={create}
              >
                {busy ? "Creating…" : "Create & open"}
              </Btn>
            </>
          )}
        </Panel>

        <Panel className="p-5">
          <h3 className="display mb-2 text-lg">Assholes / victims</h3>
          <p className="mb-3 text-sm text-[var(--mute)]">
            Edit names, look lines, and scripts in Character Lab. Faces &amp;
            voices for an episode stay on Cast face.
          </p>
          <Link href="/lab">
            <Btn tone="magenta" className="w-full">
              Open Character Lab →
            </Btn>
          </Link>
        </Panel>
      </section>
    </div>
  );
}
