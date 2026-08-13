"use client";

import { useState } from "react";
import { Panel, TextInput } from "@/components/ui";
import type { Scene, Shot } from "@/lib/types";

type Props = {
  scene: Scene;
  onPatchShot: (shotId: string, fn: (sh: Shot) => Shot) => void;
  onOpenShot: (shotId: string) => void;
  activeShotId: string;
};

/** Brief editable one-liners per shot — no scripts, no scene essay. */
export function SceneFlow({
  scene,
  onPatchShot,
  onOpenShot,
  activeShotId,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Panel className="border border-[var(--acid)]/30 p-0">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="text-[11px] uppercase tracking-wider text-[var(--acid)]">
          {open ? "▾" : "▸"} Summary — {scene.title || scene.slug}
        </span>
        <span className="text-[10px] text-[var(--mute)]">
          {scene.shots.length} shots
        </span>
      </button>

      {open ? (
        <ul className="space-y-1 border-t border-[var(--line)] px-3 py-2">
          {scene.shots.map((sh) => (
            <li
              key={sh.id}
              className={`flex items-center gap-2 rounded-sm px-1 py-0.5 ${
                sh.id === activeShotId ? "bg-[var(--acid)]/10" : ""
              }`}
            >
              <button
                type="button"
                className="w-14 shrink-0 text-left font-mono text-xs text-[var(--acid)] hover:underline"
                onClick={() => onOpenShot(sh.id)}
                title={sh.title || "Open shot"}
              >
                {sh.code}
                {sh.done ? " ✓" : ""}
              </button>
              <TextInput
                className="!py-1 !text-sm"
                value={sh.script || ""}
                placeholder="Brief idea…"
                onChange={(e) =>
                  onPatchShot(sh.id, (s) => ({
                    ...s,
                    script: e.target.value,
                  }))
                }
              />
            </li>
          ))}
        </ul>
      ) : null}
    </Panel>
  );
}
