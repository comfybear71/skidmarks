"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Btn, Panel, Pill } from "@/components/ui";
import {
  CRASH_SHOW_STYLE_EVENT,
  dispatchStorySaved,
} from "@/lib/crashStyleSync";
import { hydrateSceneKitFromDisk } from "@/lib/crashSceneKitFields";
import { writeComfyDraft } from "@/lib/crashComfyStack";
import {
  saveShowStyleId,
  type ShowStyleId,
} from "@/lib/showStylePresets";
import { setActiveEpisodeFromOpen } from "@/lib/crashActiveEpisode";

type EpisodeRow = {
  label: string;
  styleId: ShowStyleId;
  folderName: string;
  savedAt: string;
  hasStory: boolean;
  hasSceneKit: boolean;
};

type HomeSection = {
  id: "cursor" | "skidmarks" | "sunny_banks";
  title: string;
  blurb: string;
  items: EpisodeRow[];
};

function isCursorPack(ep: EpisodeRow): boolean {
  return ep.folderName.toUpperCase().startsWith("CURSOR_");
}

function sortBySaved(a: EpisodeRow, b: EpisodeRow): number {
  return String(b.savedAt || "").localeCompare(String(a.savedAt || ""));
}

async function fetchShowPacks(styleId: ShowStyleId): Promise<EpisodeRow[]> {
  const res = await fetch(
    `/api/crash/episodes?styleId=${encodeURIComponent(styleId)}`,
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `List failed (${styleId})`);
  return (data.episodes || []) as EpisodeRow[];
}

/**
 * Home — _CRASH_LAB packs in three shelves: CURSOR / Skidmarks / Sunny Banks.
 * Click → open into Crash Lab.
 */
