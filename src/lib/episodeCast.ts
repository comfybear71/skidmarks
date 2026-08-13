import fs from "fs";
import path from "path";
import { DATA_DIR } from "./paths";
import { retireFile } from "./retire";
import { getEpisode, listEpisodes, saveEpisode } from "./store";
import type {
  AttemptStatus,
  Episode,
  EpisodeCastMember,
  FaceAttempt,
  FaceReference,
  VoiceAttempt,
} from "./types";
import {
  emptyCastMember,
  emptyFaceAttempt,
  emptyVoiceAttempt,
  newId,
} from "./types";

function castRoot(episodeId: string, castId: string) {
  return path.join(DATA_DIR, "episodes", episodeId, "cast", castId);
}
function facesDir(episodeId: string, castId: string) {
  return path.join(castRoot(episodeId, castId), "faces");
}
function facesParkedDir(episodeId: string, castId: string) {
  return path.join(castRoot(episodeId, castId), "parked");
}
function voicesDir(episodeId: string, castId: string) {
  return path.join(castRoot(episodeId, castId), "voices");
}
function refsDir(episodeId: string, castId: string) {
  return path.join(castRoot(episodeId, castId), "refs");
}

function copyFaceToParked(
  episodeId: string,
  castId: string,
  fileName: string,
) {
  if (!fileName) return;
  const src = path.join(facesDir(episodeId, castId), fileName);
  if (!fs.existsSync(src)) return;
  const dir = facesParkedDir(episodeId, castId);
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, fileName);
  if (!fs.existsSync(dest)) fs.copyFileSync(src, dest);
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

function withCast(
  episodeId: string,
  castId: string,
  fn: (m: EpisodeCastMember, ep: Episode) => EpisodeCastMember,
): Episode | null {
  const ep = getEpisode(episodeId);
  if (!ep) return null;
  const idx = (ep.cast || []).findIndex((c) => c.id === castId);
  if (idx < 0) return null;
  const nextCast = [...ep.cast];
  nextCast[idx] = normalizeCast({
    ...fn(normalizeCast(nextCast[idx]), ep),
    updatedAt: new Date().toISOString(),
  });
  return saveEpisode({ ...ep, cast: nextCast });
}

export function getCastMember(
  episodeId: string,
  castId: string,
): EpisodeCastMember | null {
  const ep = getEpisode(episodeId);
  if (!ep) return null;
  const m = (ep.cast || []).find((c) => c.id === castId);
  return m ? normalizeCast(m) : null;
}

export function addCastMember(
  episodeId: string,
  partial?: Partial<EpisodeCastMember>,
): Episode | null {
  const ep = getEpisode(episodeId);
  if (!ep) return null;
  const m = emptyCastMember(partial);
  fs.mkdirSync(facesDir(episodeId, m.id), { recursive: true });
  fs.mkdirSync(voicesDir(episodeId, m.id), { recursive: true });
  return saveEpisode({
    ...ep,
    cast: [...(ep.cast || []), m],
  });
}

export function updateCastMember(
  episodeId: string,
  castId: string,
  patch: Partial<EpisodeCastMember>,
): Episode | null {
  return withCast(episodeId, castId, (m) => ({ ...m, ...patch, id: m.id }));
}

export function castFacePath(
  episodeId: string,
  castId: string,
  fileName: string,
): string | null {
  if (
    !fileName ||
    fileName.includes("..") ||
    fileName.includes("/") ||
    fileName.includes("\\")
  )
    return null;
  const primary = path.join(facesDir(episodeId, castId), fileName);
  if (fs.existsSync(primary)) return primary;
  const parked = path.join(facesParkedDir(episodeId, castId), fileName);
  return fs.existsSync(parked) ? parked : null;
}

export function castVoicePath(
  episodeId: string,
  castId: string,
  fileName: string,
): string | null {
  if (
    !fileName ||
    fileName.includes("..") ||
    fileName.includes("/") ||
    fileName.includes("\\")
  )
    return null;
  const p = path.join(voicesDir(episodeId, castId), fileName);
  return fs.existsSync(p) ? p : null;
}

export function castRefPath(
  episodeId: string,
  castId: string,
  fileName: string,
): string | null {
  if (
    !fileName ||
    fileName.includes("..") ||
    fileName.includes("/") ||
    fileName.includes("\\")
  )
    return null;
  const p = path.join(refsDir(episodeId, castId), fileName);
  return fs.existsSync(p) ? p : null;
}

export function addCastReference(
  episodeId: string,
  castId: string,
  opts: { buffer: Buffer; ext?: string; label?: string },
): { episode: Episode; reference: FaceReference } | null {
  const m = getCastMember(episodeId, castId);
  if (!m) return null;
  const id = newId("ref");
  const ext = opts.ext || ".png";
  const fileName = `${id}${ext.startsWith(".") ? ext : `.${ext}`}`;
  const dir = refsDir(episodeId, castId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, fileName), opts.buffer);
  const reference: FaceReference = {
    id,
    fileName,
    label: opts.label?.trim() || fileName,
    createdAt: new Date().toISOString(),
  };
  const episode = withCast(episodeId, castId, (cur) => ({
    ...cur,
    references: [reference, ...cur.references],
  }));
  if (!episode) return null;
  return { episode, reference };
}

