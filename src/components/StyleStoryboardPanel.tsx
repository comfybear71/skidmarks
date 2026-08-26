"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BeatAudioMini } from "@/components/BeatAudioMini";
import { MediaThumb } from "@/components/MediaThumb";
import type { CrashSpxItem } from "@/lib/crashSpx";
import type {
  CrashStoryBeat,
  CrashStoryDoc,
  CrashStoryShot,
  CrashStorySfx,
  ShotFootageRole,
} from "@/lib/crashStoryTypes";
import { CRASH_STORY_SAVED, CRASH_SHOW_STYLE_EVENT, dispatchStorySaved } from "@/lib/crashStyleSync";
import {
  CRASH_ACTIVE_EPISODE_EVENT,
  crashDeskLtxFetchUrl,
  crashDeskStoryFetchUrl,
  crashDeskStoryPutBody,
  preferPackedStory,
  readActiveEpisode,
  readOpenLtxCache,
  readOpenStoryCache,
  writeOpenStoryCache,
} from "@/lib/crashActiveEpisode";
import { findStoryShot, isSupportShot } from "@/lib/stockFootage";
import { StockFootagePanel } from "@/components/StockFootagePanel";
import {
  COMFY_INTRO_BEAT_ID,
  COMFY_OUTRO_BEAT_ID,
} from "@/lib/crashComfyStack";
import type { ShowStyleId } from "@/lib/showStylePresets";

type BoardAudioLine = {
  kind: "voice" | "sfx";
  label: string;
  text?: string;
  audioSrc: string | null;
};

type BoardPanel = {
  id: string;
  n: number;
  label: string;
  caption: string;
  src: string | null;
  /** LTX / lipsync mp4 — preferred over still thumb */
  videoSrc: string | null;
  kind: "intro" | "shot" | "outro";
  footageRole?: ShotFootageRole;
  lines: BoardAudioLine[];
};

function beatAudioSrc(styleId: ShowStyleId, beat: CrashStoryBeat): string | null {
  if (!beat.voiceFile) return null;
  // The GET handler only reads "f"/"voiceFile" — "t" was silently ignored,
  // so playback always fell back to guessing "<beatId>.mp3".
  return `/api/crash/story/speak?styleId=${encodeURIComponent(styleId)}&beatId=${encodeURIComponent(beat.id)}&f=${encodeURIComponent(beat.voiceFile)}`;
}

function sfxAudioSrc(
  styleId: ShowStyleId,
  sfx: CrashStorySfx,
  shelf: CrashSpxItem[],
): string | null {
  const shelfHit = sfx.spxId
    ? shelf.find((r) => r.id === sfx.spxId && r.kind === "sfx")
    : null;
  if (shelfHit) {
    return `/api/crash/spx/file?styleId=${encodeURIComponent(styleId)}&kind=sfx&file=${encodeURIComponent(shelfHit.fileName)}&t=${encodeURIComponent(shelfHit.mtime)}`;
  }
  if (sfx.audioFile) {
    return `/api/crash/story/sfx?styleId=${encodeURIComponent(styleId)}&sfxId=${encodeURIComponent(sfx.id)}&f=${encodeURIComponent(sfx.audioFile)}`;
  }
  return null;
}

function sfxLines(
  styleId: ShowStyleId,
  rows: CrashStorySfx[],
  shelf: CrashSpxItem[],
): BoardAudioLine[] {
  return rows.map((sfx) => ({
    kind: "sfx" as const,
    label: sfx.label,
    audioSrc: sfxAudioSrc(styleId, sfx, shelf),
  }));
}

function pickShotVideo(
  beats: CrashStoryBeat[],
  videoByBeat: Record<string, string>,
): string | null {
  for (const b of beats) {
    const url = videoByBeat[b.id];
    if (url) return url;
  }
  return null;
}

