"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { copyText } from "@/components/CopyBits";
import { Btn, Field, Panel, Pill, TextArea, TextInput } from "@/components/ui";
import { EPISODE_TEMPLATE } from "@/lib/episodeTemplate";
import type { Character } from "@/lib/types";

export default function LabPage() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [name, setName] = useState("");
  const [pastNote, setPastNote] = useState("");
  const [tormentScratch, setTormentScratch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [templateCopied, setTemplateCopied] = useState(false);
  const [templateText, setTemplateText] = useState(EPISODE_TEMPLATE);

  async function refresh() {
    const res = await fetch("/api/characters");
    const data = await res.json();
    setCharacters(data.characters || []);
  }

  useEffect(() => {
    refresh().catch((e) => setError(String(e)));
  }, []);

  async function create() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/characters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, pastNote, tormentScratch }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Create failed");
      window.location.href = `/lab/${data.character.id}`;
    } catch (e) {
      setError(String(e));
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Panel className="p-4">
        <details>
          <summary className="display cursor-pointer text-lg text-[var(--magenta-hot)]">
            Episode script template
          </summary>
          <p className="mt-2 max-w-2xl text-sm text-[var(--chrome-dim)]">
            The locked Skidmarks story spine + house rules, as one block. Copy it,
            paste it into an outside AI, fill in the character/location/fake-win
            bits at the bottom, and it hands back a scene breakdown shaped for
            Studio.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Btn
              tone="accent"
              onClick={() =>
                void copyText(templateText).then((ok) => {
                  setTemplateCopied(ok);
                  setTimeout(() => setTemplateCopied(false), 2000);
                })
              }
            >
              {templateCopied ? "Copied" : "Copy template"}
            </Btn>
            <Btn
              tone="ghost"
              onClick={() => setTemplateText(EPISODE_TEMPLATE)}
            >
              Reset to locked file
            </Btn>
            <span className="text-xs text-[var(--mute)]">
              Edit below, then Copy. File on disk: Skidmarks/docs/EPISODE_TEMPLATE.md
            </span>
          </div>
          <TextArea
            value={templateText}
            onChange={(e) => setTemplateText(e.target.value)}
            rows={14}
            className="mt-3 font-mono text-xs"
          />
        </details>
      </Panel>

      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
      <section>
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--magenta-hot)]">
          Scratch pad
        </p>
        <h2 className="display mb-2 text-3xl">Character Lab</h2>
        <p className="mb-6 max-w-lg text-sm text-[var(--chrome-dim)]">
          Victim notes, look line, locked face, and pinned scripts. New faces
          still get made here — open the arsehole → Gen face.
        </p>

        {characters.length === 0 ? (
          <Panel className="p-6 text-[var(--mute)]">
            No characters yet. Start one on the right.
          </Panel>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {characters.map((c) => {
              const face =
                c.approvedFaceId ||
                c.faceAttempts.find((a) => a.fileName)?.id ||
                "";
              const faceSrc = face
                ? `/api/characters/${c.id}/faces/${face}`
                : null;
              return (
                <li key={c.id} className="list-none">
                  <Link
                    href={`/lab/${c.id}`}
                    className="flex gap-3 rounded-sm border border-[var(--line)] bg-[var(--panel)] p-3 transition hover:border-[var(--acid)]"
                  >
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-sm border border-[var(--line)] bg-[var(--panel-2)]">
                      {faceSrc ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={faceSrc}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-2xl text-[var(--acid)]">
                          {(c.name || "?").trim().charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="display text-lg">{c.name}</span>
                        <Pill tone={c.approved ? "ok" : "mute"}>
                          {c.approved ? "Approved" : "Scratch"}
                        </Pill>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-[var(--mute)]">
                        {c.pastNote || "No past note yet"}
                      </p>
                      <p className="mt-1 text-[10px] text-[var(--chrome-dim)]">
                        {c.scripts?.length || 0} script
                        {(c.scripts?.length || 0) === 1 ? "" : "s"}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </div>
        )}
        {error ? (
          <p className="mt-4 text-sm text-[var(--fail)]">{error}</p>
        ) : null}
      </section>

      <section>
        <Panel className="p-5">
          <h3 className="display mb-4 text-xl">New arsehole</h3>
          <Field label="Name / nickname">
            <TextInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="DAP"
            />
          </Field>
          <Field label="Who they were to you">
            <TextArea
              value={pastNote}
              onChange={(e) => setPastNote(e.target.value)}
              placeholder="Someone from your past who's getting skidmarked…"
              rows={3}
            />
          </Field>
          <Field label="How we might fuck with them (scratch)">
            <TextArea
              value={tormentScratch}
              onChange={(e) => setTormentScratch(e.target.value)}
              placeholder="Optional — refine when you start a production"
              rows={3}
            />
          </Field>
          <Btn tone="accent" disabled={busy} onClick={create}>
            {busy ? "Creating…" : "Create & open scratch"}
          </Btn>
        </Panel>
      </section>
      </div>
    </div>
  );
}
