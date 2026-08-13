"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Btn, Field, Panel, Pill, TextInput } from "@/components/ui";
import { LocationEditor } from "@/components/LocationEditor";
import type { Character, Location } from "@/lib/types";

const SHARED_ID = "__shared__";
const NEW_OPTION = "__new__";

function locThumb(l: Location): {
  locId: string;
  roomId: string;
  plateId: string;
  plateCount: number;
} | null {
  const plateCount = l.rooms.reduce(
    (n, r) => n + r.plateAttempts.filter((a) => a.fileName).length,
    0,
  );
  for (const room of l.rooms) {
    const plate =
      room.plateAttempts.find(
        (a) => a.id === room.approvedPlateId && a.fileName,
      ) ||
      [...room.plateAttempts].reverse().find((a) => a.fileName);
    if (plate)
      return {
        locId: l.id,
        roomId: room.id,
        plateId: plate.id,
        plateCount,
      };
  }
  return plateCount ? { locId: l.id, roomId: "", plateId: "", plateCount } : null;
}

export default function CharacterLocationsPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const characterId = String(params.characterId);
  const isShared = characterId === SHARED_ID;

  const [locations, setLocations] = useState<Location[]>([]);
  const [character, setCharacter] = useState<Character | null>(null);
  const [selected, setSelected] = useState<string>(searchParams.get("loc") || "");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [otherOpen, setOtherOpen] = useState(false);

  const load = useCallback(async () => {
    const [lRes, cRes] = await Promise.all([
      fetch("/api/locations"),
      fetch("/api/characters"),
    ]);
    const allLocations: Location[] = (await lRes.json()).locations || [];
    const allCharacters: Character[] = (await cRes.json()).characters || [];
    setLocations(allLocations);
    setCharacter(
      isShared ? null : allCharacters.find((c) => c.id === characterId) || null,
    );
    setLoaded(true);
  }, [characterId, isShared]);

  useEffect(() => {
    load().catch((e) => setError(String(e)));
  }, [load]);

  const myLocations = useMemo(() => {
    if (isShared) return locations.filter((l) => !l.characterIds.length);
    return locations.filter((l) => l.characterIds.includes(characterId));
  }, [locations, characterId, isShared]);

  const otherLocations = useMemo(() => {
    if (isShared) return locations.filter((l) => l.characterIds.length > 0);
    return locations.filter((l) => !l.characterIds.includes(characterId));
  }, [locations, characterId, isShared]);

  // Default to the first location once loaded, unless one was picked via ?loc=
  useEffect(() => {
    if (!loaded) return;
    if (selected === NEW_OPTION) return;
    if (selected && myLocations.some((l) => l.id === selected)) return;
    setSelected(myLocations[0]?.id || "");
  }, [loaded, myLocations, selected]);

  function onPick(id: string) {
    if (id === NEW_OPTION) {
      setCreating(true);
      setSelected(NEW_OPTION);
      return;
    }
    setCreating(false);
    setSelected(id);
    router.replace(`/locations/character/${characterId}?loc=${id}`);
  }

  async function create() {
    if (!newName.trim()) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          notes: "",
          lookNote: "",
          characterIds: isShared ? [] : [characterId],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Create failed");
      await load();
      setCreating(false);
      setNewName("");
      onPick(data.location.id);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function linkLocation(locId: string) {
    if (isShared) return;
    setBusy(true);
    setError("");
    try {
      const loc = locations.find((l) => l.id === locId);
      if (!loc) throw new Error("Location not found");
      const ids = Array.from(new Set([...loc.characterIds, characterId]));
      const res = await fetch(`/api/locations/${locId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterIds: ids }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Link failed");
      await load();
      onPick(locId);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  function onDeleted() {
    load();
    setSelected("");
    setCreating(false);
    router.replace(`/locations/character/${characterId}`);
  }

  if (!isShared && !character && !error && loaded)
    return <p className="text-[var(--fail)]">Character not found.</p>;
  if (!loaded) return <p className="text-[var(--mute)]">Loading…</p>;

  const title = isShared ? "Shared / no character" : character?.name || "…";

  return (
    <div className="space-y-4">
      <div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs uppercase tracking-[0.16em]">
          <Link
            href="/locations"
            className="text-[var(--mute)] hover:text-[var(--acid)]"
          >
            ← Location Lab
          </Link>
          {!isShared ? (
            <Link
              href={`/lab/${characterId}`}
              className="text-[var(--mute)] hover:text-[var(--acid)]"
            >
              ← Character Lab
            </Link>
          ) : null}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h2 className="display text-2xl md:text-3xl">{title}</h2>
          {character?.approved ? <Pill tone="ok">Approved Asshole</Pill> : null}
          <Pill tone="mute">
            {myLocations.length} location{myLocations.length === 1 ? "" : "s"}
          </Pill>
        </div>
        <p className="mt-1 text-xs text-[var(--mute)]">
          Pick a place → describe left, generate right → approve a plate.
        </p>
      </div>

      <Panel className="p-3">
        <h3 className="mb-2 text-xs uppercase tracking-[0.14em] text-[var(--mute)]">
          {isShared ? "Shared places" : `${title}'s locations`}
        </h3>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {myLocations.map((l) => {
            const thumb = locThumb(l);
            const active = selected === l.id && !creating;
            const count =
              thumb?.plateCount ||
              l.rooms.reduce(
                (n, r) =>
                  n + r.plateAttempts.filter((a) => a.fileName).length,
                0,
              );
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => onPick(l.id)}
                className={`w-56 shrink-0 overflow-hidden rounded-sm border text-left transition ${
                  active
                    ? "border-[var(--acid)] ring-1 ring-[var(--acid)]"
                    : "border-[var(--line)] hover:border-[var(--magenta)]"
                }`}
              >
                <div className="aspect-video bg-[var(--panel-2)]">
                  {thumb?.plateId ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/locations/${thumb.locId}/rooms/${thumb.roomId}/plates/${thumb.plateId}`}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-[var(--mute)]">
                      no plate yet
                    </div>
                  )}
                </div>
                <div className="space-y-1 px-2 py-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm text-[var(--chrome)]">
                      {l.name}
                    </span>
                    {l.approved ? (
                      <span className="text-[10px] text-[var(--acid)]">✓</span>
                    ) : null}
                  </div>
                  <span className="text-[10px] text-[var(--mute)]">
                    {count} image{count === 1 ? "" : "s"}
                  </span>
                </div>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => onPick(NEW_OPTION)}
            className={`flex h-[9.5rem] w-40 shrink-0 flex-col items-center justify-center rounded-sm border border-dashed text-sm ${
              creating
                ? "border-[var(--acid)] text-[var(--acid)]"
                : "border-[var(--line)] text-[var(--mute)] hover:border-[var(--acid)] hover:text-[var(--acid)]"
            }`}
          >
            + New location
          </button>
        </div>

        {creating ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--line)] pt-3">
            <Field label="Name">
              <TextInput
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Suburban High Street"
                className="max-w-xs"
              />
            </Field>
            <Btn
              tone="accent"
              disabled={busy || !newName.trim()}
              onClick={create}
            >
              {busy ? "Creating…" : "Create"}
            </Btn>
            <button
              onClick={() => {
                setCreating(false);
                setSelected(myLocations[0]?.id || "");
              }}
              className="text-xs text-[var(--mute)] hover:underline"
            >
              Cancel
            </button>
          </div>
        ) : null}

        {error ? (
          <p className="mt-3 text-sm text-[var(--fail)]">{error}</p>
        ) : null}
      </Panel>

      {!isShared ? (
        <Panel className="p-4">
          <button
            type="button"
            className="flex w-full items-center justify-between text-left"
            onClick={() => setOtherOpen((o) => !o)}
          >
            <span className="display text-xl">
              {otherOpen ? "▾" : "▸"} Other locations
            </span>
            <span className="text-xs text-[var(--mute)]">
              {otherLocations.length} not linked to {title}
            </span>
          </button>
          {otherOpen ? (
            <div className="mt-3 flex gap-3 overflow-x-auto border-t border-[var(--line)] pt-3 pb-1">
              {otherLocations.length === 0 ? (
                <p className="text-sm text-[var(--mute)]">
                  No other places in the lab yet.
                </p>
              ) : (
                otherLocations.map((l) => {
                  const thumb = locThumb(l);
                  return (
                    <div
                      key={l.id}
                      className="w-56 shrink-0 overflow-hidden rounded-sm border border-[var(--line)]"
                    >
                      <div className="aspect-video bg-[var(--panel-2)]">
                        {thumb?.plateId ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={`/api/locations/${thumb.locId}/rooms/${thumb.roomId}/plates/${thumb.plateId}`}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs text-[var(--mute)]">
                            no plate
                          </div>
                        )}
                      </div>
                      <div className="space-y-2 p-2">
                        <p className="truncate text-sm">{l.name}</p>
                        <div className="flex flex-wrap gap-2">
                          <Btn
                            tone="accent"
                            disabled={busy}
                            onClick={() => void linkLocation(l.id)}
                          >
                            Link to {title}
                          </Btn>
                          <Link
                            href={`/locations/${l.id}`}
                            className="text-xs text-[var(--acid)] hover:underline"
                          >
                            Open alone →
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : null}
        </Panel>
      ) : null}

      {selected && selected !== NEW_OPTION ? (
        <LocationEditor
          key={selected}
          locationId={selected}
          onDeleted={onDeleted}
        />
      ) : !creating ? (
        <Panel className="p-6 text-[var(--mute)]">
          No locations yet for {title} — hit “+ New location”.
        </Panel>
      ) : null}
    </div>
  );
}