export function deleteCastReference(
  episodeId: string,
  castId: string,
  refId: string,
): Episode | null {
  const m = getCastMember(episodeId, castId);
  if (!m) return null;
  const ref = m.references.find((r) => r.id === refId);
  if (ref) retireFile(path.join(refsDir(episodeId, castId), ref.fileName));
  return withCast(episodeId, castId, (cur) => ({
    ...cur,
    references: cur.references.filter((r) => r.id !== refId),
  }));
}

export function addCastFace(
  episodeId: string,
  castId: string,
  opts: {
    note?: string;
    buffer?: Buffer;
    ext?: string;
    styleRealism?: number;
    source?: FaceAttempt["source"];
  },
): { episode: Episode; attempt: FaceAttempt } | null {
  const m = getCastMember(episodeId, castId);
  if (!m) return null;
  const attempt = emptyFaceAttempt({
    note: opts.note?.trim() || "",
    styleRealism: opts.styleRealism ?? 60,
    source: opts.source || (opts.buffer ? "upload" : "generated"),
  });
  const dir = facesDir(episodeId, castId);
  fs.mkdirSync(dir, { recursive: true });
  if (opts.buffer?.length) {
    const ext = opts.ext || ".png";
    attempt.fileName = `${attempt.id}${ext.startsWith(".") ? ext : `.${ext}`}`;
    fs.writeFileSync(path.join(dir, attempt.fileName), opts.buffer);
  }
  const episode = withCast(episodeId, castId, (cur) => ({
    ...cur,
    faceAttempts: [attempt, ...cur.faceAttempts],
  }));
  if (!episode) return null;
  return { episode, attempt };
}

export function setCastFaceStatus(
  episodeId: string,
  castId: string,
  attemptId: string,
  status: AttemptStatus,
  reason = "",
): Episode | null {
  return withCast(episodeId, castId, (m) => {
    const faceAttempts = m.faceAttempts.map((a) => {
      if (a.id !== attemptId) {
        if (status === "approved" && a.status === "approved") {
          if (a.fileName) copyFaceToParked(episodeId, castId, a.fileName);
          return {
            ...a,
            status: "parked" as const,
            reason: a.reason || "Parked — superseded by new lock",
          };
        }
        return a;
      }
      if (status === "parked" && a.fileName) {
        copyFaceToParked(episodeId, castId, a.fileName);
      }
      return {
        ...a,
        status,
        reason:
          status === "rejected" || status === "parked" ? reason || a.reason : "",
      };
    });
    let approvedFaceId = m.approvedFaceId;
    if (status === "approved") approvedFaceId = attemptId;
    else if (approvedFaceId === attemptId) {
      approvedFaceId =
        faceAttempts.find((a) => a.status === "approved")?.id || "";
    }
    return { ...m, faceAttempts, approvedFaceId };
  });
}

/** User-only remove — take leaves the UI, image files move to retired. */
export function deleteCastFace(
  episodeId: string,
  castId: string,
  attemptId: string,
): Episode | null {
  const m = getCastMember(episodeId, castId);
  if (!m) return null;
  const gone = m.faceAttempts.find((a) => a.id === attemptId);
  if (!gone) return getEpisode(episodeId);
  if (gone.fileName) {
    for (const dir of [
      facesDir(episodeId, castId),
      facesParkedDir(episodeId, castId),
    ]) {
      retireFile(path.join(dir, gone.fileName));
    }
  }
  return withCast(episodeId, castId, (cur) => {
    const faceAttempts = cur.faceAttempts.filter((a) => a.id !== attemptId);
    return {
      ...cur,
      faceAttempts,
      approvedFaceId:
        cur.approvedFaceId === attemptId
          ? faceAttempts.find((a) => a.status === "approved")?.id || ""
          : cur.approvedFaceId,
    };
  });
}

export function addCastVoiceAttempts(
  episodeId: string,
  castId: string,
  rows: Array<{
    description: string;
    previewText: string;
    generatedVoiceId: string;
    audioBase64: string;
  }>,
): Episode | null {
  const m = getCastMember(episodeId, castId);
  if (!m) return null;
  const dir = voicesDir(episodeId, castId);
  fs.mkdirSync(dir, { recursive: true });
  const attempts: VoiceAttempt[] = rows.map((row) => {
    const attempt = emptyVoiceAttempt({
      description: row.description,
      previewText: row.previewText,
      generatedVoiceId: row.generatedVoiceId,
    });
    attempt.fileName = `${attempt.id}.mp3`;
    fs.writeFileSync(
      path.join(dir, attempt.fileName),
      Buffer.from(row.audioBase64, "base64"),
    );
    return attempt;
  });
  return withCast(episodeId, castId, (cur) => ({
    ...cur,
    voiceAttempts: [...attempts, ...cur.voiceAttempts],
  }));
}