function buildPanels(
  story: CrashStoryDoc,
  styleId: ShowStyleId,
  shelf: CrashSpxItem[],
  videoByBeat: Record<string, string>,
): BoardPanel[] {
  const bust = story.updatedAt ? encodeURIComponent(story.updatedAt) : "1";
  const genUrl = (file: string) =>
    `/api/crash/gen/file?name=${encodeURIComponent(file)}&t=${bust}`;

  const out: BoardPanel[] = [];
  let n = 1;

  // Intro/outro only when this episode hooked a title/end plate.
  // Do not paint leftover Animate mp4s for empty bookends.
  const introLogo = String(story.intro.logoFile || "").trim();
  if (introLogo) {
    out.push({
      id: "intro",
      n: n++,
      label: "INTRO",
      caption: story.intro.title || "Title card",
      src: genUrl(introLogo),
      videoSrc: videoByBeat[COMFY_INTRO_BEAT_ID] || null,
      kind: "intro",
      lines: sfxLines(styleId, story.intro.sfx, shelf),
    });
  }

  for (const scene of story.scenes) {
    for (const shot of scene.shots) {
      const voiceLines: BoardAudioLine[] = shot.beats
        .filter((b) => b.text.trim())
        .map((beat) => ({
          kind: "voice" as const,
          label: beat.speaker,
          text: beat.text.trim(),
          audioSrc: beatAudioSrc(styleId, beat),
        }));

      out.push({
        id: shot.id,
        n: n++,
        label: shot.title || "Shot",
        caption: shot.summary || scene.placeName,
        src: shot.plateFile ? genUrl(shot.plateFile) : null,
        videoSrc: pickShotVideo(shot.beats, videoByBeat),
        kind: "shot",
        footageRole: shot.footageRole,
        lines: [...voiceLines, ...sfxLines(styleId, shot.sfx, shelf)],
      });
    }
  }

  const outroLogo = String(story.outro.logoFile || "").trim();
  if (outroLogo) {
    out.push({
      id: "outro",
      n: n++,
      label: "OUTRO",
      caption: story.outro.title || "End card",
      src: genUrl(outroLogo),
      videoSrc: videoByBeat[COMFY_OUTRO_BEAT_ID] || null,
      kind: "outro",
      lines: sfxLines(styleId, story.outro.sfx, shelf),
    });
  }

  return out;
}

type Props = {
  styleId: ShowStyleId;
};