export default function HomePage() {
  const router = useRouter();
  const [episodes, setEpisodes] = useState<EpisodeRow[]>([]);
  const [error, setError] = useState("");
  const [busyFolder, setBusyFolder] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [skid, sunny] = await Promise.all([
          fetchShowPacks("skidmarks"),
          fetchShowPacks("sunny_banks"),
        ]);
        const byKey = new Map<string, EpisodeRow>();
        for (const ep of [...skid, ...sunny]) {
          byKey.set(`${ep.styleId}::${ep.folderName}`, ep);
        }
        const list = Array.from(byKey.values());
        setEpisodes(list);
        if (list.length === 0) {
          setError("No packs listed under Skidmarks or Sunny Banks _CRASH_LAB");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "List failed");
      }
    })();
  }, []);

  const sections: HomeSection[] = useMemo(() => {
    const cursor = episodes.filter(isCursorPack).sort(sortBySaved);
    const skidmarks = episodes
      .filter((ep) => !isCursorPack(ep) && ep.styleId === "skidmarks")
      .sort(sortBySaved);
    const sunny = episodes
      .filter((ep) => !isCursorPack(ep) && ep.styleId === "sunny_banks")
      .sort(sortBySaved);
    return [
      {
        id: "skidmarks",
        title: "SKIDMARKS",
        blurb: "_SKIDMARKS\\_CRASH_LAB — unfinished show packs",
        items: skidmarks,
      },
      {
        id: "sunny_banks",
        title: "SUNNY BANKS",
        blurb: "_SUNNY_BANKS\\_CRASH_LAB — unfinished show packs",
        items: sunny,
      },
      {
        id: "cursor",
        title: "CURSOR",
        blurb: "Agent / Cursor test packs (CURSOR_…)",
        items: cursor,
      },
    ];
  }, [episodes]);

  const [openShelf, setOpenShelf] = useState<Record<string, boolean>>({
    skidmarks: true,
    sunny_banks: true,
    cursor: false,
  });

  function toggleShelf(id: string) {
    setOpenShelf((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  async function openEpisode(ep: EpisodeRow) {
    if (busyFolder) return;
    setBusyFolder(ep.folderName);
    setError("");
    try {
      const res = await fetch("/api/crash/episodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "open",
          folderName: ep.folderName,
          styleId: ep.styleId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Open failed");
      const nextStyle = (data.meta?.styleId ||
        data.story?.styleId ||
        ep.styleId ||
        "skidmarks") as ShowStyleId;
      saveShowStyleId(nextStyle);
      window.dispatchEvent(
        new CustomEvent(CRASH_SHOW_STYLE_EVENT, { detail: nextStyle }),
      );
      if (data.comfyDraft) {
        writeComfyDraft(nextStyle, data.comfyDraft);
      }
      await hydrateSceneKitFromDisk();
      setActiveEpisodeFromOpen({
        folderName: ep.folderName,
        label: data.meta?.label || data.meta?.folderName || ep.folderName,
        styleId: nextStyle,
        story: data.story,
      });
      dispatchStorySaved();
      router.push("/crash");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Open failed");
      setBusyFolder(null);
    }
  }

  function renderPackList(items: EpisodeRow[]) {
    if (!items.length) {
      return (
        <Panel className="p-4 text-[var(--mute)]">No packs in this shelf yet.</Panel>
      );
    }
    return (
      <ul className="space-y-3">
        {items.map((ep) => (
          <li key={`${ep.styleId}::${ep.folderName}`}>
            <button
              type="button"
              disabled={Boolean(busyFolder)}
              onClick={() => void openEpisode(ep)}
              className="block w-full rounded-sm border border-[var(--line)] bg-[var(--panel)] px-4 py-4 text-left transition hover:border-[var(--acid)] disabled:opacity-50"
            >
              <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-3">
                <span className="display min-w-0 break-words text-xl text-[var(--chrome)]">
                  {ep.label || ep.folderName}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  <Pill tone="mute">{ep.styleId}</Pill>
                  {ep.hasStory ? <Pill tone="ok">cut</Pill> : null}
                  {ep.hasSceneKit ? <Pill>scene kit</Pill> : null}
                </div>
              </div>
              <p className="mt-1 text-sm text-[var(--mute)]">
                {busyFolder === ep.folderName
                  ? "Opening in Crash Lab…"
                  : ep.savedAt
                    ? `Saved ${ep.savedAt.slice(0, 19).replace("T", " ")}`
                    : ep.folderName}
              </p>
            </button>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-sm border border-[var(--line)] bg-[var(--panel)]/80">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(225,0,106,0.25),transparent_50%),radial-gradient(ellipse_at_90%_20%,rgba(200,255,46,0.12),transparent_45%)]" />
        <div className="relative grid gap-6 p-6 md:grid-cols-[1.2fr_0.8fr] md:items-center">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-[var(--acid)]">
              Scratch · _CRASH_LAB
            </p>
            <h2 className="display mt-2 text-3xl text-[var(--chrome)] md:text-4xl">
              Episodes in progress
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-[var(--chrome-dim)]">
              Shelves:{" "}
              <strong className="text-[var(--chrome)]">Skidmarks</strong>,{" "}
              <strong className="text-[var(--chrome)]">Sunny Banks</strong>, then{" "}
              <strong className="text-[var(--chrome)]">CURSOR</strong> (agent
              tests) at the bottom. Click a heading to collapse. Click a pack to
              load Crash Lab. Finished keepers live in{" "}
              <code className="text-[var(--mute)]">_EPISODES</code>.
            </p>
            <div className="mt-5">
              <Link href="/crash">
                <Btn tone="accent">Open Crash Lab blank</Btn>
              </Link>
            </div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/skidmarks-logo.png"
            alt=""
            className="mx-auto max-h-40 w-auto drop-shadow-[0_0_28px_rgba(225,0,106,0.35)] md:max-h-48"
          />
        </div>
      </section>

      {error ? (
        <p className="text-sm text-[var(--fail)]">{error}</p>
      ) : null}

      {sections.map((sec) => {
        const open = openShelf[sec.id] !== false;
        return (
          <section
            key={sec.id}
            className="rounded-sm border border-[var(--line)] bg-[var(--panel)]/60"
          >
            <button
              type="button"
              onClick={() => toggleShelf(sec.id)}
              className="flex w-full items-end justify-between gap-3 px-4 py-3 text-left hover:bg-[var(--panel-2)]/80"
              aria-expanded={open}
            >
              <div>
                <h2 className="display text-2xl text-[var(--chrome)]">
                  <span className="mr-2 text-[var(--acid)]" aria-hidden>
                    {open ? "−" : "+"}
                  </span>
                  {sec.title}
                </h2>
                <p className="mt-0.5 text-sm text-[var(--mute)]">{sec.blurb}</p>
              </div>
              <span className="shrink-0 text-xs text-[var(--mute)]">
                {sec.items.length} pack{sec.items.length === 1 ? "" : "s"}
              </span>
            </button>
            {open ? (
              <div className="border-t border-[var(--line)] px-4 py-3">
                {renderPackList(sec.items)}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
