"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BeatAudioMini } from "@/components/BeatAudioMini";
import { MediaThumb } from "@/components/MediaThumb";
import type { CrashSpxItem } from "@/lib/crashSpx";
import type {
  CrashStoryBeat,
  CrashStoryDoc,
  CrashStorySfx,
} from "@/lib/crashStoryTypes";
import { CRASH_STORY_SAVED, CRASH_SHOW_STYLE_EVENT } from "@/lib/crashStyleSync";
import {
  CRASH_ACTIVE_EPISODE_EVENT,
  crashDeskStoryFetchUrl,
} from "@/lib/crashActiveEpisode";
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
  lines: BoardAudioLine[];
};

function beatAudioSrc(styleId: ShowStyleId, beat: CrashStoryBeat): string | null {
  if (!beat.voiceFile) return null;
  return `/api/crash/story/speak?styleId=${encodeURIComponent(styleId)}&beatId=${encodeURIComponent(beat.id)}&t=${encodeURIComponent(beat.voiceFile)}`;
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

  const loadVideos = useCallback(async () => {
    try {
      const [ltxRes, lsRes] = await Promise.all([
        fetch(`/api/crash/comfy/ltx?styleId=${encodeURIComponent(styleId)}`),
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
      const map: Record<string, string> = {};
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
      setVideoByBeat(map);
    } catch {
      /* ignore */
    }
  }, [styleId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const storyUrl = crashDeskStoryFetchUrl(styleId);
      if (!storyUrl) {
        setStory(null);
        return;
      }
      const [storyRes, spxRes] = await Promise.all([
        fetch(storyUrl),
        fetch(`/api/crash/spx?styleId=${encodeURIComponent(styleId)}`),
      ]);
      const storyData = await storyRes.json();
      const spxData = await spxRes.json();
      if (storyRes.ok && storyData.story) {
        setStory(storyData.story as CrashStoryDoc);
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
        {story.campaignLabel || "Storyboard"} — cartoon sheet · mp4 thumb when
        Animate has a take · click to enlarge
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
              className="flex min-w-0 flex-col rounded-sm border-2 border-black bg-[#fff8ea] shadow-[2px_2px_0_#1a1208]"
            >
              <div className="relative aspect-[3/2] w-full overflow-hidden border-b border-black bg-[#e8dcc4]">
                <span className="pointer-events-none absolute left-0.5 top-0.5 z-[1] flex h-4 w-4 items-center justify-center rounded-sm border border-black bg-[#ffe066] text-[9px] font-bold text-black">
                  {p.n}
                </span>
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
              <div className="px-1 py-0.5">
                <p className="truncate text-[7px] font-bold uppercase tracking-wider text-[#8b4513]">
                  {p.label}
                </p>
                <p className="line-clamp-1 text-[8px] leading-tight text-[#2a2018]">
                  {p.caption}
                </p>

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
