"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { copyText } from "@/components/CopyBits";
import { Btn, Field, Panel, Pill, TextArea, TextInput } from "@/components/ui";
import { parseBlueprint } from "@/lib/scriptBlueprint";
import type { Character, CharacterScript } from "@/lib/types";

function downloadUrl(url: string, fileName: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
}

/**
 * Character Lab detail — who they are, look line, Gen face, locked face,
 * pinned scripts + blueprint chips for copy/prefill.
 */
export default function CharacterDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const [character, setCharacter] = useState<Character | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [scriptTitle, setScriptTitle] = useState("");
  const [scriptBody, setScriptBody] = useState("");
  const [openScriptId, setOpenScriptId] = useState("");
  const [preview, setPreview] = useState<{ src: string; title: string } | null>(
    null,
  );
  const [voiceDesc, setVoiceDesc] = useState("");
  const [voiceListenId, setVoiceListenId] = useState("");

  const load = useCallback(async () => {
    const charRes = await fetch(`/api/characters/${id}`);
    const data = await charRes.json();
    if (!charRes.ok) throw new Error(data.error || "Load failed");
    setCharacter(data.character);
  }, [id]);

  useEffect(() => {
    load().catch((e) => setError(String(e)));
  }, [load]);


  // Open first script by default so blueprint chips are visible
  useEffect(() => {
    if (!character?.scripts.length) return;
    if (openScriptId) return;
    setOpenScriptId(character.scripts[0].id);
  }, [character, openScriptId]);

  // Keep voice prompt + listen pick in sync with character
  useEffect(() => {
    if (!character) return;
    setVoiceDesc(character.voiceDescription || "");
    const voices = character.voiceAttempts || [];
    const pick =
      voices.find((v) => v.id === character.approvedVoiceAttemptId) ||
      voices.find((v) => v.status === "approved" && v.fileName) ||
      voices.find((v) => v.status === "pending" && v.fileName) ||
      [...voices].reverse().find((v) => v.fileName);
    setVoiceListenId(pick?.id || "");
  }, [character?.id, character?.approvedVoiceAttemptId, character?.voiceAttempts?.length]);

  const heroFaceId = useMemo(() => {
    if (!character) return "";
    if (
      character.approvedFaceId &&
      character.faceAttempts.some(
        (a) => a.id === character.approvedFaceId && a.fileName,
      )
    ) {
      return character.approvedFaceId;
    }
    const approved = character.faceAttempts.find(
      (a) => a.status === "approved" && a.fileName,
    );
    if (approved) return approved.id;
    return (
      [...character.faceAttempts].reverse().find((a) => a.fileName)?.id || ""
    );
  }, [character]);

  const openScript: CharacterScript | null = useMemo(() => {
    if (!character) return null;
    return character.scripts.find((s) => s.id === openScriptId) || null;
  }, [character, openScriptId]);

  const blueprint = useMemo(
    () => (openScript ? parseBlueprint(openScript.body) : []),
    [openScript],
  );

  async function saveMeta() {
    if (!character) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/characters/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: character.name,
          pastNote: character.pastNote,
          lookNote: character.lookNote,
          tormentScratch: character.tormentScratch,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setCharacter(data.character);
      setStatus("Saved");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function pinScript() {
    if (!scriptBody.trim()) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/characters/${id}/scripts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: scriptTitle.trim() || "Untitled script",
          body: scriptBody,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Pin failed");
      setCharacter(data.character);
      setScriptTitle("");
      setScriptBody("");
      if (data.character.scripts?.[0]?.id) {
        setOpenScriptId(data.character.scripts[0].id);
      }
      setStatus("Script pinned");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function removeScript(scriptId: string) {
    if (!confirm("Delete this pinned script?")) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/characters/${id}/scripts/${scriptId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      setCharacter(data.character);
      setStatus("Script deleted");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  function flashCopied(label: string) {
    setStatus(`Copied · ${label}`);
    setTimeout(() => setStatus(""), 2000);
  }

  async function saveVoicePrompt() {
    if (!character) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/characters/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceDescription: voiceDesc }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setCharacter(data.character);
      setStatus("Voice prompt saved — hit Gen voice for new takes");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function genVoice() {
    setBusy(true);
    setError("");
    setStatus("Generating voice takes…");
    try {
      const res = await fetch(`/api/characters/${id}/voices/design`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceDescription: voiceDesc }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gen voice failed");
      setCharacter(data.character);
      const newest = [...(data.character.voiceAttempts || [])]
        .reverse()
        .find((v: { fileName?: string }) => v.fileName);
      if (newest?.id) setVoiceListenId(newest.id);
      setStatus(
        `Got ${data.count || "new"} voice take(s) — listen, then Keep voice`,
      );
    } catch (e) {
      setError(String(e));
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  async function setVoiceStatus(
    attemptId: string,
    statusNext: "approved" | "rejected",
  ) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/characters/${id}/voices/${attemptId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: statusNext,
          reason: statusNext === "rejected" ? "Dud" : "",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      setCharacter(data.character);
      setStatus(
        statusNext === "approved"
          ? "Voice locked — used for her line mp3s"
          : "Marked dud",
      );
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function deleteVoiceTake(attemptId: string) {
    if (!confirm("Remove this voice take?")) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/characters/${id}/voices/${attemptId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      setCharacter(data.character);
      setStatus("Voice take removed");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function approveFace(attemptId: string) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/characters/${id}/faces/${attemptId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Approve failed");
      setCharacter(data.character);
      setStatus("Face locked");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function rejectFace(attemptId: string) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/characters/${id}/faces/${attemptId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "rejected",
          reason: "Dud — not this look",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reject failed");
      setCharacter(data.character);
      setStatus("Marked reject — next Gen will steer away");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function deleteFace(attemptId: string) {
    if (!confirm("Bin this face take for good?")) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/characters/${id}/faces/${attemptId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      setCharacter(data.character);
      setStatus("Face take binned");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function clearRejectedFaces() {
    if (!confirm("Wipe all rejected face takes?")) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/characters/${id}/faces/clear-rejected`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Clear failed");
      setCharacter(data.character);
      setStatus("Rejected faces wiped");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function genFace() {
    if (!character) return;
    const note = [character.lookNote, character.pastNote]
      .map((s) => s.trim())
      .filter(Boolean)
      .join(". ");
    if (!note) {
      setError("Fill Look line before Gen face.");
      return;
    }
    setBusy(true);
    setError("");
    setStatus("Generating face…");
    try {
      // Save look/who first so Gen uses what you typed
      await fetch(`/api/characters/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: character.name,
          pastNote: character.pastNote,
          lookNote: character.lookNote,
          tormentScratch: character.tormentScratch,
        }),
      });
      const res = await fetch(`/api/characters/${id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note, styleRealism: 55 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gen face failed");
      setCharacter(data.character);
      setStatus("New face take — Lock it if you like it.");
    } catch (e) {
      setError(String(e));
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  if (!character && !error) {
    return <p className="text-[var(--mute)]">Loading…</p>;
  }
  if (!character) {
    return <p className="text-[var(--fail)]">{error}</p>;
  }

  const facesWithFiles = [...character.faceAttempts]
    .filter((a) => a.fileName)
    .reverse();
  const approvedVoice =
    character.voiceAttempts.find(
      (v) => v.id === character.approvedVoiceAttemptId && v.fileName,
    ) ||
    character.voiceAttempts.find((v) => v.status === "approved" && v.fileName);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs uppercase tracking-[0.16em]">
            <Link
              href="/lab"
              className="text-[var(--mute)] hover:text-[var(--acid)]"
            >
              ← Character Lab
            </Link>
            <Link
              href={`/locations/character/${id}`}
              className="text-[var(--mute)] hover:text-[var(--acid)]"
            >
              Her places →
            </Link>
          </div>
          <h2 className="display mt-1 text-2xl md:text-3xl">{character.name}</h2>
          <div className="mt-1 flex flex-wrap gap-2">
            <Pill tone={character.approved ? "ok" : "mute"}>
              {character.approved ? "Approved Asshole" : "Scratch — not locked"}
            </Pill>
            {character.scripts.length > 0 ? (
              <Pill tone="magenta">
                {character.scripts.length} script
                {character.scripts.length === 1 ? "" : "s"}
              </Pill>
            ) : null}
            {heroFaceId ? <Pill tone="ok">face locked</Pill> : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/">
            <Btn tone="ghost">Productions</Btn>
          </Link>
        </div>
      </div>

      {/* Face + voice — this is where the picture lives */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,280px)_1fr]">
        <Panel className="overflow-hidden p-0">
          <div className="aspect-square bg-[var(--panel-2)]">
            {heroFaceId ? (
              <button
                type="button"
                className="block h-full w-full"
                title="Expand"
                onClick={() =>
                  setPreview({
                    src: `/api/characters/${id}/faces/${heroFaceId}`,
                    title: character.name,
                  })
                }
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/characters/${id}/faces/${heroFaceId}`}
                  alt={character.name}
                  className="h-full w-full cursor-zoom-in object-cover"
                />
              </button>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-sm text-[var(--mute)]">
                <span className="display text-4xl text-[var(--acid)]">
                  {(character.name || "?").trim().charAt(0).toUpperCase()}
                </span>
                No face yet. Fill Look line below → Gen face.
              </div>
            )}
          </div>
          <div className="space-y-2 p-3">
            <p className="text-xs text-[var(--mute)]">
              Locked face for this arsehole. Gen new takes here.
            </p>
            <Btn
              tone="accent"
              className="w-full !py-1.5 text-xs"
              disabled={busy}
              onClick={() => void genFace()}
            >
              {busy ? "Generating…" : "Gen face"}
            </Btn>
            {heroFaceId ? (
              <Btn
                tone="default"
                className="w-full !py-1.5 text-xs"
                onClick={() =>
                  downloadUrl(
                    `/api/characters/${id}/faces/${heroFaceId}`,
                    `${character.name.replace(/\s+/g, "_")}_face.png`,
                  )
                }
              >
                Download face
              </Btn>
            ) : null}
          </div>
        </Panel>

        <div className="space-y-3">
          {facesWithFiles.length > 0 ? (
            <Panel className="p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs uppercase tracking-[0.14em] text-[var(--acid-deep)]">
                  All face takes
                </h3>
                {facesWithFiles.some((a) => a.status === "rejected") ? (
                  <button
                    type="button"
                    disabled={busy}
                    className="text-[10px] uppercase text-[var(--magenta-hot)] underline decoration-dotted disabled:opacity-40"
                    onClick={() => void clearRejectedFaces()}
                  >
                    Wipe rejects
                  </button>
                ) : null}
              </div>
              <p className="mb-2 text-[10px] text-[var(--mute)]">
                Lock = keep. Bin = gone. Reject = keep file but next Gen avoids
                it.
              </p>
              <ul className="flex gap-2 overflow-x-auto pb-1">
                {facesWithFiles.map((a) => (
                  <li key={a.id} className="w-20 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        setPreview({
                          src: `/api/characters/${id}/faces/${a.id}`,
                          title: `${character.name} · ${a.status}`,
                        })
                      }
                      className={`block h-20 w-20 overflow-hidden rounded-sm border ${
                        a.id === heroFaceId
                          ? "border-[var(--acid)] ring-1 ring-[var(--acid)]"
                          : a.status === "rejected"
                            ? "border-[var(--magenta-hot)]/50 opacity-60"
                            : "border-[var(--line)]"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/characters/${id}/faces/${a.id}`}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </button>
                    <p className="mt-0.5 text-center text-[9px] uppercase text-[var(--mute)]">
                      {a.id === heroFaceId ? "locked" : a.status}
                    </p>
                    <div className="mt-0.5 flex flex-col gap-0.5">
                      {a.id !== heroFaceId && a.fileName ? (
                        <button
                          type="button"
                          disabled={busy}
                          className="w-full text-[9px] uppercase text-[var(--acid)] underline decoration-dotted disabled:opacity-40"
                          onClick={() => void approveFace(a.id)}
                        >
                          Lock
                        </button>
                      ) : null}
                      {a.status !== "rejected" && a.id !== heroFaceId ? (
                        <button
                          type="button"
                          disabled={busy}
                          className="w-full text-[9px] uppercase text-[var(--chrome-dim)] underline decoration-dotted disabled:opacity-40"
                          onClick={() => void rejectFace(a.id)}
                        >
                          Reject
                        </button>
                      ) : null}
                      {a.id !== heroFaceId ? (
                        <button
                          type="button"
                          disabled={busy}
                          className="w-full text-[9px] uppercase text-[var(--magenta-hot)] underline decoration-dotted disabled:opacity-40"
                          onClick={() => void deleteFace(a.id)}
                        >
                          Bin
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          <div className="grid gap-3 lg:grid-cols-2">
          <Panel className="p-3">
            <h3 className="mb-1 text-xs uppercase tracking-[0.14em] text-[var(--acid-deep)]">
              Voice
              {approvedVoice ? " — locked ✓" : " — not locked"}
            </h3>
            <p className="mb-2 text-xs text-[var(--mute)]">
              Edit her voice here (Asshole lock). Episode cast Voice is for
              Married Man etc only.
            </p>
            <Field label="Voice prompt (goes into every Gen voice)">
              <TextArea
                rows={3}
                value={voiceDesc}
                onChange={(e) => setVoiceDesc(e.target.value)}
                placeholder="Age, accent, delivery — say what you want, not what you don't"
              />
            </Field>
            <div className="mb-2 flex flex-wrap gap-2">
              <Btn
                tone="default"
                className="!py-1.5 text-xs"
                disabled={
                  busy || voiceDesc === (character.voiceDescription || "")
                }
                onClick={() => void saveVoicePrompt()}
              >
                Save voice prompt
              </Btn>
              <Btn
                tone="accent"
                className="!py-1.5 text-xs"
                disabled={busy || !voiceDesc.trim()}
                onClick={() => void genVoice()}
              >
                {busy ? "…" : "Gen voice"}
              </Btn>
              {voiceDesc.trim() ? (
                <button
                  type="button"
                  className="text-[10px] uppercase tracking-wider text-[var(--acid)] underline decoration-dotted"
                  onClick={() =>
                    void copyText(voiceDesc).then(
                      (ok) => ok && flashCopied("voice"),
                    )
                  }
                >
                  Copy voice line
                </button>
              ) : null}
            </div>
            <p className="mb-2 text-xs text-[var(--mute)]">
              Click a take → listen → Keep voice to lock. Then Rebuild line mp3s
              on shots (Speaker = {character.name}).
            </p>
            {(character.voiceAttempts || []).length === 0 ? (
              <p className="text-sm text-[var(--mute)]">
                No samples yet — hit Gen voice
              </p>
            ) : (
              <>
                <ul className="mb-2 max-h-40 space-y-1 overflow-y-auto">
                  {[...(character.voiceAttempts || [])]
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
                            disabled={busy}
                            onClick={(e) => {
                              e.stopPropagation();
                              void deleteVoiceTake(v.id);
                            }}
                            className="px-2 text-sm text-[var(--magenta-hot)] hover:bg-[var(--magenta)]/20 disabled:opacity-40"
                          >
                            ✕
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
                                  ▶
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
                {(() => {
                  const listen =
                    character.voiceAttempts.find((v) => v.id === voiceListenId) ||
                    null;
                  if (!listen?.fileName) {
                    return (
                      <p className="text-sm text-[var(--mute)]">
                        Click a take to listen
                      </p>
                    );
                  }
                  return (
                    <div className="rounded-sm border border-[var(--acid)]/40 p-2">
                      <audio
                        key={listen.id}
                        controls
                        src={`/api/characters/${id}/voices/${listen.id}`}
                        className="mb-2 w-full"
                      />
                      {listen.status === "approved" ? (
                        <span className="text-sm text-[var(--acid)]">
                          Locked keeper ✓ — Rebuild mp3 on her shots
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          <Btn
                            tone="ok"
                            className="!py-1.5 text-xs"
                            disabled={busy}
                            onClick={() =>
                              void setVoiceStatus(listen.id, "approved")
                            }
                          >
                            Keep voice
                          </Btn>
                          <Btn
                            tone="danger"
                            className="!py-1.5 text-xs"
                            disabled={busy}
                            onClick={() =>
                              void setVoiceStatus(listen.id, "rejected")
                            }
                          >
                            Dud
                          </Btn>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </>
            )}
          </Panel>

          {/* One-click copy for prefill elsewhere */}
          <Panel className="p-3 sm:col-span-2">
            <h3 className="mb-2 text-xs uppercase tracking-[0.14em] text-[var(--acid-deep)]">
              Prefill clipboard
            </h3>
            <p className="mb-2 text-xs text-[var(--mute)]">
              Copy a chunk, paste into an episode shot / Gen prompt.
            </p>
            <div className="flex flex-wrap gap-2">
              <Btn
                tone="accent"
                className="!py-1.5 text-xs"
                disabled={!character.lookNote.trim()}
                onClick={() =>
                  void copyText(character.lookNote).then(
                    (ok) => ok && flashCopied("look line"),
                  )
                }
              >
                Copy look line
              </Btn>
              <Btn
                tone="default"
                className="!py-1.5 text-xs"
                disabled={!character.pastNote.trim()}
                onClick={() =>
                  void copyText(character.pastNote).then(
                    (ok) => ok && flashCopied("who they were"),
                  )
                }
              >
                Copy who-they-were
              </Btn>
              <Btn
                tone="default"
                className="!py-1.5 text-xs"
                disabled={!character.tormentScratch.trim()}
                onClick={() =>
                  void copyText(character.tormentScratch).then(
                    (ok) => ok && flashCopied("torment"),
                  )
                }
              >
                Copy torment
              </Btn>
              {openScript ? (
                <Btn
                  tone="magenta"
                  className="!py-1.5 text-xs"
                  onClick={() =>
                    void copyText(openScript.body).then(
                      (ok) => ok && flashCopied("full script"),
                    )
                  }
                >
                  Copy open script
                </Btn>
              ) : null}
            </div>
            {status ? (
              <p className="mt-2 text-sm text-[var(--acid)]">{status}</p>
            ) : null}
            {error ? (
              <p className="mt-2 text-sm text-[var(--fail)]">{error}</p>
            ) : null}
          </Panel>
          </div>
        </div>
      </div>

      {/* Who | Scripts — 2-up on PC */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel className="p-4">
          <h3 className="display mb-1 text-lg">1 · Who</h3>
          <p className="mb-3 text-xs text-[var(--mute)]">
            Notes + look line. Look line rides every plate.
          </p>
          <Field label="Name">
            <TextInput
              value={character.name}
              onChange={(e) =>
                setCharacter({ ...character, name: e.target.value })
              }
            />
          </Field>
          <Field label="Who they were to you">
            <TextArea
              value={character.pastNote}
              onChange={(e) =>
                setCharacter({ ...character, pastNote: e.target.value })
              }
              rows={4}
            />
          </Field>
          <Field label="Look line — every plate, every episode">
            <TextArea
              value={character.lookNote}
              onChange={(e) =>
                setCharacter({ ...character, lookNote: e.target.value })
              }
              rows={5}
              placeholder="Body, clothes, footwear, hair, build. No expression words."
            />
          </Field>
          <Field label="How we might fuck with them">
            <TextArea
              value={character.tormentScratch}
              onChange={(e) =>
                setCharacter({ ...character, tormentScratch: e.target.value })
              }
              rows={4}
            />
          </Field>
          <Btn tone="accent" disabled={busy} onClick={saveMeta}>
            Save notes
          </Btn>
        </Panel>

        <Panel className="p-4">
          <h3 className="display mb-1 text-lg">2 · Scripts</h3>
          <p className="mb-3 text-xs text-[var(--mute)]">
            Pin the episode template dump. Open one → blueprint chips below for
            copy.
          </p>

          {character.scripts.length > 0 ? (
            <ul className="mb-4 space-y-2">
              {character.scripts.map((s) => (
                <li
                  key={s.id}
                  className={`rounded-sm border p-3 ${
                    openScriptId === s.id
                      ? "border-[var(--acid)]"
                      : "border-[var(--line)] bg-[var(--panel-2)]"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      className="display text-left text-sm text-[var(--magenta-hot)]"
                      onClick={() =>
                        setOpenScriptId(openScriptId === s.id ? "" : s.id)
                      }
                    >
                      {openScriptId === s.id ? "▾" : "▸"} {s.title}
                    </button>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="text-[10px] uppercase tracking-wider text-[var(--acid)] underline decoration-dotted"
                        onClick={() =>
                          void copyText(s.body).then(
                            (ok) => ok && flashCopied(s.title),
                          )
                        }
                      >
                        Copy
                      </button>
                      <button
                        type="button"
                        className="text-[10px] uppercase tracking-wider text-[var(--fail)] underline decoration-dotted"
                        onClick={() => removeScript(s.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  {openScriptId === s.id ? (
                    <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap text-xs text-[var(--chrome-dim)]">
                      {s.body}
                    </pre>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-3 text-sm text-[var(--mute)]">No scripts pinned yet.</p>
          )}

          {blueprint.length > 0 ? (
            <div className="mb-4 space-y-2 border-t border-[var(--line)] pt-3">
              <h4 className="text-xs uppercase tracking-[0.14em] text-[var(--acid-deep)]">
                Blueprint from open script — tap to copy
              </h4>
              {blueprint.map((b) => (
                <button
                  key={b.label}
                  type="button"
                  onClick={() =>
                    void copyText(b.value).then(
                      (ok) => ok && flashCopied(b.label),
                    )
                  }
                  className="block w-full rounded-sm border border-[var(--line)] bg-[var(--panel-2)] p-2 text-left hover:border-[var(--acid)]"
                >
                  <span className="text-[10px] uppercase tracking-wider text-[var(--acid)]">
                    {b.label}
                  </span>
                  <p className="mt-0.5 line-clamp-3 text-xs text-[var(--chrome-dim)]">
                    {b.value}
                  </p>
                </button>
              ))}
            </div>
          ) : null}

          <div className="border-t border-[var(--line)] pt-3">
            <Field label="Title (optional)">
              <TextInput
                value={scriptTitle}
                onChange={(e) => setScriptTitle(e.target.value)}
                placeholder="e.g. Kim full script v3"
              />
            </Field>
            <Field label="Paste new script">
              <TextArea
                value={scriptBody}
                onChange={(e) => setScriptBody(e.target.value)}
                rows={4}
                placeholder="Paste SCENE/SHOT/BEAT breakdown from the episode template"
              />
            </Field>
            <Btn
              tone="accent"
              disabled={busy || !scriptBody.trim()}
              onClick={pinScript}
            >
              Pin script
            </Btn>
          </div>
        </Panel>
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
          </div>
        </div>
      ) : null}
    </div>
  );
}
