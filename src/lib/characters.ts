import fs from "fs";
import path from "path";
import { CHARACTERS_DIR, CHARACTERS_FILE, DATA_DIR } from "./paths";
import { retireDir, retireFile } from "./retire";
import type {
  Character,
  CharacterScript,
  FaceAttempt,
  FaceReference,
  VoiceAttempt,
} from "./types";
import {
  emptyCharacter,
  emptyFaceAttempt,
  emptyVoiceAttempt,
  newId,
} from "./types";

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(CHARACTERS_DIR))
    fs.mkdirSync(CHARACTERS_DIR, { recursive: true });
  if (!fs.existsSync(CHARACTERS_FILE)) {
    fs.writeFileSync(
      CHARACTERS_FILE,
      JSON.stringify({ characters: [] }, null, 2),
    );
  }
}

function charFacesDir(id: string) {
  return path.join(CHARACTERS_DIR, id, "faces");
}

function charRefsDir(id: string) {
  return path.join(CHARACTERS_DIR, id, "refs");
}

function charVoicesDir(id: string) {
  return path.join(CHARACTERS_DIR, id, "voices");
}

function normalize(c: Character): Character {
  return {
    ...c,
    lookNote: c.lookNote || "",
    references: c.references || [],
    faceAttempts: (c.faceAttempts || []).map((a) => ({
      ...a,
      styleRealism: a.styleRealism ?? 60,
      source: a.source || (a.fileName ? "upload" : "text"),
    })),
    voiceDescription: c.voiceDescription || "",
    voiceAttempts: c.voiceAttempts || [],
    approvedVoiceAttemptId: c.approvedVoiceAttemptId || "",
    approvedVoiceId: c.approvedVoiceId || "",
    scripts: c.scripts || [],
  };
}

export function listCharacters(): Character[] {
  ensure();
  const raw = JSON.parse(fs.readFileSync(CHARACTERS_FILE, "utf8")) as {
    characters: Character[];
  };
  return (raw.characters || [])
    .map(normalize)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getCharacter(id: string): Character | null {
  return listCharacters().find((c) => c.id === id) ?? null;
}

export function saveCharacter(character: Character): Character {
  ensure();
  const all = listCharacters();
  const next = normalize({
    ...character,
    updatedAt: new Date().toISOString(),
  });
  const idx = all.findIndex((c) => c.id === next.id);
  if (idx >= 0) all[idx] = next;
  else all.unshift(next);
  fs.writeFileSync(
    CHARACTERS_FILE,
    JSON.stringify({ characters: all }, null, 2),
  );
  return next;
}

export function deleteCharacter(id: string): boolean {
  ensure();
  const all = listCharacters().filter((c) => c.id !== id);
  fs.writeFileSync(
    CHARACTERS_FILE,
    JSON.stringify({ characters: all }, null, 2),
  );
  retireDir(path.join(CHARACTERS_DIR, id));
  return true;
}

export function createCharacter(partial?: Partial<Character>): Character {
  const c = emptyCharacter(partial);
  fs.mkdirSync(charFacesDir(c.id), { recursive: true });
  fs.mkdirSync(charRefsDir(c.id), { recursive: true });
  fs.mkdirSync(charVoicesDir(c.id), { recursive: true });
  return saveCharacter(c);
}

export function addReference(
  characterId: string,
  opts: { buffer: Buffer; ext?: string; label?: string },
): { character: Character; reference: FaceReference } | null {
  const c = getCharacter(characterId);
  if (!c) return null;
  const id = newId("ref");
  const ext = opts.ext || ".png";
  const fileName = `${id}${ext.startsWith(".") ? ext : `.${ext}`}`;
  const dir = charRefsDir(characterId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, fileName), opts.buffer);
  const reference: FaceReference = {
    id,
    fileName,
    label: opts.label?.trim() || fileName,
    createdAt: new Date().toISOString(),
  };
  c.references = [reference, ...c.references];
  return { character: saveCharacter(c), reference };
}

export function deleteReference(
  characterId: string,
  referenceId: string,
): Character | null {
  const c = getCharacter(characterId);
  if (!c) return null;
  const ref = c.references.find((r) => r.id === referenceId);
  if (ref) retireFile(path.join(charRefsDir(characterId), ref.fileName));
  c.references = c.references.filter((r) => r.id !== referenceId);
  return saveCharacter(c);
}

