"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SceneKit } from "@/components/SceneKit";
import { ShotDesk } from "@/components/ShotDesk";
import {
  Btn,
  Field,
  Panel,
  TextArea,
  TextInput,
} from "@/components/ui";
import {
  emptyScene,
  emptyShot,
  ensureShotBeats,
  formatDuration,
  mirrorBeat0,
  type Character,
  type Episode,
  type Location,
  type Scene,
  type Shot,
} from "@/lib/types";

/** Sum of this shot's Keeper mp4 lengths — usually one, occasionally zero. */
function shotKeeperSeconds(s: Shot): number {
  return (s.renders || [])
    .filter((r) => r.status === "approved")
    .reduce((sum, r) => sum + (r.durationSeconds || 0), 0);
}

function sceneKeeperSeconds(sc: Scene): number {
  return sc.shots.reduce((sum, s) => sum + shotKeeperSeconds(s), 0);
}

/** Keeper (approved) video files in this scene. */
function sceneKeeperVideoCount(sc: Scene): number {
  return sc.shots.reduce(
    (sum, s) =>
      sum + (s.renders || []).filter((r) => r.status === "approved" && r.fileName).length,
    0,
  );
}

/** Parked takes across every shot in the scene (not Keepers). */
function sceneParkedCount(sc: Scene): number {
  return sc.shots.reduce(
    (sum, s) =>
      sum + (s.renders || []).filter((r) => r.status === "parked").length,
    0,
  );
}

function cutawayGlobal(scene: Scene, locations: Location[]): string {
  const loc = locations.find((l) => l.id === scene.locationId);
  const room = loc?.rooms.find((r) => r.id === scene.roomId);
  const place = loc
    ? `${loc.name}${room ? ` — ${room.name}` : ""}`
    : "same location as this scene";
  const look = [loc?.lookNote, room?.lookNote, room?.notes, scene.notes]
    .filter(Boolean)
    .join(". ");
  return `Stylised 3D animated feature render, clean simplified forms, believable materials, soft overcast lighting, everything in sharp focus. Not photographic, not a cartoon. CUTAWAY / insert — same place as the scene: ${place}. ${look} Empty establishing insert — architecture and props only, matching the master background.`;
}