export function StyleStoryboardPanel({ styleId }: Props) {
  const [story, setStory] = useState<CrashStoryDoc | null>(null);
  const [shelf, setShelf] = useState<CrashSpxItem[]>([]);
  const [videoByBeat, setVideoByBeat] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [lightbox, setLightbox] = useState<{
    src: string;
    label: string;
    video?: boolean;
  } | null>(null);
  const [selectedShotId, setSelectedShotId] = useState<string | null>(null);
  const [stockBusy, setStockBusy] = useState(false);
  const [stockErr, setStockErr] = useState("");
  const storySaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const storyLatestRef = useRef<CrashStoryDoc | null>(null);

  const loadVideos = useCallback(async () => {
    try {
      const cached = readOpenLtxCache(styleId);
      const map: Record<string, string> = {};
      for (const r of cached) {
        if (r.beatId && r.url) map[r.beatId] = r.url;
      }
      if (Object.keys(map).length) setVideoByBeat(map);
      const [ltxRes, lsRes] = await Promise.all([
        fetch(crashDeskLtxFetchUrl(styleId)),
        fetch(
          `/api/crash/comfy/lipsync?styleId=${encodeURIComponent(styleId)}`,
        ),
      ]);
      const ltxData = (await ltxRes.json()) as {
        results?: Array<{ beatId: string; url: string }>;
      };
      const lsData = (await lsRes.json()) as {
        results?: Array<{ beatId: string; url: string }>;
      };
      if (ltxRes.ok && Array.isArray(ltxData.results)) {
        for (const r of ltxData.results) {
          if (r.beatId && r.url) map[r.beatId] = r.url;
        }
      }
      if (lsRes.ok && Array.isArray(lsData.results)) {
        for (const r of lsData.results) {
          if (r.beatId && r.url) map[r.beatId] = r.url;
        }
      }
      if (Object.keys(map).length) setVideoByBeat(map);
    } catch {
      /* ignore */
    }
  }, [styleId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const cached = readOpenStoryCache(styleId) as CrashStoryDoc | null;
      if (cached?.styleId === styleId) {
        setStory(cached);
        storyLatestRef.current = cached;
      }
      const storyUrl = crashDeskStoryFetchUrl(styleId);
      if (!storyUrl) {
        if (!cached) {
          setStory(null);
          storyLatestRef.current = null;
        }
        return;
      }
      const [storyRes, spxRes] = await Promise.all([
        fetch(storyUrl),
        fetch(`/api/crash/spx?styleId=${encodeURIComponent(styleId)}`),
      ]);
      const storyData = await storyRes.json();
      const spxData = await spxRes.json();
      if (storyRes.ok && storyData.story) {
        const next = preferPackedStory(storyData.story, cached) as CrashStoryDoc;
        if (next?.styleId) {
          setStory(next);
          storyLatestRef.current = next;
        }
      } else if (cached?.styleId === styleId) {
        setStory(cached);
        storyLatestRef.current = cached;
      }
      if (spxRes.ok && Array.isArray(spxData.items)) {
        setShelf(
          (spxData.items as CrashSpxItem[]).filter((i) => i.kind === "sfx"),
        );
      }
      await loadVideos();
    } finally {
      setLoading(false);
    }
  }, [styleId, loadVideos]);

  useEffect(() => {
    void load();
    const onStory = () => void load();
    const onStyle = () => void load();
    window.addEventListener(CRASH_STORY_SAVED, onStory);
    window.addEventListener(CRASH_SHOW_STYLE_EVENT, onStyle);
    window.addEventListener(CRASH_ACTIVE_EPISODE_EVENT, onStory);
    return () => {
      window.removeEventListener(CRASH_STORY_SAVED, onStory);
      window.removeEventListener(CRASH_SHOW_STYLE_EVENT, onStyle);
      window.removeEventListener(CRASH_ACTIVE_EPISODE_EVENT, onStory);
    };
  }, [load]);

  const panels = useMemo(
    () => (story ? buildPanels(story, styleId, shelf, videoByBeat) : []),
    [story, styleId, shelf, videoByBeat],
  );

  const selectedShot = useMemo(
    () => (story && selectedShotId ? findStoryShot(story, selectedShotId) : null),
    [story, selectedShotId],
  );

  const persistStory = useCallback(
    (next: CrashStoryDoc, flush?: boolean) => {
      setStory(next);
      storyLatestRef.current = next;
      const ep = readActiveEpisode();
      if (ep?.folderName) {
        writeOpenStoryCache({
          styleId,
          folderName: ep.folderName,
          story: next,
        });
      }

      const doPut = async () => {
        const doc = storyLatestRef.current || next;
        const payload = crashDeskStoryPutBody(doc);
        if (!payload.folderName) {
          setStockErr("Open a pack first — stock tags need folderName.");
          return;
        }
        try {
          const res = await fetch("/api/crash/story", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const data = (await res.json()) as {
            error?: string;
            story?: CrashStoryDoc;
          };
          if (!res.ok) {
            setStockErr(data.error || "Could not save stock tag");
            return;
          }
          if (data.story) {
            setStory(data.story);
            storyLatestRef.current = data.story;
          }
          dispatchStorySaved();
        } catch (e) {
          setStockErr(e instanceof Error ? e.message : "Could not save stock tag");
        }
      };

      if (flush) {
        if (storySaveTimer.current) {
          clearTimeout(storySaveTimer.current);
          storySaveTimer.current = null;
        }
        return doPut();
      }
      if (storySaveTimer.current) clearTimeout(storySaveTimer.current);
      storySaveTimer.current = setTimeout(() => {
        void doPut();
      }, 450);
    },
    [styleId],
  );

  const patchSelectedShot = useCallback(
    (mutator: (s: CrashStoryShot) => CrashStoryShot, flush = false) => {
      const current = storyLatestRef.current || story;
      if (!current || !selectedShotId) return;
      const base = findStoryShot(current, selectedShotId);
      if (!base) return;
      const nextShot = mutator(base);
      persistStory(
        {
          ...current,
          scenes: current.scenes.map((sc) => ({
            ...sc,
            shots: sc.shots.map((sh) => (sh.id === nextShot.id ? nextShot : sh)),
          })),
          updatedAt: new Date().toISOString(),
        },
        flush,
      );
    },
    [persistStory, selectedShotId, story],
  );

  const attachStockFile = useCallback(
    (file: File) => {
      const beatId = selectedShot?.beats[0]?.id;
      if (!beatId) {
        setStockErr("This shot has no beat to hang on.");
        return;
      }
      setStockBusy(true);
      setStockErr("");
      void (async () => {
        try {
          const fd = new FormData();
          fd.set("styleId", styleId);
          fd.set("beatId", beatId);
          fd.set("file", file, file.name);
          const res = await fetch("/api/crash/comfy/ltx/attach", {
            method: "POST",
            body: fd,
          });
          const data = (await res.json()) as { error?: string };
          if (!res.ok) throw new Error(data.error || "Attach failed");
          await loadVideos();
        } catch (e) {
          setStockErr(e instanceof Error ? e.message : "Attach failed");
        } finally {
          setStockBusy(false);
        }
      })();
    },
    [loadVideos, selectedShot, styleId],
  );

  const audioReady = panels.reduce(
    (n, p) => n + p.lines.filter((l) => l.audioSrc).length,
    0,
  );
  const audioTotal = panels.reduce((n, p) => n + p.lines.length, 0);
  const videoCount = panels.filter((p) => p.videoSrc).length;

  if (loading && !story) {
    return <p className="p-2 text-[10px] text-[var(--mute)]">Loading board…</p>;
  }

  if (!story) {
    return (
      <p className="p-2 text-[10px] text-[var(--mute)]">
        No story — fill Story panel first.
      </p>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1">
      <p className="shrink-0 text-[9px] text-[var(--mute)]">
        {story.campaignLabel || "Storyboard"} — cartoon sheet · click a shot
        title for Hero / Support stock · thumb enlarges
      </p>

      <div
        className="crash-tray-scroll min-h-0 flex-1 overflow-auto rounded-sm border-2 border-[#1a1208] p-1.5"
        style={{
          backgroundColor: "#f4e8c8",
          backgroundImage: `
            linear-gradient(#dcc9a3 1px, transparent 1px),
            linear-gradient(90deg, #dcc9a3 1px, transparent 1px)
          `,
          backgroundSize: "20px 20px",
        }}
      >
        <div
          className="grid gap-1.5"
          style={{
            gridTemplateColumns:
              "repeat(auto-fill, minmax(min(100%, 160px), 1fr))",
          }}
        >
          {panels.map((p) => (
            <article
              key={p.id}
              className={`flex min-w-0 flex-col rounded-sm border-2 bg-[#fff8ea] shadow-[2px_2px_0_#1a1208] ${
                selectedShotId === p.id
                  ? "border-[var(--acid)]"
                  : "border-black"
              }`}
            >
              <div className="relative aspect-[3/2] w-full overflow-hidden border-b border-black bg-[#e8dcc4]">
                <span className="pointer-events-none absolute left-0.5 top-0.5 z-[1] flex h-4 w-4 items-center justify-center rounded-sm border border-black bg-[#ffe066] text-[9px] font-bold text-black">
                  {p.n}
                </span>
                {p.kind === "shot" && isSupportShot({ footageRole: p.footageRole }) ? (
                  <span className="pointer-events-none absolute right-0.5 top-0.5 z-[1] rounded-sm border border-black bg-[var(--acid)] px-1 text-[8px] font-bold uppercase tracking-wide text-[#111]">
                    Support
                  </span>
                ) : null}
                {p.videoSrc || p.src ? (
                  <MediaThumb
                    stillSrc={p.src}
                    videoSrc={p.videoSrc}
                    alt={p.label}
                    draggable={!p.videoSrc}
                    className="h-full w-full object-cover active:cursor-grabbing"
                    title={
                      p.videoSrc
                        ? "mp4 thumb — click to enlarge"
                        : "Click to enlarge · drag to Comfy or a folder"
                    }
                    onClick={() =>
                      setLightbox({
                        src: p.videoSrc || p.src!,
                        label: p.label,
                        video: Boolean(p.videoSrc),
                      })
                    }
                  />
                ) : (
                  <div className="flex h-full items-center justify-center p-1 text-center text-[8px] font-medium uppercase tracking-wide text-[#5c4a32]">
                    {p.kind === "intro"
                      ? "Title card"
                      : p.kind === "outro"
                        ? "End card"
                        : "Plate missing"}
                  </div>
                )}
              </div>
              <button
                type="button"
                className="w-full px-1 py-0.5 text-left"
                title={
                  p.kind === "shot"
                    ? "Tag Hero / Support and hang stock"
                    : p.label
                }
                onClick={() => {
                  if (p.kind === "shot") {
                    setSelectedShotId(p.id);
                    setStockErr("");
                  }
                }}
              >
                <p className="truncate text-[7px] font-bold uppercase tracking-wider text-[#8b4513]">
                  {p.label}
                </p>
                <p className="line-clamp-1 text-[8px] leading-tight text-[#2a2018]">
                  {p.caption}
                </p>
              </button>
              <div className="px-1 pb-0.5">
                {p.lines.length ? (
                  <ul className="mt-0.5 space-y-0.5 border-t border-[#dcc9a3] pt-0.5 pb-0.5">
                    {p.lines.slice(0, 3).map((line, i) => (
                      <li
                        key={`${p.id}-${line.kind}-${i}`}
                        className="rounded-sm bg-[#f0e4cc]/80 px-0.5 py-px"
                      >
                        <div className="flex items-center gap-0.5">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[7px] font-bold uppercase tracking-wide text-[#8b4513]">
                              {line.kind === "sfx"
                                ? `SFX · ${line.label}`
                                : line.label}
                            </p>
                            {line.text ? (
                              <p className="line-clamp-1 text-[7px] leading-tight text-[#2a2018]">
                                {line.text}
                              </p>
                            ) : null}
                          </div>
                          {line.audioSrc ? (
                            <BeatAudioMini src={line.audioSrc} compact />
                          ) : (
                            <span className="shrink-0 text-[7px] text-[#8b7355]">
                              …
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                    {p.lines.length > 3 ? (
                      <li className="text-[7px] text-[#8b7355]">
                        +{p.lines.length - 3} more
                      </li>
                    ) : null}
                  </ul>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </div>

      <p className="shrink-0 text-[8px] text-[var(--chrome-dim)]">
        {panels.filter((p) => p.src || p.videoSrc).length}/{panels.length}{" "}
        panels filled · {videoCount} mp4 thumbs · {audioReady}/{audioTotal} audio
        ready
      </p>

      {selectedShot ? (
        <StockFootagePanel
          shot={selectedShot}
          attachBusy={stockBusy}
          attachError={stockErr}
          onRoleChange={(footageRole) =>
            patchSelectedShot((s) => ({ ...s, footageRole }), true)
          }
          onQueryChange={(stockQuery) =>
            patchSelectedShot((s) => ({ ...s, stockQuery }))
          }
          onAttachFile={attachStockFile}
        />
      ) : (
        <p className="shrink-0 text-[10px] text-[var(--mute)]">
          Click a shot title to tag Hero (LTX) or Support (stock b-roll).
        </p>
      )}

      <StoryFolderLinks styleId={styleId} />

      {lightbox ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/85 p-4"
          role="dialog"
          aria-label={lightbox.label}
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 rounded-sm border border-white/40 px-3 py-1 text-[12px] text-white hover:bg-white/10"
            onClick={() => setLightbox(null)}
          >
            Close
          </button>
          {lightbox.video ? (
            <video
              src={lightbox.src}
              controls
              autoPlay
              playsInline
              className="max-h-[90vh] max-w-[95vw] bg-black shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={lightbox.src}
              alt={lightbox.label}
              className="max-h-[90vh] max-w-[95vw] object-contain shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}

function StoryFolderLinks({ styleId }: { styleId: ShowStyleId }) {
  const [paths, setPaths] = useState<Awaited<
    ReturnType<typeof fetchLocations>
  > | null>(null);
  const [openErr, setOpenErr] = useState("");

  async function fetchLocations() {
    const res = await fetch(
      `/api/crash/story/locations?styleId=${encodeURIComponent(styleId)}`,
    );
    const data = await res.json();
    return data.locations as {
      archiveRoot: string | null;
      comfyMd: string | null;
      comfyExportFolder: string | null;
      links: { label: string; displayPath: string; absPath: string }[];
      studioNote: string;
      campaignLabel: string;
    };
  }

  useEffect(() => {
    void fetchLocations().then(setPaths);
    const onStory = () => void fetchLocations().then(setPaths);
    window.addEventListener(CRASH_STORY_SAVED, onStory);
    return () => window.removeEventListener(CRASH_STORY_SAVED, onStory);
  }, [styleId]);

  async function openFolder(absPath: string) {
    setOpenErr("");
    try {
      const res = await fetch("/api/crash/open-folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: absPath }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setOpenErr(data.error || `Could not open (${res.status})`);
      }
    } catch (e) {
      setOpenErr(e instanceof Error ? e.message : "Could not open folder");
    }
  }

  async function copyPath(p: string) {
    try {
      await navigator.clipboard.writeText(p);
    } catch {
      /* ignore */
    }
  }

  if (!paths?.links?.length) {
    return (
      <p className="shrink-0 text-[10px] text-[var(--mute)]">
        After CURSOR finishes, files land under{" "}
        <strong className="text-[var(--chrome-dim)]">
          MY MOVIES\_SKIDMARKS\_CRASH_LAB\CURSOR_…
        </strong>
        . Open pack folder shows the cartoon sheet when plates exist.
      </p>
    );
  }

  const folderPath = paths.links[0]?.absPath ?? "";

  return (
    <div className="shrink-0 rounded-sm border border-[var(--line)] bg-[var(--panel-2)] p-2">
      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-[var(--acid-deep)]">
        Files on PC — {paths.campaignLabel || "campaign"}
      </p>
      <div className="flex items-start gap-1.5">
        <button
          type="button"
          className="min-w-0 flex-1 break-all text-left font-mono text-[11px] leading-snug text-[var(--acid)] underline decoration-[var(--acid-deep)]/40 hover:text-[var(--chrome)]"
          title="Open in Explorer"
          onClick={() => void openFolder(folderPath)}
        >
          {folderPath}
        </button>
        <button
          type="button"
          className="shrink-0 rounded-sm border border-[var(--line)] px-1.5 py-0.5 text-[9px] uppercase text-[var(--chrome-dim)] hover:border-[var(--acid-deep)] hover:text-[var(--acid)]"
          onClick={() => void openFolder(folderPath)}
        >
          Open
        </button>
        <button
          type="button"
          className="shrink-0 rounded-sm border border-[var(--line)] px-1.5 py-0.5 text-[9px] uppercase text-[var(--chrome-dim)] hover:border-[var(--acid-deep)]"
          title="Copy path"
          onClick={() => void copyPath(folderPath)}
        >
          Copy
        </button>
      </div>
      {openErr ? (
        <p className="mt-2 rounded-sm border border-[var(--magenta-hot)]/50 bg-[var(--magenta-hot)]/10 px-2 py-1.5 text-[11px] leading-snug text-[var(--magenta-hot)]">
          {openErr}
        </p>
      ) : null}
    </div>
  );
}
