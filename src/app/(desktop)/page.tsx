"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Btn, Panel, Pill } from "@/components/ui";
import type { ShowStyleId } from "@/lib/showStylePresets";

type EpisodeRow = {
  label: string;
  styleId: ShowStyleId;
  folderName: string;
  savedAt: string;
  hasStory: boolean;
  hasSceneKit: boolean;
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
 * Home — flat pack list (no shelf chrome, no open links).
 */
export default function HomePage() {
  const [episodes, setEpisodes] = useState<EpisodeRow[]>([]);
  const [error, setError] = useState("");

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

  const packList = useMemo(() => {
    const skidmarks = episodes
      .filter((ep) => !isCursorPack(ep) && ep.styleId === "skidmarks")
      .sort(sortBySaved);
    const sunny = episodes
      .filter((ep) => !isCursorPack(ep) && ep.styleId === "sunny_banks")
      .sort(sortBySaved);
    const cursor = episodes.filter(isCursorPack).sort(sortBySaved);
    return [...skidmarks, ...sunny, ...cursor];
  }, [episodes]);

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-sm border border-[var(--line)] bg-[var(--panel)]/80">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(225,0,106,0.25),transparent_50%),radial-gradient(ellipse_at_90%_20%,rgba(200,255,46,0.12),transparent_45%)]" />
        <div className="relative grid gap-6 p-6 md:grid-cols-[1.2fr_0.8fr] md:items-center">
          <div>
            <h2 className="display text-3xl text-[var(--chrome)] md:text-4xl">
              Episodes in progress
            </h2>
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

      {!packList.length ? (
        <Panel className="p-4 text-[var(--mute)]">No packs yet.</Panel>
      ) : (
        <ul className="space-y-3">
          {packList.map((ep) => (
            <li
              key={`${ep.styleId}::${ep.folderName}`}
              className="rounded-sm border border-[var(--line)] bg-[var(--panel)] px-4 py-4"
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
                {ep.savedAt
                  ? `Saved ${ep.savedAt.slice(0, 19).replace("T", " ")}`
                  : ep.folderName}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