export function referenceFilePath(
  characterId: string,
  fileName: string,
): string | null {
  if (
    !fileName ||
    fileName.includes("..") ||
    fileName.includes("/") ||
    fileName.includes("\\")
  )
    return null;
  const p = path.join(charRefsDir(characterId), fileName);
  if (!fs.existsSync(p)) return null;
  return p;
}

export function addFaceAttempt(
  characterId: string,
  opts: {
    note?: string;
    buffer?: Buffer;
    ext?: string;
    styleRealism?: number;
    source?: FaceAttempt["source"];
  },
): { character: Character; attempt: FaceAttempt } | null {
  const c = getCharacter(characterId);
  if (!c) return null;
  const style = Math.max(
    0,
    Math.min(100, Number(opts.styleRealism ?? 60) || 60),
  );
  const attempt = emptyFaceAttempt({
    id: newId("face"),
    note: opts.note?.trim() || "",
    styleRealism: style,
    source:
      opts.source ||
      (opts.buffer ? "upload" : "text"),
  });
  const dir = charFacesDir(characterId);
  fs.mkdirSync(dir, { recursive: true });
  if (opts.buffer && opts.buffer.length > 0) {
    const ext = opts.ext || ".png";
    attempt.fileName = `${attempt.id}${ext.startsWith(".") ? ext : `.${ext}`}`;
    fs.writeFileSync(path.join(dir, attempt.fileName), opts.buffer);
  }
  c.faceAttempts = [attempt, ...c.faceAttempts];
  return { character: saveCharacter(c), attempt };
}

export function setAttemptStatus(
  characterId: string,
  attemptId: string,
  status: FaceAttempt["status"],
  reason = "",
): Character | null {
  const c = getCharacter(characterId);
  if (!c) return null;
  c.faceAttempts = c.faceAttempts.map((a) => {
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
    };
  });
  if (status === "approved") {
    c.approvedFaceId = attemptId;
    c.approved = true;
  } else if (c.approvedFaceId === attemptId) {
    c.approvedFaceId = "";
    c.approved = c.faceAttempts.some((a) => a.status === "approved");
    if (c.approved) {
      const still = c.faceAttempts.find((a) => a.status === "approved");
      c.approvedFaceId = still?.id || "";
    }
  }
  return saveCharacter(c);
}

export function faceFilePath(
  characterId: string,
  fileName: string,
): string | null {
  if (
    !fileName ||
    fileName.includes("..") ||
    fileName.includes("/") ||
    fileName.includes("\\")
  )
    return null;
  const p = path.join(charFacesDir(characterId), fileName);
  if (!fs.existsSync(p)) return null;
  return p;
}

function unlinkFace(characterId: string, fileName: string) {
  retireFile(faceFilePath(characterId, fileName));
}

/** Delete one attempt (and its image file). */
export function deleteAttempt(
  characterId: string,
  attemptId: string,
): Character | null {
  const c = getCharacter(characterId);
  if (!c) return null;
  const gone = c.faceAttempts.find((a) => a.id === attemptId);
  if (!gone) return c;
  if (gone.fileName) unlinkFace(characterId, gone.fileName);
  c.faceAttempts = c.faceAttempts.filter((a) => a.id !== attemptId);
  if (c.approvedFaceId === attemptId) {
    c.approvedFaceId = "";
    c.approved = false;
  }
  return saveCharacter(c);
}

/** Wipe every rejected attempt (keeps pending + approved). */
export function clearRejectedAttempts(characterId: string): Character | null {
  const c = getCharacter(characterId);
  if (!c) return null;
  for (const a of c.faceAttempts) {
    if (a.status === "rejected" && a.fileName) unlinkFace(characterId, a.fileName);
  }
  c.faceAttempts = c.faceAttempts.filter((a) => a.status !== "rejected");
  return saveCharacter(c);
}

function unlinkVoice(characterId: string, fileName: string) {
  if (
    !fileName ||
    fileName.includes("..") ||
    fileName.includes("/") ||
    fileName.includes("\\")
  )
    return;
  retireFile(path.join(charVoicesDir(characterId), fileName));
}

export function voiceFilePath(
  characterId: string,
  fileName: string,
): string | null {
  if (
    !fileName ||
    fileName.includes("..") ||
    fileName.includes("/") ||
    fileName.includes("\\")
  )
    return null;
  const p = path.join(charVoicesDir(characterId), fileName);
  if (!fs.existsSync(p)) return null;
  return p;
}