/** User-only remove — take leaves the UI, mp3 moves to retired. */
export function deleteCastVoiceAttempt(
  episodeId: string,
  castId: string,
  attemptId: string,
): Episode | null {
  const m = getCastMember(episodeId, castId);
  if (!m) return null;
  const gone = m.voiceAttempts.find((a) => a.id === attemptId);
  if (!gone) return getEpisode(episodeId);
  if (gone.fileName) {
    retireFile(path.join(voicesDir(episodeId, castId), gone.fileName));
  }
  return withCast(episodeId, castId, (cur) => {
    const voiceAttempts = cur.voiceAttempts.filter((a) => a.id !== attemptId);
    let approvedVoiceAttemptId = cur.approvedVoiceAttemptId;
    let approvedVoiceId = cur.approvedVoiceId;
    if (approvedVoiceAttemptId === attemptId) {
      const still = voiceAttempts.find((a) => a.status === "approved");
      approvedVoiceAttemptId = still?.id || "";
      approvedVoiceId = still?.voiceId || "";
    }
    return {
      ...cur,
      voiceAttempts,
      approvedVoiceAttemptId,
      approvedVoiceId,
    };
  });
}

/**
 * Is this ElevenLabs voice still the keeper for anybody — any cast member in
 * any episode, or any Character Lab character? Character Lab locks (DAP,
 * Darryl) must never be swept up by episode cast tidy-up.
 */
export function voiceIdStillInUse(
  voiceId: string,
  ignore?: { episodeId: string; castId: string },
): boolean {
  if (!voiceId) return true;
  for (const ep of listEpisodes()) {
    for (const m of ep.cast || []) {
      const isSelf =
        ignore && ep.id === ignore.episodeId && m.id === ignore.castId;
      if (isSelf) continue;
      if (m.approvedVoiceId === voiceId) return true;
    }
  }
  try {
    const raw = JSON.parse(
      fs.readFileSync(path.join(DATA_DIR, "characters.json"), "utf8"),
    ) as { characters?: Array<{ approvedVoiceId?: string }> };
    for (const c of raw.characters || []) {
      if (c.approvedVoiceId === voiceId) return true;
    }
  } catch {
    // If we cannot read it, assume in use — never delete on a guess
    return true;
  }
  return false;
}

export function setCastVoiceStatus(
  episodeId: string,
  castId: string,
  attemptId: string,
  status: AttemptStatus,
  reason = "",
  voiceId = "",
): Episode | null {
  return withCast(episodeId, castId, (m) => {
    const voiceAttempts = m.voiceAttempts.map((a) => {
      if (a.id !== attemptId) {
        if (status === "approved" && a.status === "approved") {
          return {
            ...a,
            status: "rejected" as const,
            reason: a.reason || "Superseded",
          };
        }
        return a;
      }
      return {
        ...a,
        status,
        reason: status === "rejected" ? reason : "",
        voiceId: status === "approved" ? voiceId || a.voiceId : a.voiceId,
      };
    });
    let approvedVoiceAttemptId = m.approvedVoiceAttemptId;
    let approvedVoiceId = m.approvedVoiceId;
    if (status === "approved") {
      approvedVoiceAttemptId = attemptId;
      const kept = voiceAttempts.find((a) => a.id === attemptId);
      // Must take THIS take's voiceId — never leave the old keeper stuck
      approvedVoiceId =
        voiceId || kept?.voiceId || m.approvedVoiceId;
    } else if (approvedVoiceAttemptId === attemptId) {
      const still = voiceAttempts.find((a) => a.status === "approved");
      approvedVoiceAttemptId = still?.id || "";
      approvedVoiceId = still?.voiceId || "";
    }
    return {
      ...m,
      voiceAttempts,
      approvedVoiceAttemptId,
      approvedVoiceId,
    };
  });
}

export function seedCastIfEmpty(
  episodeId: string,
  members: Array<Partial<EpisodeCastMember>>,
): Episode | null {
  const ep = getEpisode(episodeId);
  if (!ep) return null;
  if ((ep.cast || []).length > 0) return ep;
  const cast = members.map((partial) => emptyCastMember(partial));
  for (const m of cast) {
    fs.mkdirSync(facesDir(episodeId, m.id), { recursive: true });
    fs.mkdirSync(voicesDir(episodeId, m.id), { recursive: true });
  }
  return saveEpisode({ ...ep, cast });
}

/** Ensure ids unique when seeding with fixed content via script */
export function ensureCastId(): string {
  return newId("cast");
}
