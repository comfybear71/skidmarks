import fs from "fs";
import path from "path";
import { probeDurationSeconds } from "./mediaDuration";
import { DATA_DIR, EPISODES_FILE } from "./paths";
import type {
  CrashMorphEntry,
  Episode,
  EpisodeCastMember,
  SavedText,
  SavedVoice,
  Scene,
  Shot,
  ShotRender,
} from "./types";
import {
  emptyBeat,
  emptyShotRender,
  ensureShotBeats,
  MAX_SHOT_BEATS,
  MIN_SHOT_BEATS,
  mirrorBeat0,
  newId,
} from "./types";

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(EPISODES_FILE)) {
    fs.writeFileSync(EPISODES_FILE, JSON.stringify({ episodes: [] }, null, 2));
  }
}

function normalizeRender(r: ShotRender): ShotRender {
  return {
    ...r,
    status: r.status || "pending",
    note: r.note || "",
    fileName: r.fileName || "",
    version: r.version || "v1",
  };
}

function normalizeCast(m: EpisodeCastMember): EpisodeCastMember {
  return {
    ...m,
    roleNote: m.roleNote || "",
    voiceDescription: m.voiceDescription || "",
    previewText: m.previewText || "",
    references: m.references || [],
    faceAttempts: (m.faceAttempts || []).map((a) => ({
      ...a,
      styleRealism: a.styleRealism ?? 60,
      source: a.source || (a.fileName ? "upload" : "text"),
    })),
    voiceAttempts: m.voiceAttempts || [],
    approvedFaceId: m.approvedFaceId || "",
    approvedVoiceAttemptId: m.approvedVoiceAttemptId || "",
    approvedVoiceId: m.approvedVoiceId || "",
  };
}

function normalizeShot(sh: Shot): Shot {
  return mirrorBeat0({
    ...sh,
    plate: sh.plate || "",
    plateFile: sh.plateFile || "",
    voice: sh.voice || "",
    voiceFile: sh.voiceFile || "",
    cutaway: Boolean(sh.cutaway),
    renders: (sh.renders || []).map(normalizeRender),
    approvedRenderId: sh.approvedRenderId || "",
    done: Boolean(sh.done),
    beats: sh.beats,
  });
}

function normalizeScene(sc: Scene): Scene {
  return {
    ...sc,
    locationId: sc.locationId || "",
    roomId: sc.roomId || "",
    shots: (sc.shots || []).map(normalizeShot),
  };
}

function normalizeEpisode(ep: Episode): Episode {
  return {
    ...ep,
    victimCharacterId: ep.victimCharacterId || "",
    torment: ep.torment || "",
    cast: (ep.cast || []).map(normalizeCast),
    crashMorphs: Array.isArray(ep.crashMorphs)
      ? ep.crashMorphs.map((m) => ({
          ...m,
          kind: m.kind === "still" ? "still" : "morph",
          sceneId: m.sceneId || "",
          shotId: m.shotId || "",
          beatId: m.beatId || "",
          runId: m.runId || "",
          fileName: m.fileName || "",
        }))
      : [],
    scenes: (ep.scenes || []).map(normalizeScene),
  };
}

export function episodeRendersDir(episodeId: string) {
  return path.join(DATA_DIR, "episodes", episodeId, "renders");
}

export function episodePlatesDir(episodeId: string) {
  return path.join(DATA_DIR, "episodes", episodeId, "plates");
}

export function episodeVoicesDir(episodeId: string) {
  return path.join(DATA_DIR, "episodes", episodeId, "voices");
}

