"use client";

import {
  useCallback,
  useEffect,
  useState,
  type DragEvent as ReactDragEvent,
} from "react";
import {
  CRASH_CURSOR_SMOKE_STOP_EVENT,
  readCursorSmokeSession,
  resolveMainFromLookLine,
  writeCursorSmokeSession,
  type CursorSmokeSession,
} from "@/lib/crashCursorSmoke";
import { CRASH_STYLE_THUMB_SAVED } from "@/lib/crashStyleSync";
import {
  clearLivePlateDrag,
  readPlateDrag,
  writePlateDrag,
  type CrashPlateDragPayload,
} from "@/lib/crashPlateDrag";
import { addScriptDeskCastKey } from "@/lib/crashScriptFields";
import { writeStackFocusPanel } from "@/lib/crashDeskLayout";
import type { Character } from "@/lib/types";

const FACE_SLOTS = 5;

function liftSceneKitForDrop() {
  const kit = document.querySelector("[data-crash-panel='sceneKit']");
  if (kit instanceof HTMLElement) {
    kit.dataset.crashDropFront = "1";
    kit.style.zIndex = "450";
  }
}

function unliftSceneKit() {
  document.querySelectorAll("[data-crash-drop-front='1']").forEach((el) => {
    if (el instanceof HTMLElement) {
      el.style.zIndex = "";
      delete el.dataset.crashDropFront;
    }
  });
  clearLivePlateDrag();
}

type FaceThumb = {
  key: string;
  url: string;
  label: string;
};

function namesMatch(a: string, b: string): boolean {
  const x = a.trim().toLowerCase();
  const y = b.trim().toLowerCase();
  if (!x || !y) return false;
  return x === y || x.startsWith(y) || y.startsWith(x);
}

/**
 * Character panel — Who + generated faces. Voice later.
 * No reference stills, no Crash Lab dump, no episode cast list.
 */