export function addVoiceAttempts(
  characterId: string,
  previews: {
    generatedVoiceId: string;
    audioBase64: string;
    previewText: string;
    description: string;
  }[],
): Character | null {
  const c = getCharacter(characterId);
  if (!c) return null;
  const dir = charVoicesDir(characterId);
  fs.mkdirSync(dir, { recursive: true });
  const added: VoiceAttempt[] = [];
  for (const p of previews) {
    const attempt = emptyVoiceAttempt({
      description: p.description,
      previewText: p.previewText,
      generatedVoiceId: p.generatedVoiceId,
      status: "pending",
    });
    attempt.fileName = `${attempt.id}.mp3`;
    fs.writeFileSync(
      path.join(dir, attempt.fileName),
      Buffer.from(p.audioBase64, "base64"),
    );
    added.push(attempt);
  }
  c.voiceAttempts = [...added, ...c.voiceAttempts];
  return saveCharacter(c);
}

/**
 * Approve / reject a voice. Multiple voices can stay Approved —
 * the latest Approve becomes the primary (used for lines by default).
 */
export function setVoiceAttemptStatus(
  characterId: string,
  attemptId: string,
  status: VoiceAttempt["status"],
  reason = "",
  libraryVoiceId = "",
): Character | null {
  const c = getCharacter(characterId);
  if (!c) return null;
  c.voiceAttempts = c.voiceAttempts.map((a) => {
    if (a.id !== attemptId) return a;
    return {
      ...a,
      status,
      reason: status === "rejected" ? reason : "",
      voiceId: status === "approved" ? libraryVoiceId || a.voiceId : a.voiceId,
    };
  });
  if (status === "approved") {
    c.approvedVoiceAttemptId = attemptId;
    c.approvedVoiceId = libraryVoiceId || c.approvedVoiceId;
  } else if (c.approvedVoiceAttemptId === attemptId) {
    const other = c.voiceAttempts.find(
      (a) => a.id !== attemptId && a.status === "approved" && a.voiceId,
    );
    c.approvedVoiceAttemptId = other?.id || "";
    c.approvedVoiceId = other?.voiceId || "";
  }
  return saveCharacter(c);
}

/** Point primary at an already-approved voice (keeps the others approved). */
export function setPrimaryVoice(
  characterId: string,
  attemptId: string,
): Character | null {
  const c = getCharacter(characterId);
  if (!c) return null;
  const a = c.voiceAttempts.find((v) => v.id === attemptId);
  if (!a || a.status !== "approved" || !a.voiceId) return c;
  c.approvedVoiceAttemptId = attemptId;
  c.approvedVoiceId = a.voiceId;
  return saveCharacter(c);
}

export function deleteVoiceAttempt(
  characterId: string,
  attemptId: string,
): Character | null {
  const c = getCharacter(characterId);
  if (!c) return null;
  const gone = c.voiceAttempts.find((a) => a.id === attemptId);
  if (!gone) return c;
  if (gone.fileName) unlinkVoice(characterId, gone.fileName);
  c.voiceAttempts = c.voiceAttempts.filter((a) => a.id !== attemptId);
  if (c.approvedVoiceAttemptId === attemptId) {
    c.approvedVoiceAttemptId = "";
    c.approvedVoiceId = "";
  }
  return saveCharacter(c);
}

/** Pin a script draft (usually the output of the Episode Template) to this character. */
export function addScript(
  characterId: string,
  opts: { title?: string; body: string },
): { character: Character; script: CharacterScript } | null {
  const c = getCharacter(characterId);
  if (!c) return null;
  const script: CharacterScript = {
    id: newId("script"),
    title: opts.title?.trim() || "Untitled",
    body: opts.body,
    createdAt: new Date().toISOString(),
  };
  c.scripts = [script, ...c.scripts];
  return { character: saveCharacter(c), script };
}

export function deleteScript(
  characterId: string,
  scriptId: string,
): Character | null {
  const c = getCharacter(characterId);
  if (!c) return null;
  c.scripts = c.scripts.filter((s) => s.id !== scriptId);
  return saveCharacter(c);
}

export function clearRejectedVoices(characterId: string): Character | null {
  const c = getCharacter(characterId);
  if (!c) return null;
  for (const a of c.voiceAttempts) {
    if (a.status === "rejected" && a.fileName)
      unlinkVoice(characterId, a.fileName);
  }
  c.voiceAttempts = c.voiceAttempts.filter((a) => a.status !== "rejected");
  return saveCharacter(c);
}
