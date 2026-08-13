import fs from "fs";
import path from "path";
import { DATA_DIR } from "./paths";

export const VOICE_LIBRARY_DIR = path.join(DATA_DIR, "voice-library");
const MANIFEST_PATH = path.join(VOICE_LIBRARY_DIR, "manifest.json");

export type VoiceLibrarySource = "crash" | "character" | "episode";

/** One locked character voice — keeper mp3 is the source of truth. */
export type VoiceLibraryEntry = {
  showId: string;
  characterName: string;
  castKey: string;
  /** Path under voice-library/ */
  keeperRel: string;
  voiceDescription: string;
  approvedAttemptId: string;
  /** ElevenLabs voice_id if still live — optional scratchpad slot */
  approvedVoiceId: string;
  previewText: string;
  source: VoiceLibrarySource;
  approvedAt: string;
};

export function characterSlug(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "") || "character"
  );
}

export function libraryKey(showId: string, characterName: string): string {
  return `${showId}:${characterSlug(characterName)}`;
}

export function keeperDir(showId: string, characterName: string): string {
  return path.join(VOICE_LIBRARY_DIR, showId, characterSlug(characterName));
}

export function keeperAbsPath(showId: string, characterName: string): string {
  return path.join(keeperDir(showId, characterName), "keeper.mp3");
}

function ensureVoiceLibraryDir(): void {
  if (!fs.existsSync(VOICE_LIBRARY_DIR)) {
    fs.mkdirSync(VOICE_LIBRARY_DIR, { recursive: true });
  }
}

export function readVoiceLibrary(): Record<string, VoiceLibraryEntry> {
  if (!fs.existsSync(MANIFEST_PATH)) return {};
  try {
    const raw = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8")) as Record<
      string,
      VoiceLibraryEntry
    >;
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

function writeVoiceLibrary(manifest: Record<string, VoiceLibraryEntry>): void {
  ensureVoiceLibraryDir();
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}

export function getVoiceLibraryEntry(
  showId: string,
  characterName: string,
): VoiceLibraryEntry | null {
  return readVoiceLibrary()[libraryKey(showId, characterName)] ?? null;
}

export function resolveKeeperFile(entry: VoiceLibraryEntry): string | null {
  if (!entry.keeperRel || entry.keeperRel.includes("..")) return null;
  const abs = path.join(VOICE_LIBRARY_DIR, entry.keeperRel);
  return fs.existsSync(abs) ? abs : null;
}

/** Copy source mp3 into voice-library — never deletes the source file. */
export function saveVoiceKeeper(opts: {
  showId: string;
  characterName: string;
  castKey: string;
  voiceDescription: string;
  approvedAttemptId: string;
  approvedVoiceId?: string;
  previewText?: string;
  sourceMp3: string;
  source?: VoiceLibrarySource;
}): VoiceLibraryEntry {
  if (!fs.existsSync(opts.sourceMp3)) {
    throw new Error("Keeper source mp3 missing — gen voice again first");
  }

  const dest = keeperAbsPath(opts.showId, opts.characterName);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(opts.sourceMp3, dest);

  const key = libraryKey(opts.showId, opts.characterName);
  const entry: VoiceLibraryEntry = {
    showId: opts.showId,
    characterName: opts.characterName,
    castKey: opts.castKey,
    keeperRel: path.relative(VOICE_LIBRARY_DIR, dest).replace(/\\/g, "/"),
    voiceDescription: opts.voiceDescription,
    approvedAttemptId: opts.approvedAttemptId,
    approvedVoiceId: opts.approvedVoiceId || "",
    previewText: opts.previewText || "",
    source: opts.source || "crash",
    approvedAt: new Date().toISOString(),
  };

  const manifest = readVoiceLibrary();
  manifest[key] = entry;
  writeVoiceLibrary(manifest);
  return entry;
}

/** Update ElevenLabs voice_id only — never touches keeper mp3. */
export function patchVoiceLibraryApprovedId(
  showId: string,
  characterName: string,
  approvedVoiceId: string,
): void {
  const key = libraryKey(showId, characterName);
  const manifest = readVoiceLibrary();
  const entry = manifest[key];
  if (!entry) return;
  entry.approvedVoiceId = approvedVoiceId.trim();
  manifest[key] = entry;
  writeVoiceLibrary(manifest);
}

/** Upsert library row for a pasted / external voice_id — never deletes keeper mp3. */
export function upsertVoiceLibraryApprovedId(opts: {
  showId: string;
  characterName: string;
  castKey: string;
  approvedVoiceId: string;
  approvedAttemptId?: string;
  voiceDescription?: string;
  previewText?: string;
}): VoiceLibraryEntry {
  const key = libraryKey(opts.showId, opts.characterName);
  const manifest = readVoiceLibrary();
  const prev = manifest[key];
  const entry: VoiceLibraryEntry = {
    showId: opts.showId,
    characterName: opts.characterName,
    castKey: opts.castKey,
    keeperRel: prev?.keeperRel || "",
    voiceDescription:
      opts.voiceDescription?.trim() ||
      prev?.voiceDescription ||
      opts.characterName,
    approvedAttemptId:
      opts.approvedAttemptId?.trim() || prev?.approvedAttemptId || "",
    approvedVoiceId: opts.approvedVoiceId.trim(),
    previewText: opts.previewText?.trim() || prev?.previewText || "",
    source: prev?.source || "crash",
    approvedAt: prev?.approvedAt || new Date().toISOString(),
  };
  manifest[key] = entry;
  writeVoiceLibrary(manifest);
  return entry;
}