export function CrashCharacterPanel() {
  const [session, setSession] = useState<CursorSmokeSession | null>(null);
  const [character, setCharacter] = useState<Character | null>(null);
  const [name, setName] = useState("");
  const [pastNote, setPastNote] = useState("");
  const [lookLine, setLookLine] = useState("");
  const [torment, setTorment] = useState("");
  const [faces, setFaces] = useState<FaceThumb[]>([]);
  const [lockedKey, setLockedKey] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [voiceLocked, setVoiceLocked] = useState(false);

  const loadFaces = useCallback(async (styleId: string, who: string) => {
    const whoLower = who.trim().toLowerCase();
    const out: FaceThumb[] = [];
    const seen = new Set<string>();

    try {
      const res = await fetch("/api/crash/style-cards");
      const data = await res.json();
      if (res.ok && Array.isArray(data.cards)) {
        const card = data.cards.find(
          (c: { id: string }) => c.id === styleId,
        ) as
          | {
              thumbs?: {
                key: string;
                name?: string;
                brief?: string;
                mtime?: number;
              }[];
            }
          | undefined;
        const thumbs = [...(card?.thumbs || [])].sort(
          (a, b) => (b.mtime || 0) - (a.mtime || 0),
        );
        for (const t of thumbs) {
          const labelName = (t.name || "").trim();
          const brief = (t.brief || "").trim();
          const briefHasWho =
            whoLower.length > 2 && brief.toLowerCase().includes(whoLower);
          const junkLabel = !labelName || /^character$/i.test(labelName);
          const nameOk = namesMatch(labelName, who);
          // Stuck "Character" rows often have the real name only in the brief.
          if (!nameOk && !(junkLabel && briefHasWho) && !briefHasWho) {
            continue;
          }
          // Skip obvious place plates even if brief mentions the name.
          if (
            /\b(hatchback|podium|empty location|no people)\b/i.test(brief) &&
            !nameOk
          ) {
            continue;
          }
          if (seen.has(t.key)) continue;
          seen.add(t.key);
          out.push({
            key: t.key,
            label: nameOk ? labelName : who,
            url: `/api/crash/style-cards/file?styleId=${encodeURIComponent(styleId)}&thumb=${encodeURIComponent(t.key)}`,
          });
          // Fix junk label on disk so Script desk matches.
          if (junkLabel && briefHasWho) {
            void fetch("/api/crash/style-cards/manifest", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                styleId,
                thumbKey: t.key,
                name: who,
                brief: brief || who,
              }),
            });
          }
        }
      }
    } catch {
      /* ignore */
    }

    // Old Character Lab face takes for this arsehole.
    try {
      const res = await fetch("/api/characters");
      const data = await res.json();
      if (res.ok && Array.isArray(data.characters)) {
        for (const c of data.characters as Character[]) {
          if (!namesMatch(c.name, who)) continue;
          for (const a of c.faceAttempts || []) {
            if (!a.fileName) continue;
            const key = `lab:${c.id}:${a.id}`;
            if (seen.has(key)) continue;
            seen.add(key);
            out.push({
              key,
              label: c.name,
              url: `/api/characters/${c.id}/faces/${a.id}`,
            });
          }
        }
      }
    } catch {
      /* ignore */
    }

    setFaces(out.slice(0, FACE_SLOTS));
  }, []);

  const ensureCharacter = useCallback(
    async (who: string, look: string) => {
      try {
        const res = await fetch("/api/characters");
        const data = await res.json();
        if (!res.ok) return null;
        const list = (data.characters || []) as Character[];
        let hit =
          list.find((c) => namesMatch(c.name, who)) ||
          list.find((c) => namesMatch(who, c.name)) ||
          null;
        if (!hit && who.trim()) {
          const created = await fetch("/api/characters", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: who.trim(),
              pastNote: "",
              tormentScratch: "",
            }),
          });
          const createdData = await created.json();
          if (created.ok) hit = createdData.character as Character;
        }
        if (hit && look.trim() && !hit.lookNote?.trim()) {
          const put = await fetch(`/api/characters/${hit.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: hit.name,
              pastNote: hit.pastNote,
              lookNote: look.trim(),
              tormentScratch: hit.tormentScratch,
            }),
          });
          const putData = await put.json();
          if (put.ok) hit = putData.character as Character;
        }
        return hit;
      } catch {
        return null;
      }
    },
    [],
  );

  const refresh = useCallback(async () => {
    const s = readCursorSmokeSession();
    if (!s) {
      setSession(null);
      setCharacter(null);
      setFaces([]);
      return;
    }
    const resolved = resolveMainFromLookLine(s.mainName, s.notes, s.castNames);
    const castChanged =
      resolved.castNames.join("\0") !== s.castNames.join("\0");
    if (resolved.mainName !== s.mainName || castChanged) {
      writeCursorSmokeSession({
        ...s,
        mainName: resolved.mainName,
        imageLabel: resolved.mainName,
        castNames: resolved.castNames,
        notes: resolved.notes || s.notes,
      });
    }
    const next = readCursorSmokeSession();
    setSession(next);
    if (!next) return;

    setName(next.mainName);
    setLookLine(next.notes || "");
    if (next.imageThumbKey) setLockedKey(next.imageThumbKey);

    const char = await ensureCharacter(next.mainName, next.notes || "");
    setCharacter(char);
    if (char) {
      setName(char.name);
      setPastNote(char.pastNote || "");
      setLookLine(char.lookNote || next.notes || "");
      setTorment(char.tormentScratch || "");
    }
    await loadFaces(next.styleId, next.mainName);
    // Voice lock status for this arsehole's face key.
    try {
      const thumb = next.imageThumbKey;
      if (!thumb) {
        setVoiceLocked(false);
      } else {
        const res = await fetch(
          `/api/crash/voice?styleId=${encodeURIComponent(next.styleId)}`,
        );
        const data = await res.json();
        const slot = data.slots?.[thumb];
        setVoiceLocked(Boolean(slot?.approvedAttemptId || slot?.keeperSaved));
      }
    } catch {
      setVoiceLocked(false);
    }
  }, [ensureCharacter, loadFaces]);

  useEffect(() => {
    void refresh();
    const onStop = () => void refresh();
    const onThumb = () => void refresh();
    window.addEventListener(CRASH_CURSOR_SMOKE_STOP_EVENT, onStop);
    window.addEventListener(CRASH_STYLE_THUMB_SAVED, onThumb);
    return () => {
      window.removeEventListener(CRASH_CURSOR_SMOKE_STOP_EVENT, onStop);
      window.removeEventListener(CRASH_STYLE_THUMB_SAVED, onThumb);
    };
  }, [refresh]);

  async function saveWho() {
    if (!session) return;
    setBusy(true);
    setStatus("");
    try {
      const who = name.trim() || session.mainName;
      writeCursorSmokeSession({
        ...session,
        mainName: who,
        imageLabel: who,
        notes: lookLine.trim(),
      });
      let char = character;
      if (!char) char = await ensureCharacter(who, lookLine);
      if (char) {
        const res = await fetch(`/api/characters/${char.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: who,
            pastNote: pastNote.trim(),
            lookNote: lookLine.trim(),
            tormentScratch: torment.trim(),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Save failed");
        setCharacter(data.character);
      }
      setSession(readCursorSmokeSession());
      await loadFaces(session.styleId, who);
      setStatus("Saved");
    } catch (e) {
      setStatus(String(e));
    } finally {
      setBusy(false);
    }
  }

  function faceUrl(key: string): string | null {
    if (!session) return null;
    if (key.startsWith("lab:")) {
      const hit = faces.find((f) => f.key === key);
      return hit?.url || null;
    }
    return `/api/crash/style-cards/file?styleId=${encodeURIComponent(session.styleId)}&thumb=${encodeURIComponent(key)}`;
  }

  function lockFace(key: string) {
    if (!session) return;
    // Smoke session thumb key is style-card only; lab faces stay as locked UI pick.
    writeCursorSmokeSession({
      ...session,
      imageThumbKey: key.startsWith("lab:")
        ? session.imageThumbKey
        : key,
      imageApproved: true,
      imageLabel: name.trim() || session.mainName,
    });
    setLockedKey(key);
    setSession(readCursorSmokeSession());
    setStatus("Face locked for this arsehole");
  }

  async function binFace(key: string) {
    if (!session) return;
    if (!confirm("Bin this face off Character? File goes to retired — not wiped.")) {
      return;
    }
    setBusy(true);
    setStatus("Binning…");
    try {
      if (key.startsWith("lab:")) {
        const parts = key.split(":");
        const charId = parts[1];
        const attemptId = parts[2];
        if (!charId || !attemptId) throw new Error("Bad lab face key");
        const res = await fetch(
          `/api/characters/${charId}/faces/${attemptId}`,
          { method: "DELETE" },
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Bin failed");
      } else {
        const res = await fetch("/api/crash/style-cards/thumb", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            styleId: session.styleId,
            thumbKey: key,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Bin failed");
        window.dispatchEvent(new CustomEvent(CRASH_STYLE_THUMB_SAVED));
      }

      const wasLocked =
        key === lockedKey || key === session.imageThumbKey;
      if (wasLocked) {
        const next = faces.find((f) => f.key !== key);
        writeCursorSmokeSession({
          ...session,
          imageThumbKey: next && !next.key.startsWith("lab:")
            ? next.key
            : undefined,
          imageApproved: Boolean(next),
        });
        setLockedKey(next?.key || "");
        setSession(readCursorSmokeSession());
      }

      const who = name.trim() || session.mainName;
      await loadFaces(session.styleId, who);
      setStatus("Binned — off Character (retired, not wiped)");
    } catch (e) {
      setStatus(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function addFaceFile(file: File) {
    if (!session) return;
    if (!file.type.startsWith("image/")) {
      setStatus("Drop an image file");
      return;
    }
    setBusy(true);
    setStatus("Adding face…");
    try {
      const who = name.trim() || session.mainName;
      const fd = new FormData();
      fd.set("file", file);
      fd.set("styleId", session.styleId);
      fd.set("name", who);
      fd.set("brief", lookLine.trim() || who);
      const res = await fetch("/api/crash/style-cards/upload", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      if (typeof data.thumbKey === "string") {
        await fetch("/api/crash/style-cards/manifest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            styleId: session.styleId,
            thumbKey: data.thumbKey,
            name: who,
            brief: lookLine.trim() || who,
          }),
        }).catch(() => undefined);
      }
      window.dispatchEvent(new CustomEvent(CRASH_STYLE_THUMB_SAVED));
      await loadFaces(session.styleId, who);
      setStatus(`Added face for ${who}`);
    } catch (e) {
      setStatus(String(e));
    } finally {
      setBusy(false);
      setDragOver(false);
    }
  }

  async function onFaceDrop(e: ReactDragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await addFaceFile(file);
      return;
    }
    // Drag from Crash Lab / Image Gen URL
    const raw =
      e.dataTransfer.getData("text/uri-list") ||
      e.dataTransfer.getData("text/plain");
    const url = raw
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.startsWith("/api/crash/") || l.startsWith("http"));
    if (!url) return;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Could not load image");
      const blob = await res.blob();
      const q = url.split("name=")[1]?.split("&")[0] || "face.png";
      await addFaceFile(
        new File([blob], decodeURIComponent(q), {
          type: blob.type || "image/png",
        }),
      );
    } catch (err) {
      setStatus(String(err));
    }
  }

  if (!session) {
    return (
      <div className="space-y-2 p-1">
        <p className="text-[10px] text-[var(--mute)]">
          Hit <span className="text-[var(--acid)]">CURSOR</span> → cast → Image
          Gen → Approve. Character opens here: Who + faces.
        </p>
      </div>
    );
  }

  const heroKey = lockedKey || session.imageThumbKey || faces[0]?.key || "";
  const hero = heroKey ? faceUrl(heroKey) || faces[0]?.url || null : null;

  const shownFaces = (() => {
    if (
      session.imageThumbKey &&
      !faces.some((f) => f.key === session.imageThumbKey)
    ) {
      return [
        {
          key: session.imageThumbKey,
          label: name || session.mainName,
          url:
            faceUrl(session.imageThumbKey) ||
            `/api/crash/style-cards/file?styleId=${encodeURIComponent(session.styleId)}&thumb=${encodeURIComponent(session.imageThumbKey)}`,
        },
        ...faces,
      ];
    }
    return faces;
  })();

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-1">
      {/* Hero face */}
      <div className="shrink-0 overflow-hidden rounded-sm border border-[var(--line)] bg-[var(--void)]/40">
        {hero ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            draggable={Boolean(heroKey && !heroKey.startsWith("lab:"))}
            src={hero}
            alt={name || session.mainName}
            title="Drag this face to Scene kit Asshole"
            className="mx-auto max-h-56 w-full cursor-grab object-contain active:cursor-grabbing"
            onDragStart={(e) => {
              const key = heroKey || session.imageThumbKey;
              if (!key || key.startsWith("lab:")) return;
              e.stopPropagation();
              writePlateDrag(e, {
                kind: "cast",
                styleId: session.styleId,
                thumbKey: key,
                label: name.trim() || session.mainName,
              });
              liftSceneKitForDrop();
            }}
            onDragEnd={() => unliftSceneKit()}
          />
        ) : (
          <p className="p-6 text-center text-[10px] text-[var(--mute)]">
            No face yet — Approve one in Image Gen.
          </p>
        )}
      </div>

      {/* Faces — up to 5; empty slots = drop targets */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => void onFaceDrop(e)}
        className={`rounded-sm border p-1.5 ${
          dragOver
            ? "border-[var(--acid)] bg-[var(--acid)]/10"
            : "border-transparent"
        }`}
      >
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className="text-[8px] uppercase tracking-wider text-[var(--acid)]">
            Faces · {Math.min(shownFaces.length, FACE_SLOTS)}/{FACE_SLOTS}
          </p>
          <label className="cursor-pointer text-[8px] uppercase tracking-wider text-[var(--chrome-dim)] underline hover:text-[var(--acid)]">
            Add
            <input
              type="file"
              accept="image/*"
              disabled={busy || shownFaces.length >= FACE_SLOTS}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void addFaceFile(f);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        <ul className="flex gap-1.5 overflow-x-auto pb-1">
          {Array.from({ length: FACE_SLOTS }).map((_, i) => {
            const f = shownFaces[i];
            if (f) {
              const locked =
                f.key === lockedKey || f.key === session.imageThumbKey;
              return (
                <li key={f.key} className="w-[4.5rem] shrink-0 space-y-0.5">
                  <button
                    type="button"
                    onClick={() => lockFace(f.key)}
                    className={`block h-[4.5rem] w-full overflow-hidden rounded-sm border ${
                      locked
                        ? "border-[var(--acid)] ring-1 ring-[var(--acid)]"
                        : "border-[var(--line)]"
                    }`}
                    title="Click to lock as main"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      draggable={false}
                      src={f.url}
                      alt=""
                      className="pointer-events-none h-full w-full object-cover"
                    />
                  </button>
                  <div className="flex justify-center gap-1">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => lockFace(f.key)}
                      className="text-[8px] uppercase text-[var(--mute)] hover:text-[var(--acid)] disabled:opacity-40"
                    >
                      {locked ? "locked" : "lock"}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void binFace(f.key)}
                      className="text-[8px] uppercase text-[var(--magenta-hot)] hover:underline disabled:opacity-40"
                      title="Bin off Character (retired)"
                    >
                      Bin
                    </button>
                  </div>
                </li>
              );
            }
            return (
              <li
                key={`slot-${i}`}
                className="flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center rounded-sm border border-dashed border-[var(--line)] text-center text-[8px] uppercase leading-tight text-[var(--mute)]"
              >
                Drop
                <br />
                face
              </li>
            );
          })}
        </ul>
        <p className="mt-0.5 text-[8px] text-[var(--mute)]">
          Click a face = lock main. Drag the big image above into Scene kit Asshole.
        </p>
      </div>

      {/* 1 · Who */}
      <div className="rounded-sm border border-[var(--line)] bg-[var(--panel)]/40 p-2">
        <p className="display text-[13px] text-[var(--acid)]">1 · Who</p>
        <p className="mb-2 text-[9px] text-[var(--mute)]">
          Notes + look line. Look line rides every plate.
        </p>
        <label className="mb-2 block">
          <span className="text-[8px] uppercase tracking-wider text-[var(--acid)]">
            Name
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-0.5 w-full rounded-sm border border-[var(--line)] bg-[var(--void)]/40 px-2 py-1 text-[12px] text-[var(--chrome)]"
          />
        </label>
        <label className="mb-2 block">
          <span className="text-[8px] uppercase tracking-wider text-[var(--acid)]">
            Who they were to you
          </span>
          <textarea
            value={pastNote}
            onChange={(e) => setPastNote(e.target.value)}
            rows={2}
            className="mt-0.5 w-full rounded-sm border border-[var(--line)] bg-[var(--void)]/40 px-2 py-1 text-[10px] text-[var(--chrome)]"
          />
        </label>
        <label className="mb-2 block">
          <span className="text-[8px] uppercase tracking-wider text-[var(--acid)]">
            Look line — every plate, every episode
          </span>
          <textarea
            value={lookLine}
            onChange={(e) => setLookLine(e.target.value)}
            rows={3}
            placeholder="Body, clothes, footwear, hair, build. Positive only."
            className="mt-0.5 w-full rounded-sm border border-[var(--line)] bg-[var(--void)]/40 px-2 py-1 text-[10px] text-[var(--chrome)]"
          />
        </label>
        <label className="mb-2 block">
          <span className="text-[8px] uppercase tracking-wider text-[var(--acid)]">
            How we might fuck with them
          </span>
          <textarea
            value={torment}
            onChange={(e) => setTorment(e.target.value)}
            rows={2}
            className="mt-0.5 w-full rounded-sm border border-[var(--line)] bg-[var(--void)]/40 px-2 py-1 text-[10px] text-[var(--chrome)]"
          />
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={() => void saveWho()}
          className="rounded-sm border border-[var(--acid)] bg-[var(--acid)]/15 px-2 py-1 text-[9px] uppercase tracking-wide text-[var(--acid)] disabled:opacity-40"
        >
          Save notes
        </button>
        {status ? (
          <p className="mt-1 text-[9px] text-[var(--mute)]">{status}</p>
        ) : null}
        {character ? (
          <a
            href={`/lab/${character.id}`}
            className="mt-1 block text-[9px] text-[var(--chrome-dim)] underline hover:text-[var(--acid)]"
          >
            Open full Character Lab →
          </a>
        ) : null}
      </div>

      {/* Voice — opens Voice panel with this face */}
      <div className="rounded-sm border border-[var(--line)] p-2">
        <p className="text-[8px] uppercase tracking-wider text-[var(--acid)]">
          Voice {voiceLocked ? "— locked ✓" : "— not locked"}
        </p>
        <p className="mt-0.5 text-[9px] text-[var(--mute)]">
          {voiceLocked
            ? "Sample on disk for clone later."
            : "Open Voice → Gen → Approve a take."}
        </p>
        <button
          type="button"
          disabled={busy || !session.imageThumbKey}
          onClick={() => {
            const key = lockedKey || session.imageThumbKey;
            if (!key || key.startsWith("lab:")) {
              setStatus("Lock a style face first, then Open Voice");
              return;
            }
            addScriptDeskCastKey(key);
            writeStackFocusPanel("voice");
            setStatus("Voice panel — Gen → Approve");
          }}
          className="mt-1.5 rounded-sm border border-[var(--acid)] bg-[var(--acid)]/15 px-2 py-1 text-[9px] uppercase tracking-wide text-[var(--acid)] disabled:opacity-40"
        >
          Open Voice
        </button>
      </div>
    </div>
  );
}