export default function EpisodePage() {
  const params = useParams();
  const id = String(params.id);
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [sceneId, setSceneId] = useState("");
  const [shotId, setShotId] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [renderNote, setRenderNote] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [characters, setCharacters] = useState<Character[]>([]);
  const episodeRef = useRef<Episode | null>(null);
  episodeRef.current = episode;
  /** Bumps after a full Save so ShotDesk refreshes “last saved” lines. */
  const [promptsSavedAt, setPromptsSavedAt] = useState(0);
  const [locations, setLocations] = useState<Location[]>([]);

  const loadLocations = useCallback(async () => {
    const res = await fetch("/api/locations");
    const data = await res.json();
    setLocations(data.locations || []);
  }, []);

  const load = useCallback(async () => {
    const [epRes, chRes] = await Promise.all([
      fetch(`/api/episodes/${id}`),
      fetch("/api/characters"),
    ]);
    const epData = await epRes.json();
    const chData = await chRes.json();
    if (!epRes.ok) throw new Error(epData.error || "Load failed");
    setEpisode(epData.episode);
    setCharacters(chData.characters || []);
    const firstScene = epData.episode.scenes[0];
    setSceneId((prev) => prev || firstScene?.id || "");
    setShotId((prev) => {
      if (prev) return prev;
      return firstScene?.shots[0]?.id || "";
    });
    await loadLocations();
  }, [id, loadLocations]);

  useEffect(() => {
    load().catch((e) => setError(String(e)));
  }, [load]);

  useEffect(() => {
    const fn = () => {
      void loadLocations();
    };
    window.addEventListener("skidmarks-locations-refresh", fn);
    return () => window.removeEventListener("skidmarks-locations-refresh", fn);
  }, [loadLocations]);

  const scene = useMemo(
    () => episode?.scenes.find((s) => s.id === sceneId) || null,
    [episode, sceneId],
  );
  const shot = useMemo(
    () => scene?.shots.find((s) => s.id === shotId) || null,
    [scene, shotId],
  );
  const victim = useMemo(
    () =>
      characters.find((c) => c.id === episode?.victimCharacterId) || null,
    [characters, episode?.victimCharacterId],
  );

  function patchEpisode(fn: (ep: Episode) => Episode) {
    setEpisode((prev) => (prev ? fn(prev) : prev));
  }

  function patchScene(fn: (sc: Scene) => Scene) {
    patchEpisode((ep) => ({
      ...ep,
      scenes: ep.scenes.map((s) => (s.id === sceneId ? fn(s) : s)),
    }));
  }

  function patchShot(fn: (sh: Shot) => Shot) {
    patchScene((sc) => ({
      ...sc,
      shots: sc.shots.map((s) =>
        s.id === shotId ? mirrorBeat0(fn(ensureShotBeats(s))) : s,
      ),
    }));
  }

  function patchShotById(targetId: string, fn: (sh: Shot) => Shot) {
    patchScene((sc) => ({
      ...sc,
      shots: sc.shots.map((s) =>
        s.id === targetId ? mirrorBeat0(fn(ensureShotBeats(s))) : s,
      ),
    }));
  }

  async function save() {
    const ep = episodeRef.current;
    if (!ep) return;
    setStatus("Saving…");
    setError("");
    const res = await fetch(`/api/episodes/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ep),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Save failed");
      setStatus("");
      return;
    }
    setEpisode(data.episode);
    setPromptsSavedAt(Date.now());
    setStatus("Saved");
  }

  /** Persist current episode before Gen so on-screen typing isn't wiped. */
  async function ensureSaved() {
    const ep = episodeRef.current;
    if (!ep) return;
    const res = await fetch(`/api/episodes/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ep),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Save failed");
    setEpisode(data.episode);
    setPromptsSavedAt(Date.now());
  }

  async function exportPack() {
    if (!episode) return;
    setStatus("Staging…");
    setError("");
    await save();
    const res = await fetch("/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ episode }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Export failed");
      setStatus("");
      return;
    }
    setStatus(
      `Pack staged — ${data.written?.length || 0} scene sheets. Copy shot paste into Comfy; save mp4s back here.`,
    );
  }

  async function dropFiles(
    files: FileList | File[],
    dest?: "success" | "park",
    beatId?: string,
  ) {
    if (!episode || !scene || !shot) {
      setError("Pick a shot first — drops land on the selected shot");
      return;
    }
    const list = Array.from(files);
    if (!list.length) return;

    const hasVideo = list.some((f) => {
      const n = f.name.toLowerCase();
      const t = (f.type || "").toLowerCase();
      return t.startsWith("video/") || n.endsWith(".mp4") || n.endsWith(".webm");
    });
    if (hasVideo && !dest) {
      setError("Drop the mp4 on KEEPER (works) or PARK (might salvage)");
      setDragOver(false);
      return;
    }

    setUploading(true);
    setError("");
    try {
      await save();
      for (const file of list) {
        const form = new FormData();
        form.append("file", file);
        form.append("note", renderNote);
        if (dest) form.append("dest", dest);
        if (beatId) form.append("beatId", beatId);
        const res = await fetch(
          `/api/episodes/${id}/scenes/${scene.id}/shots/${shot.id}/assets`,
          { method: "POST", body: form },
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Drop failed");
        setEpisode(data.episode);
        if (data.kind === "plate")
          setStatus(`Plate on ${shot.code}`);
        else if (data.kind === "voice")
          setStatus(`Voice on ${shot.code}`);
        else if (data.kind === "render")
          setStatus(
            dest === "success"
              ? `${data.render.version} → Keeper on ${shot.code}`
              : dest === "park"
                ? `${data.render.version} → Park on ${shot.code}`
                : `Saved ${data.render.version} on ${shot.code}`,
          );
      }
      setRenderNote("");
    } catch (e) {
      setError(String(e));
    } finally {
      setUploading(false);
      setDragOver(false);
    }
  }

  async function setRenderStatus(
    renderId: string,
    next: "approved" | "parked" | "rejected" | "pending",
  ) {
    if (!scene || !shot) return;
    setError("");
    const res = await fetch(
      `/api/episodes/${id}/scenes/${scene.id}/shots/${shot.id}/renders`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ renderId, status: next }),
      },
    );
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Update failed");
      return;
    }
    setEpisode(data.episode);
    setStatus(
      next === "approved"
        ? "Moved to Keeper — shot checked done"
        : next === "parked"
          ? "Parked — keep for salvage"
          : next === "rejected"
            ? "Marked dud"
            : "Back to pending",
    );
  }

  function addCutaway() {
    if (!scene) return;
    const n =
      scene.shots.filter((s) => s.cutaway).length + 1;
    const sh = emptyShot({
      code: `C${String(n).padStart(2, "0")}`,
      title: "Cutaway",
      kind: "silent",
      cutaway: true,
      guide: 0.45,
      imageSeconds: 3,
      global: cutawayGlobal(scene, locations),
      imageMotion: "subtle ambient motion, same place, soft drift",
      resolveNotes: "Cutaway — same location background as scene kit place.",
    });
    patchScene((sc) => ({ ...sc, shots: [...sc.shots, sh] }));
    setShotId(sh.id);
    setStatus(`Cutaway ${sh.code} — same place as scene`);
  }

  async function attachPlacePlate() {
    if (!episode || !scene || !shot) return;
    const loc = locations.find((l) => l.id === scene.locationId);
    const room = loc?.rooms.find((r) => r.id === scene.roomId);
    const plateId =
      room?.approvedPlateId ||
      room?.plateAttempts.find(
        (p) => p.status === "approved" && p.fileName,
      )?.id ||
      "";
    if (!loc || !room || !plateId) {
      setError("No locked place plate for this scene");
      return;
    }
    setUploading(true);
    setError("");
    try {
      await save();
      const src = `/api/locations/${loc.id}/rooms/${room.id}/plates/${plateId}`;
      const resImg = await fetch(src);
      if (!resImg.ok) throw new Error("Could not load place plate");
      const blob = await resImg.blob();
      const file = new File(
        [blob],
        `${loc.slug || "place"}_${room.name || "room"}.png`,
        { type: blob.type || "image/png" },
      );
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(
        `/api/episodes/${id}/scenes/${scene.id}/shots/${shot.id}/assets`,
        { method: "POST", body: form },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Attach failed");
      setEpisode(data.episode);
      setStatus(`Place plate attached to ${shot.code}`);
    } catch (e) {
      setError(String(e));
    } finally {
      setUploading(false);
    }
  }

  if (!episode) {
    return (
      <p className="text-[var(--mute)]">{error || "Loading…"}</p>
    );
  }

  return (
    <div
      className="relative space-y-6"
      onDragEnter={(e) => {
        e.preventDefault();
        if (shot) setDragOver(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (shot) setDragOver(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        void dropFiles(e.dataTransfer.files);
      }}
    >
      {dragOver && shot ? (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center p-3">
          <div className="rounded-sm border border-[var(--acid)] bg-[var(--void)]/95 px-6 py-3 text-center shadow-lg">
            <p className="display text-xl text-[var(--acid)]">
              {shot.code} — plate / voice anywhere · mp4 → Keeper or Park
            </p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            href="/"
            className="text-sm text-[var(--mute)] hover:text-[var(--accent)]"
          >
            ← All episodes
          </Link>
          <h2 className="display mt-1 text-3xl">{episode.title}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Btn onClick={save}>Save</Btn>
          <Btn tone="accent" onClick={exportPack}>
            Stage pack for Comfy
          </Btn>
        </div>
      </div>
      {(status || error) && (
        <p
          className={`text-sm ${error ? "text-[var(--danger)]" : "text-[var(--ok)]"}`}
        >
          {error || status}
        </p>
      )}

      <Panel className="grid gap-3 p-4 md:grid-cols-2">
        <Field label="Title">
          <TextInput
            value={episode.title}
            onChange={(e) =>
              patchEpisode((ep) => ({ ...ep, title: e.target.value }))
            }
          />
        </Field>
        <Field label="Episode id">
          <TextInput
            value={episode.slug}
            onChange={(e) =>
              patchEpisode((ep) => ({ ...ep, slug: e.target.value }))
            }
          />
        </Field>
        <Field label="Logline">
          <TextInput
            value={episode.logline}
            onChange={(e) =>
              patchEpisode((ep) => ({ ...ep, logline: e.target.value }))
            }
          />
        </Field>
        <Field label="Character note">
          <TextInput
            value={episode.characterNote}
            onChange={(e) =>
              patchEpisode((ep) => ({ ...ep, characterNote: e.target.value }))
            }
          />
        </Field>
        <Field label="How we fuck with them">
          <TextArea
            value={episode.torment || ""}
            onChange={(e) =>
              patchEpisode((ep) => ({ ...ep, torment: e.target.value }))
            }
          />
        </Field>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="space-y-4">
          <Panel className="p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="display text-lg">Scenes</h3>
              <Btn
                tone="ghost"
                onClick={() => {
                  const sc = emptyScene({
                    slug: `scene_${String(episode.scenes.length + 1).padStart(2, "0")}`,
                    title: `Scene ${episode.scenes.length + 1}`,
                    shots: [emptyShot({ code: "S01", title: "First shot" })],
                  });
                  patchEpisode((ep) => ({
                    ...ep,
                    scenes: [...ep.scenes, sc],
                  }));
                  setSceneId(sc.id);
                  setShotId(sc.shots[0].id);
                }}
              >
                + Scene
              </Btn>
            </div>
            <ul className="space-y-1">
              {episode.scenes.map((s) => (
                <li key={s.id} className="flex items-stretch gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSceneId(s.id);
                      setShotId(s.shots[0]?.id || "");
                    }}
                    className={`min-w-0 flex-1 rounded-sm px-2 py-2 text-left text-sm ${
                      s.id === sceneId
                        ? "bg-[var(--accent)] text-[var(--ink)]"
                        : "hover:bg-[var(--panel-2)]"
                    }`}
                  >
                    {s.title || s.slug}
                    <span className="block text-xs opacity-70">
                      {sceneKeeperVideoCount(s)} video
                      {sceneKeeperVideoCount(s) === 1 ? "" : "s"}
                      {sceneParkedCount(s) > 0 ? (
                        <> · {sceneParkedCount(s)} parked</>
                      ) : null}
                      {s.shots.length > 0 &&
                      s.shots.every((x) => x.done) ? (
                        <> · SCENE DONE</>
                      ) : null}
                      {sceneKeeperSeconds(s) ? (
                        <> · {formatDuration(sceneKeeperSeconds(s))}</>
                      ) : null}
                    </span>
                  </button>
                  <button
                    type="button"
                    title="Remove scene"
                    disabled={episode.scenes.length <= 1}
                    onClick={() => {
                      if (episode.scenes.length <= 1) return;
                      if (
                        !window.confirm(
                          `Remove scene “${s.title || s.slug}”?`,
                        )
                      )
                        return;
                      const next = episode.scenes.filter((x) => x.id !== s.id);
                      patchEpisode((ep) => ({ ...ep, scenes: next }));
                      if (s.id === sceneId) {
                        setSceneId(next[0]?.id || "");
                        setShotId(next[0]?.shots[0]?.id || "");
                      }
                      setStatus("Scene removed — hit Save");
                    }}
                    className="rounded-sm px-2 text-sm text-[var(--fail)] hover:bg-[var(--fail)]/10 disabled:opacity-30"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </Panel>

          {scene ? (
            <Panel className="p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-1">
                <h3 className="display flex items-center gap-2 text-lg">
                  Shots
                  {sceneKeeperSeconds(scene) ? (
                    <span className="font-mono text-xs text-[var(--ok)]">
                      {formatDuration(sceneKeeperSeconds(scene))} in Keeper
                    </span>
                  ) : null}
                </h3>
                <div className="flex gap-1">
                  <Btn
                    tone="ghost"
                    onClick={() => {
                      const sh = emptyShot({
                        code: `S${String(scene.shots.filter((x) => !x.cutaway).length + 1).padStart(2, "0")}`,
                        title: "New shot",
                      });
                      patchScene((sc) => ({
                        ...sc,
                        shots: [...sc.shots, sh],
                      }));
                      setShotId(sh.id);
                    }}
                  >
                    + Shot
                  </Btn>
                  <Btn tone="magenta" onClick={addCutaway}>
                    + Cutaway
                  </Btn>
                </div>
              </div>
              <ul className="max-h-80 space-y-1 overflow-auto">
                {scene.shots.map((s) => (
                  <li key={s.id} className="flex items-stretch gap-1">
                    <button
                      type="button"
                      onClick={() => setShotId(s.id)}
                      className={`min-w-0 flex-1 rounded-sm px-2 py-2 text-left text-sm ${
                        s.id === shotId
                          ? "bg-[var(--panel-2)] border border-[var(--accent)]"
                          : "hover:bg-[var(--panel-2)]"
                      }`}
                    >
                      <span className="text-[var(--accent)]">{s.code}</span>{" "}
                      {s.title}
                      {s.cutaway ? (
                        <span className="ml-1 text-[10px] text-[var(--magenta-hot)]">
                          CUT
                        </span>
                      ) : null}
                      {s.done ? (
                        <span className="ml-1 text-[var(--ok)]">✓</span>
                      ) : null}
                      {shotKeeperSeconds(s) ? (
                        <span className="ml-1 font-mono text-[10px] text-[var(--ok)]">
                          {formatDuration(shotKeeperSeconds(s))}
                        </span>
                      ) : null}
                    </button>
                    <button
                      type="button"
                      title="Remove shot"
                      disabled={scene.shots.length <= 1}
                      onClick={() => {
                        if (scene.shots.length <= 1) return;
                        if (
                          !window.confirm(`Remove ${s.code} — ${s.title}?`)
                        )
                          return;
                        const next = scene.shots.filter((x) => x.id !== s.id);
                        patchScene((sc) => ({ ...sc, shots: next }));
                        if (s.id === shotId) {
                          setShotId(next[0]?.id || "");
                        }
                        setStatus(`Removed ${s.code} — hit Save`);
                      }}
                      className="rounded-sm px-2 text-sm text-[var(--fail)] hover:bg-[var(--fail)]/10 disabled:opacity-30"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
        </aside>

        <div className="space-y-4">
          {scene ? (
            <Panel className="grid gap-3 p-4 md:grid-cols-2">
              <Field label="Scene id">
                <TextInput
                  value={scene.slug}
                  onChange={(e) =>
                    patchScene((sc) => ({ ...sc, slug: e.target.value }))
                  }
                />
              </Field>
              <Field label="Scene title">
                <TextInput
                  value={scene.title}
                  onChange={(e) =>
                    patchScene((sc) => ({ ...sc, title: e.target.value }))
                  }
                />
              </Field>
            </Panel>
          ) : null}

          {scene ? (
            <SceneKit
              episodeId={id}
              episode={episode}
              scene={scene}
              victim={victim}
              locations={locations}
              onEpisode={setEpisode}
              onEnsureSaved={ensureSaved}
              onScenePatch={patchScene}
              onLocation={(loc) =>
                setLocations((prev) => {
                  const i = prev.findIndex((l) => l.id === loc.id);
                  if (i < 0) return [loc, ...prev];
                  const next = [...prev];
                  next[i] = loc;
                  return next;
                })
              }
              onStatus={setStatus}
              onError={setError}
            />
          ) : null}

          {shot && scene ? (
            <ShotDesk
              episodeId={id}
              episode={episode}
              scene={scene}
              shot={shot}
              victim={victim}
              locations={locations}
              renderNote={renderNote}
              uploading={uploading}
              promptsSavedAt={promptsSavedAt}
              onRenderNote={setRenderNote}
              onPatchShot={patchShot}
              onPatchShotById={patchShotById}
              onOpenShot={setShotId}
              onDropFiles={(files, dest, beatId) =>
                void dropFiles(files, dest, beatId)
              }
              onSetRenderStatus={(rid, next) =>
                void setRenderStatus(rid, next)
              }
              onStatus={setStatus}
              onError={setError}
              onEpisode={setEpisode}
              onEnsureSaved={ensureSaved}
              onAttachPlacePlate={attachPlacePlate}
            />
          ) : (
            <Panel className="p-6 text-[var(--mute)]">
              Add a shot — plates, voices and prompts all live here.
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