export function listEpisodes(): Episode[] {
  ensureDataDir();
  const raw = JSON.parse(fs.readFileSync(EPISODES_FILE, "utf8")) as {
    episodes: Episode[];
  };
  return (raw.episodes || [])
    .map(normalizeEpisode)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getEpisode(id: string): Episode | null {
  return listEpisodes().find((e) => e.id === id) ?? null;
}

export function saveEpisode(episode: Episode): Episode {
  ensureDataDir();
  const all = listEpisodes();
  const next = normalizeEpisode({
    ...episode,
    updatedAt: new Date().toISOString(),
  });
  const idx = all.findIndex((e) => e.id === next.id);
  if (idx >= 0) all[idx] = next;
  else all.unshift(next);
  fs.writeFileSync(EPISODES_FILE, JSON.stringify({ episodes: all }, null, 2));
  return next;
}

export function deleteEpisode(id: string): boolean {
  ensureDataDir();
  const all = listEpisodes().filter((e) => e.id !== id);
  fs.writeFileSync(EPISODES_FILE, JSON.stringify({ episodes: all }, null, 2));
  return true;
}

/** Persist Studio prompt edits onto a shot before plate/voice gen (stops wipe). */
export function patchShotPrompts(
  episodeId: string,
  sceneId: string,
  shotId: string,
  opts: {
    global?: string;
    aiNudgeGlobal?: string;
    cutUnder?: string;
    resolveNotes?: string;
    script?: string;
    globalHistory?: SavedText[];
    cutUnderHistory?: SavedText[];
    resolveNotesHistory?: SavedText[];
    scriptHistory?: SavedText[];
    beats?: {
      id: string;
      label?: string;
      speaker?: string;
      platePrompt?: string;
      imageMotion?: string;
      textSegment?: string;
      imageSeconds?: number;
      textSeconds?: number;
      actionSegment?: string;
      actionSeconds?: number;
      gapAfterSeconds?: number;
      aiNudge?: string;
      voiceFile?: string;
      plateFile?: string;
      platePromptHistory?: SavedText[];
      imageMotionHistory?: SavedText[];
      textSegmentHistory?: SavedText[];
      actionSegmentHistory?: SavedText[];
      voiceHistory?: SavedVoice[];
    }[];
  },
): Episode | null {
  const ep = getEpisode(episodeId);
  if (!ep) return null;
  const next: Episode = {
    ...ep,
    scenes: ep.scenes.map((s) => {
      if (s.id !== sceneId) return s;
      return {
        ...s,
        shots: s.shots.map((sh) => {
          if (sh.id !== shotId) return sh;
          const base = ensureShotBeats(sh);
          const existingById = new Map(base.beats.map((b) => [b.id, b]));
          let beats = base.beats;
          // Full list from Studio wins — ADD new beats (Beat 3) + keep plates/voices
          if (opts.beats && opts.beats.length) {
            beats = opts.beats.slice(0, MAX_SHOT_BEATS).map((patch) => {
              const prev = existingById.get(patch.id);
              if (prev) {
                return {
                  ...prev,
                  label: patch.label ?? prev.label,
                  speaker: patch.speaker ?? prev.speaker,
                  platePrompt: patch.platePrompt ?? prev.platePrompt,
                  imageMotion: patch.imageMotion ?? prev.imageMotion,
                  textSegment: patch.textSegment ?? prev.textSegment,
                  imageSeconds: patch.imageSeconds ?? prev.imageSeconds,
                  textSeconds: patch.textSeconds ?? prev.textSeconds,
                  actionSegment: patch.actionSegment ?? prev.actionSegment,
                  actionSeconds: patch.actionSeconds ?? prev.actionSeconds,
                  gapAfterSeconds:
                    patch.gapAfterSeconds ?? prev.gapAfterSeconds,
                  aiNudge: patch.aiNudge ?? prev.aiNudge,
                  voiceFile: patch.voiceFile ?? prev.voiceFile,
                  plateFile: patch.plateFile ?? prev.plateFile,
                  platePromptHistory:
                    patch.platePromptHistory ?? prev.platePromptHistory,
                  imageMotionHistory:
                    patch.imageMotionHistory ?? prev.imageMotionHistory,
                  textSegmentHistory:
                    patch.textSegmentHistory ?? prev.textSegmentHistory,
                  actionSegmentHistory:
                    patch.actionSegmentHistory ?? prev.actionSegmentHistory,
                  voiceHistory: patch.voiceHistory ?? prev.voiceHistory,
                };
              }
              return emptyBeat({
                id: patch.id,
                label: patch.label,
                speaker: patch.speaker,
                platePrompt: patch.platePrompt,
                imageMotion: patch.imageMotion,
                textSegment: patch.textSegment,
                imageSeconds: patch.imageSeconds,
                textSeconds: patch.textSeconds,
                actionSegment: patch.actionSegment,
                actionSeconds: patch.actionSeconds,
                gapAfterSeconds: patch.gapAfterSeconds,
                aiNudge: patch.aiNudge,
                voiceFile: patch.voiceFile,
                plateFile: patch.plateFile,
                platePromptHistory: patch.platePromptHistory,
                imageMotionHistory: patch.imageMotionHistory,
                textSegmentHistory: patch.textSegmentHistory,
                actionSegmentHistory: patch.actionSegmentHistory,
                voiceHistory: patch.voiceHistory,
              });
            });
            while (beats.length < MIN_SHOT_BEATS) {
              beats.push(
                emptyBeat({
                  label: `Beat ${beats.length + 1}`,
                  gapAfterSeconds: 0,
                }),
              );
            }
          }
          return mirrorBeat0({
            ...base,
            global: opts.global !== undefined ? opts.global : base.global,
            aiNudgeGlobal:
              opts.aiNudgeGlobal !== undefined
                ? opts.aiNudgeGlobal
                : base.aiNudgeGlobal,
            cutUnder:
              opts.cutUnder !== undefined ? opts.cutUnder : base.cutUnder,
            resolveNotes:
              opts.resolveNotes !== undefined
                ? opts.resolveNotes
                : base.resolveNotes,
            script: opts.script !== undefined ? opts.script : base.script,
            globalHistory: opts.globalHistory ?? base.globalHistory,
            cutUnderHistory: opts.cutUnderHistory ?? base.cutUnderHistory,
            resolveNotesHistory:
              opts.resolveNotesHistory ?? base.resolveNotesHistory,
            scriptHistory: opts.scriptHistory ?? base.scriptHistory,
            beats,
          });
        }),
      };
    }),
  };
  return saveEpisode(next);
}

export function episodeDataPath(id: string) {
  return path.join(DATA_DIR, `${id}.json`);
}

export function addShotRender(
  episodeId: string,
  sceneId: string,
  shotId: string,
  opts: {
    buffer: Buffer;
    ext: string;
    note?: string;
    /** Keeper = approved, Park = parked (salvage later) */
    status?: ShotRender["status"];
  },
): { episode: Episode; render: ShotRender } | null {
  const ep = getEpisode(episodeId);
  if (!ep) return null;
  const scene = ep.scenes.find((s) => s.id === sceneId);
  const shot = scene?.shots.find((s) => s.id === shotId);
  if (!scene || !shot) return null;

  const dir = episodeRendersDir(episodeId);
  fs.mkdirSync(dir, { recursive: true });

  const n = (shot.renders?.length || 0) + 1;
  const version = `v${n}`;
  const status = opts.status || "pending";
  const render = emptyShotRender({
    id: newId("rend"),
    version,
    note: opts.note || "",
    status,
  });
  const ext = opts.ext.startsWith(".") ? opts.ext : `.${opts.ext}`;
  const fileName = `${shotId}_${render.id}${ext}`;
  const fullPath = path.join(dir, fileName);
  fs.writeFileSync(fullPath, opts.buffer);
  render.fileName = fileName;
  render.durationSeconds = probeDurationSeconds(fullPath);

  const next: Episode = {
    ...ep,
    scenes: ep.scenes.map((s) =>
      s.id !== sceneId
        ? s
        : {
            ...s,
            shots: s.shots.map((sh) =>
              sh.id !== shotId
                ? sh
                : {
                    ...normalizeShot(sh),
                    renders: [...(sh.renders || []), render],
                    approvedRenderId:
                      status === "approved"
                        ? render.id
                        : sh.approvedRenderId || "",
                    done: status === "approved" ? true : sh.done,
                  },
            ),
          },
    ),
  };
  return { episode: saveEpisode(next), render };
}

export function setShotRenderStatus(
  episodeId: string,
  sceneId: string,
  shotId: string,
  renderId: string,
  status: ShotRender["status"],
): Episode | null {
  const ep = getEpisode(episodeId);
  if (!ep) return null;
  const next: Episode = {
    ...ep,
    scenes: ep.scenes.map((s) => {
      if (s.id !== sceneId) return s;
      return {
        ...s,
        shots: s.shots.map((sh) => {
          if (sh.id !== shotId) return sh;
          const renders = (sh.renders || []).map((r) =>
            r.id === renderId ? { ...r, status } : r,
          );
          const keeper =
            status === "approved"
              ? renderId
              : renders.find((r) => r.status === "approved")?.id || "";
          return {
            ...normalizeShot(sh),
            renders,
            approvedRenderId: keeper,
            done: Boolean(keeper),
          };
        }),
      };
    }),
  };
  return saveEpisode(next);
}

export function setShotPlate(
  episodeId: string,
  sceneId: string,
  shotId: string,
  opts: { buffer: Buffer; ext: string; beatId?: string },
): Episode | null {
  const ep = getEpisode(episodeId);
  if (!ep) return null;
  const scene = ep.scenes.find((s) => s.id === sceneId);
  const shot = scene?.shots.find((s) => s.id === shotId);
  if (!scene || !shot) return null;

  const normalized = ensureShotBeats(shot);
  const beatId = opts.beatId || normalized.beats[0]?.id;
  const beat = normalized.beats.find((b) => b.id === beatId) || normalized.beats[0];
  if (!beat) return null;

  const dir = episodePlatesDir(episodeId);
  fs.mkdirSync(dir, { recursive: true });
  const ext = opts.ext.startsWith(".") ? opts.ext : `.${opts.ext}`;
  const fileName =
    normalized.beats.length > 1 || (opts.beatId && opts.beatId !== normalized.beats[0].id)
      ? `${shotId}_${beat.id}_plate${ext}`
      : `${shotId}_plate${ext}`;
  fs.writeFileSync(path.join(dir, fileName), opts.buffer);

  const beats = normalized.beats.map((b) =>
    b.id === beat.id ? { ...b, plateFile: fileName } : b,
  );

  const next: Episode = {
    ...ep,
    scenes: ep.scenes.map((s) =>
      s.id !== sceneId
        ? s
        : {
            ...s,
            shots: s.shots.map((sh) =>
              sh.id !== shotId
                ? sh
                : mirrorBeat0({
                    ...normalizeShot(sh),
                    beats,
                    plate: sh.plate || fileName,
                  }),
            ),
          },
    ),
  };
  return saveEpisode(next);
}

/**
 * Park a Crash Lab morph mp4 on the episode shelf (not on a beat yet).
 */
export function attachCrashMorphToEpisode(opts: {
  episodeId: string;
  runId: string;
  buffer: Buffer;
}): { episode: Episode; entry: CrashMorphEntry } | null {
  const ep = getEpisode(opts.episodeId);
  if (!ep) return null;

  const dir = episodePlatesDir(opts.episodeId);
  fs.mkdirSync(dir, { recursive: true });
  const stamp = Date.now().toString(36);
  const fileName = `crash_morph_${stamp}.mp4`;
  fs.writeFileSync(path.join(dir, fileName), opts.buffer);

  const entry: CrashMorphEntry = {
    id: newId("cmorph"),
    kind: "morph",
    runId: opts.runId,
    fileName,
    sceneId: "",
    shotId: "",
    beatId: "",
    createdAt: new Date().toISOString(),
  };

  const next: Episode = {
    ...ep,
    crashMorphs: [entry, ...(ep.crashMorphs || [])],
  };
  return { episode: saveEpisode(next), entry };
}

/**
 * Park a Crash Lab still (png) on the episode shelf.
 */
export function attachCrashStillToEpisode(opts: {
  episodeId: string;
  buffer: Buffer;
  ext?: string;
  label?: string;
}): { episode: Episode; entry: CrashMorphEntry } | null {
  const ep = getEpisode(opts.episodeId);
  if (!ep) return null;

  const dir = episodePlatesDir(opts.episodeId);
  fs.mkdirSync(dir, { recursive: true });
  const stamp = Date.now().toString(36);
  const ext = (opts.ext || ".png").startsWith(".")
    ? opts.ext || ".png"
    : `.${opts.ext}`;
  const fileName = `crash_still_${stamp}${ext}`;
  fs.writeFileSync(path.join(dir, fileName), opts.buffer);

  const entry: CrashMorphEntry = {
    id: newId("cstill"),
    kind: "still",
    runId: opts.label || "",
    fileName,
    sceneId: "",
    shotId: "",
    beatId: "",
    createdAt: new Date().toISOString(),
  };

  const next: Episode = {
    ...ep,
    crashMorphs: [entry, ...(ep.crashMorphs || [])],
  };
  return { episode: saveEpisode(next), entry };
}

/**
 * Remove a Crash Lab shelf entry (does not delete the plate file on disk).
 */
export function removeCrashLabEntry(opts: {
  episodeId: string;
  entryId: string;
}): Episode | null {
  const ep = getEpisode(opts.episodeId);
  if (!ep) return null;
  const next: Episode = {
    ...ep,
    crashMorphs: (ep.crashMorphs || []).filter((m) => m.id !== opts.entryId),
  };
  return saveEpisode(next);
}

/**
 * Assign a Crash Lab shelf item onto a beat as plateFile.
 */
export function assignCrashLabToBeat(opts: {
  episodeId: string;
  entryId: string;
  sceneId: string;
  shotId: string;
  beatId?: string;
}): Episode | null {
  const ep = getEpisode(opts.episodeId);
  if (!ep) return null;
  const entry = (ep.crashMorphs || []).find((m) => m.id === opts.entryId);
  if (!entry) return null;

  const scene = ep.scenes.find((s) => s.id === opts.sceneId);
  const shot = scene?.shots.find((s) => s.id === opts.shotId);
  if (!scene || !shot) return null;

  const normalized = ensureShotBeats(shot);
  const beatId = opts.beatId || normalized.beats[0]?.id;
  const beat =
    normalized.beats.find((b) => b.id === beatId) || normalized.beats[0];
  if (!beat) return null;

  const beats = normalized.beats.map((b) =>
    b.id === beat.id ? { ...b, plateFile: entry.fileName } : b,
  );

  // Only the entry on this beat stays "On beat". Older stamps on the same beat clear.
  const crashMorphs = (ep.crashMorphs || []).map((m) => {
    if (m.id === entry.id) {
      return {
        ...m,
        sceneId: scene.id,
        shotId: shot.id,
        beatId: beat.id,
      };
    }
    if (m.sceneId === scene.id && m.shotId === shot.id && m.beatId === beat.id) {
      return { ...m, sceneId: "", shotId: "", beatId: "" };
    }
    return m;
  });

  const next: Episode = {
    ...ep,
    crashMorphs,
    scenes: ep.scenes.map((s) =>
      s.id !== scene.id
        ? s
        : {
            ...s,
            shots: s.shots.map((sh) =>
              sh.id !== shot.id
                ? sh
                : mirrorBeat0({
                    ...normalizeShot(sh),
                    beats,
                    plate: entry.fileName,
                  }),
            ),
          },
    ),
  };
  return saveEpisode(next);
}

/**
 * @deprecated use attachCrashMorphToEpisode + assignCrashLabToBeat
 */
export function attachCrashMorph(opts: {
  episodeId: string;
  sceneId: string;
  shotId: string;
  beatId?: string;
  runId: string;
  buffer: Buffer;
}): { episode: Episode; entry: CrashMorphEntry } | null {
  const parked = attachCrashMorphToEpisode({
    episodeId: opts.episodeId,
    runId: opts.runId,
    buffer: opts.buffer,
  });
  if (!parked) return null;
  const ep = assignCrashLabToBeat({
    episodeId: opts.episodeId,
    entryId: parked.entry.id,
    sceneId: opts.sceneId,
    shotId: opts.shotId,
    beatId: opts.beatId,
  });
  if (!ep) return parked;
  const entry = (ep.crashMorphs || []).find((m) => m.id === parked.entry.id)!;
  return { episode: ep, entry };
}

export function setShotVoiceFile(
  episodeId: string,
  sceneId: string,
  shotId: string,
  opts: { buffer: Buffer; ext: string; beatId?: string },
): Episode | null {
  const ep = getEpisode(episodeId);
  if (!ep) return null;
  const scene = ep.scenes.find((s) => s.id === sceneId);
  const shot = scene?.shots.find((s) => s.id === shotId);
  if (!scene || !shot) return null;

  const normalized = ensureShotBeats(shot);
  const beatId = opts.beatId || normalized.beats[0]?.id;
  const beat = normalized.beats.find((b) => b.id === beatId) || normalized.beats[0];
  if (!beat) return null;

  const dir = episodeVoicesDir(episodeId);
  fs.mkdirSync(dir, { recursive: true });
  const ext = opts.ext.startsWith(".") ? opts.ext : `.${opts.ext}`;
  // New filename every rebuild — same path = browser plays stale mp3
  const stamp = Date.now().toString(36);
  const fileName = `${shotId}_${beat.id}_voice_${stamp}${ext}`;
  fs.writeFileSync(path.join(dir, fileName), opts.buffer);

  // Keep previous take in history (Use / Delete in Studio)
  const prev = beat.voiceFile;
  let voiceHistory = [...(beat.voiceHistory || [])];
  if (prev && prev !== fileName) {
    // Show the spoken line, not shot_xxx_voice_yyy.mp3
    const raw = (beat.textSegment || "").trim();
    const spoken = raw
      .replace(/\[[^\]]*\]/g, " ")
      .replace(/["“”]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    const label = spoken
      ? spoken.length > 56
        ? `${spoken.slice(0, 56)}…`
        : spoken
      : prev;
    voiceHistory = [
      {
        id: newId("voc"),
        fileName: prev,
        savedAt: new Date().toISOString(),
        label,
      },
      ...voiceHistory.filter((v) => v.fileName !== prev),
    ].slice(0, 10);
  }

  const beats = normalized.beats.map((b) =>
    b.id === beat.id
      ? { ...b, voiceFile: fileName, voiceHistory }
      : b,
  );

  const next: Episode = {
    ...ep,
    scenes: ep.scenes.map((s) =>
      s.id !== sceneId
        ? s
        : {
            ...s,
            shots: s.shots.map((sh) =>
              sh.id !== shotId
                ? sh
                : mirrorBeat0({
                    ...normalizeShot(sh),
                    beats,
                    voice: sh.voice || fileName,
                  }),
            ),
          },
    ),
  };
  return saveEpisode(next);
}

export function shotPlatePath(
  episodeId: string,
  fileName: string,
): string | null {
  if (
    !fileName ||
    fileName.includes("..") ||
    fileName.includes("/") ||
    fileName.includes("\\")
  )
    return null;
  const p = path.join(episodePlatesDir(episodeId), fileName);
  return fs.existsSync(p) ? p : null;
}

export function shotVoicePath(
  episodeId: string,
  fileName: string,
): string | null {
  if (
    !fileName ||
    fileName.includes("..") ||
    fileName.includes("/") ||
    fileName.includes("\\")
  )
    return null;
  const p = path.join(episodeVoicesDir(episodeId), fileName);
  return fs.existsSync(p) ? p : null;
}
