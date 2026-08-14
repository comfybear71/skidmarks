import fs from "fs";
import path from "path";
import { CRASH_DIR } from "./paths";
import {
  designVoicePreviews,
  elevenKeyPresent,
  createLibraryVoice,
  listLibraryVoices,
  deleteLibraryVoice,
  synthesizeSpeech,
  VOICE_CLONE_SAMPLE_SCRIPT,
} from "./elevenLabs";
import type { ShowStyleId } from "./showStylePresets";
import { getShowStylePreset, SHOW_STYLE_PRESETS } from "./showStylePresets";
import {
  defaultCrashVoicePrompt,
  sanitizeVoiceDescriptionForApi,
} from "./crashVoicePrompt";
import { readStyleCardManifest } from "./styleCardThumbs";

/** Story speaker → locked voice cast name (per show). */
const SPEAKER_VOICE_ALIASES: Partial<
  Record<ShowStyleId, Record<string, string>>
> = {
  sunny_banks: {
    bazza: "Ranger Bazza",
    "ranger baz": "Ranger Bazza",
    "unit 4s": "The Unit 4s",
    "unit4s": "The Unit 4s",
    "the unit 4's": "The Unit 4s",
  },
};

function normalizeSpeakerName(speaker: string): string {
  return speaker.trim().toLowerCase().replace(/\s+/g, " ");
}

function speakerCastNames(styleId: ShowStyleId, speaker: string): string[] {
  const n = normalizeSpeakerName(speaker);
  if (!n) return [];
  const aliases = SPEAKER_VOICE_ALIASES[styleId];
  const primary = aliases?.[n] ?? speaker.trim();
  const out = [primary];
  if (aliases?.[n] && aliases[n] !== speaker.trim()) out.push(speaker.trim());
  return [...new Set(out.map((s) => s.trim()).filter(Boolean))];
}

function voiceNamesMatch(speaker: string, castName: string): boolean {
  const n = normalizeSpeakerName(speaker);
  const cn = normalizeSpeakerName(castName);
  if (!n || !cn) return false;
  if (n === cn) return true;
  if (cn.endsWith(` ${n}`) || cn.startsWith(`${n} `)) return true;
  if (n.endsWith(` ${cn}`) || n.startsWith(`${cn} `)) return true;
  if (n.length >= 4 && cn.includes(n)) return true;
  if (cn.length >= 4 && n.includes(cn)) return true;
  return false;
}
import { emptyVoiceAttempt, newId, type VoiceAttempt } from "./types";
import {
  getVoiceLibraryEntry,
  libraryKey,
  patchVoiceLibraryApprovedId,
  readVoiceLibrary,
  resolveKeeperFile,
  saveVoiceKeeper,
  upsertVoiceLibraryApprovedId,
} from "./voiceLibrary";

export type CrashVoiceSlot = {
  castKey: string;
  castName: string;
  voiceDescription: string;
  approvedAttemptId: string;
  approvedVoiceId: string;
  /** Local keeper saved under data/voice-library/ */
  keeperSaved?: boolean;
  keeperKey?: string;
  attempts: VoiceAttempt[];
};

function voiceRoot(styleId: ShowStyleId): string {
  return path.join(CRASH_DIR, "voice", styleId);
}

function manifestPath(styleId: ShowStyleId): string {
  return path.join(voiceRoot(styleId), "manifest.json");
}

function slotDir(styleId: ShowStyleId, castKey: string): string {
  const safe = castKey.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80);
  return path.join(voiceRoot(styleId), safe);
}

function ensureVoiceDirs(styleId: ShowStyleId): void {
  const root = voiceRoot(styleId);
  if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true });
}

export function readCrashVoiceManifest(
  styleId: ShowStyleId,
): Record<string, CrashVoiceSlot> {
  return syncCrashVoiceKeepers(styleId);
}

/** Backfill local keepers for already-approved cast (no new ElevenLabs slots). */
export function syncCrashVoiceKeepers(
  styleId: ShowStyleId,
): Record<string, CrashVoiceSlot> {
  const p = manifestPath(styleId);
  if (!fs.existsSync(p)) return {};
  let manifest: Record<string, CrashVoiceSlot>;
  try {
    manifest = JSON.parse(fs.readFileSync(p, "utf8")) as Record<
      string,
      CrashVoiceSlot
    >;
    if (!manifest || typeof manifest !== "object") return {};
  } catch {
    return {};
  }

  const library = readVoiceLibrary();
  let changed = false;

  for (const [castKey, slot] of Object.entries(manifest)) {
    if (!slot.approvedAttemptId) continue;

    const key = libraryKey(styleId, slot.castName);
    const libEntry = library[key];
    const keeperFile = libEntry ? resolveKeeperFile(libEntry) : null;

    if (keeperFile) {
      if (!slot.keeperSaved || slot.keeperKey !== key) {
        slot.keeperSaved = true;
        slot.keeperKey = key;
        changed = true;
      }
      continue;
    }

    // Library row without an mp3 is not a keeper — never pretend play works
    if (slot.keeperSaved) {
      slot.keeperSaved = false;
      changed = true;
    }

    const attempt = slot.attempts.find((a) => a.id === slot.approvedAttemptId);
    if (!attempt?.fileName) continue;

    const src = path.join(slotDir(styleId, castKey), attempt.fileName);
    if (!fs.existsSync(src)) continue;

    try {
      saveVoiceKeeper({
        showId: styleId,
        characterName: slot.castName,
        castKey,
        voiceDescription: attempt.description || slot.voiceDescription,
        approvedAttemptId: slot.approvedAttemptId,
        approvedVoiceId: slot.approvedVoiceId || attempt.voiceId || "",
        previewText: attempt.previewText,
        sourceMp3: src,
        source: "crash",
      });
      slot.keeperSaved = true;
      slot.keeperKey = key;
      changed = true;
    } catch {
      /* skip — missing file or copy failed */
    }
  }

  if (changed) writeCrashVoiceManifest(styleId, manifest);
  return manifest;
}

function readCrashVoiceManifestRaw(
  styleId: ShowStyleId,
): Record<string, CrashVoiceSlot> {
  const p = manifestPath(styleId);
  if (!fs.existsSync(p)) return {};
  try {
    const raw = JSON.parse(fs.readFileSync(p, "utf8")) as Record<
      string,
      CrashVoiceSlot
    >;
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

function writeCrashVoiceManifest(
  styleId: ShowStyleId,
  manifest: Record<string, CrashVoiceSlot>,
): void {
  ensureVoiceDirs(styleId);
  fs.writeFileSync(manifestPath(styleId), JSON.stringify(manifest, null, 2));
}

export function getCrashVoiceSlot(
  styleId: ShowStyleId,
  castKey: string,
): CrashVoiceSlot | null {
  return readCrashVoiceManifest(styleId)[castKey] ?? null;
}

/** Match story speaker name to a locked voice slot. */
/** Stock Adam — never prefer this when a real cast voice exists. */
const STOCK_ADAM_VOICE_ID = "pNInz6obpgDQGcFmaJgB";

function pickBestVoiceSlot(matches: CrashVoiceSlot[]): CrashVoiceSlot | null {
  if (!matches.length) return null;
  const real = matches.find(
    (s) =>
      s.approvedVoiceId?.trim() &&
      s.approvedVoiceId.trim() !== STOCK_ADAM_VOICE_ID,
  );
  return real ?? matches[0] ?? null;
}

export function findCrashVoiceByName(
  styleId: ShowStyleId,
  speaker: string,
): CrashVoiceSlot | null {
  const n = normalizeSpeakerName(speaker);
  if (!n) return null;
  const manifest = readCrashVoiceManifestRaw(styleId);
  const slots = Object.values(manifest);

  for (const tryName of speakerCastNames(styleId, speaker)) {
    const exact = tryName.trim().toLowerCase();
    const exactHits = slots.filter(
      (slot) => slot.castName.trim().toLowerCase() === exact,
    );
    const best = pickBestVoiceSlot(exactHits);
    if (best) return best;
  }

  for (const tryName of speakerCastNames(styleId, speaker)) {
    const fuzzy = slots.filter((slot) =>
      voiceNamesMatch(tryName, slot.castName),
    );
    const best = pickBestVoiceSlot(fuzzy);
    if (best) return best;
  }

  const loose = slots.filter((slot) =>
    voiceNamesMatch(speaker, slot.castName),
  );
  return pickBestVoiceSlot(loose);
}

function voiceLimitError(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes("maximum amount") || m.includes("custom voice limit");
}

/** Preview / library voice gone from ElevenLabs (temp design ids expire). */
export function elevenVoiceMissingError(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes("was not found") ||
    m.includes("voice_not_found") ||
    (m.includes("voice") && m.includes("not found"))
  );
}

function protectedKeeperVoiceIds(): Set<string> {
  const ids = new Set<string>();
  for (const entry of Object.values(readVoiceLibrary())) {
    const id = entry.approvedVoiceId?.trim();
    if (id) ids.add(id);
  }
  return ids;
}

/** Drop one Studio auto-voice from ElevenLabs when the account is full. Keepers stay. */
async function freeOneLibraryVoiceSlot(): Promise<boolean> {
  const protectedIds = protectedKeeperVoiceIds();
  const voices = await listLibraryVoices();
  const studioPrefixes = SHOW_STYLE_PRESETS.map((p) => p.label);

  const custom = voices.filter(
    (v) =>
      !protectedIds.has(v.voiceId) &&
      (v.category === "cloned" ||
        v.category === "generated" ||
        v.category === "professional" ||
        studioPrefixes.some((prefix) => v.name.startsWith(`${prefix} `))),
  );

  for (const voice of custom) {
    if (await deleteLibraryVoice(voice.voiceId)) return true;
  }
  return false;
}

async function createLibraryVoiceWithSlot(opts: {
  voiceName: string;
  voiceDescription: string;
  generatedVoiceId: string;
}): Promise<string> {
  try {
    return await createLibraryVoice(opts);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!voiceLimitError(msg)) throw e;

    const freed = await freeOneLibraryVoiceSlot();
    if (freed) {
      try {
        return await createLibraryVoice(opts);
      } catch {
        /* borrow below */
      }
    }

    const borrowed = await borrowLibraryVoiceId(opts.voiceName);
    if (borrowed) return borrowed;

    throw new Error(
      "ElevenLabs voice library full (30/30). Delete old custom voices at elevenlabs.io → Voices, or use an API key with voices_write so Studio can recycle slots.",
    );
  }
}

/** When the library is full, reuse an existing ElevenLabs voice_id already on the account. */
async function borrowLibraryVoiceId(voiceName: string): Promise<string | null> {
  const castName = voiceName.includes(" ")
    ? voiceName.slice(voiceName.indexOf(" ") + 1).trim()
    : voiceName.trim();
  if (!castName) return null;

  const protectedIds = protectedKeeperVoiceIds();
  const voices = await listLibraryVoices();

  const exact = voices.find(
    (v) => v.name.trim().toLowerCase() === voiceName.trim().toLowerCase(),
  );
  if (exact?.voiceId) return exact.voiceId;

  const partial = voices.find(
    (v) =>
      !protectedIds.has(v.voiceId) &&
      v.name.toLowerCase().includes(castName.toLowerCase()),
  );
  if (partial?.voiceId) return partial.voiceId;

  for (const preset of SHOW_STYLE_PRESETS) {
    const manifest = readCrashVoiceManifestRaw(preset.id);
    for (const slot of Object.values(manifest)) {
      if (!slot.approvedVoiceId?.trim()) continue;
      if (!voiceNamesMatch(castName, slot.castName)) continue;
      return slot.approvedVoiceId.trim();
    }
  }

  const fallback = voices.find(
    (v) =>
      !protectedIds.has(v.voiceId) &&
      v.category !== "premade" &&
      v.voiceId,
  );
  return fallback?.voiceId ?? null;
}

/** Design a fresh ElevenLabs voice when the old id expired. */
export async function refreshCrashVoiceId(
  styleId: ShowStyleId,
  castName: string,
): Promise<string> {
  if (!elevenKeyPresent()) {
    throw new Error("Missing ELEVENLABS_API_KEY");
  }
  const slot = findCrashVoiceByName(styleId, castName);
  if (!slot) throw new Error(`No voice slot for ${castName}`);
  const desc = slot.voiceDescription.trim();
  if (!desc) throw new Error(`Write a voice description for ${castName} first`);

  const manifest = readCrashVoiceManifestRaw(styleId);
  const entry = manifest[slot.castKey] ?? slot;

  // Always design a NEW preview — old generated_voice_id expires and must not be reused.
  const previews = await designVoicePreviews({ voiceDescription: desc });
  const generated = previews[0]?.generatedVoiceId?.trim();
  if (!generated) throw new Error(`Could not design a fresh voice for ${castName}`);

  const voiceId = await createLibraryVoiceWithSlot({
    voiceName: `${getShowStylePreset(styleId).label} ${castName}`.slice(0, 100),
    voiceDescription: desc,
    generatedVoiceId: generated,
  });

  entry.approvedVoiceId = voiceId;
  if (!entry.approvedAttemptId && entry.attempts.length) {
    entry.approvedAttemptId = entry.attempts[0]!.id;
  }
  if (entry.approvedAttemptId) {
    const att = entry.attempts.find((a) => a.id === entry.approvedAttemptId);
    if (att) {
      att.generatedVoiceId = voiceId;
      att.voiceId = voiceId;
      att.status = "approved";
    }
  }
  manifest[slot.castKey] = entry;
  writeCrashVoiceManifest(styleId, manifest);
  upsertVoiceLibraryApprovedId({
    showId: styleId,
    characterName: castName,
    castKey: slot.castKey,
    approvedVoiceId: voiceId,
    approvedAttemptId: entry.approvedAttemptId,
    voiceDescription: desc,
  });
  return voiceId;
}

function ensureVoiceSlotFromCards(
  styleId: ShowStyleId,
  castName: string,
): CrashVoiceSlot | null {
  const cards = readStyleCardManifest(styleId);
  for (const [castKey, meta] of Object.entries(cards)) {
    if (!meta.name?.trim()) continue;
    if (!voiceNamesMatch(castName, meta.name)) continue;
    const manifest = readCrashVoiceManifestRaw(styleId);
    if (manifest[castKey]) return manifest[castKey]!;
    const slot: CrashVoiceSlot = {
      castKey,
      castName: meta.name,
      voiceDescription: meta.brief || meta.name,
      approvedAttemptId: "",
      approvedVoiceId: "",
      attempts: [],
    };
    manifest[castKey] = slot;
    writeCrashVoiceManifest(styleId, manifest);
    return slot;
  }
  return null;
}

/** Cursor tour — design + lock voice automatically when not approved yet. */
export async function ensureCursorVoiceReady(
  styleId: ShowStyleId,
  castName: string,
): Promise<void> {
  let slot = findCrashVoiceByName(styleId, castName);
  if (!slot) slot = ensureVoiceSlotFromCards(styleId, castName);
  if (!slot) throw new Error(`No voice slot for ${castName} — add them in Characters`);

  if (slot.approvedAttemptId && slot.approvedVoiceId) {
    const att = slot.attempts.find((a) => a.id === slot.approvedAttemptId);
    if (att?.voiceId?.trim() && att.voiceId === slot.approvedVoiceId) return;
  }

  const desc = slot.voiceDescription.trim() || slot.castName;
  if (!slot.attempts.length) {
    await designCrashVoice({
      styleId,
      castKey: slot.castKey,
      castName: slot.castName,
      voiceDescription: desc,
    });
  }

  await refreshCrashVoiceId(styleId, castName);
}

/**
 * Same as ensureCursorVoiceReady, but when a cast slot has no
 * voiceDescription yet, tries an async description provider (Stage 3's LLM
 * suggestion) before falling back to the static defaultCrashVoicePrompt
 * table — ensureCursorVoiceReady itself is untouched so Populate's existing
 * behavior doesn't change.
 */
export async function ensureVoiceReadyWithDescription(
  styleId: ShowStyleId,
  castName: string,
  descriptionIfMissing: () => Promise<string>,
): Promise<void> {
  let slot = findCrashVoiceByName(styleId, castName);
  if (!slot) slot = ensureVoiceSlotFromCards(styleId, castName);
  if (!slot) throw new Error(`No voice slot for ${castName} — add them in Characters`);

  if (slot.approvedAttemptId && slot.approvedVoiceId) {
    const att = slot.attempts.find((a) => a.id === slot.approvedAttemptId);
    if (att?.voiceId?.trim() && att.voiceId === slot.approvedVoiceId) return;
  }

  if (!slot.attempts.length) {
    const desc =
      slot.voiceDescription.trim() ||
      (await descriptionIfMissing()) ||
      defaultCrashVoicePrompt(castName);
    await designCrashVoice({
      styleId,
      castKey: slot.castKey,
      castName: slot.castName,
      voiceDescription: desc,
    });
  }

  await refreshCrashVoiceId(styleId, castName);
}

export function crashVoiceFilePath(
  styleId: ShowStyleId,
  castKey: string,
  fileName: string,
): string | null {
  if (!fileName || fileName.includes("..")) return null;
  const p = path.join(slotDir(styleId, castKey), fileName);
  return fs.existsSync(p) ? p : null;
}

export async function designCrashVoice(opts: {
  styleId: ShowStyleId;
  castKey: string;
  castName: string;
  voiceDescription: string;
}): Promise<CrashVoiceSlot> {
  if (!elevenKeyPresent()) {
    throw new Error(
      "Missing ELEVENLABS_API_KEY in MY MOVIES\\.env — restart Studio after adding.",
    );
  }

  const desc = sanitizeVoiceDescriptionForApi(opts.voiceDescription);
  if (!desc) throw new Error("Write a voice description first");

  const manifest = readCrashVoiceManifestRaw(opts.styleId);
  const slot = manifest[opts.castKey] ?? {
    castKey: opts.castKey,
    castName: opts.castName,
    voiceDescription: "",
    approvedAttemptId: "",
    approvedVoiceId: "",
    attempts: [],
  };

  slot.castName = opts.castName || slot.castName;
  slot.voiceDescription = desc;

  const rejectHints = slot.attempts
    .filter((a) => a.status === "rejected" && a.reason)
    .slice(0, 8)
    .map((a) => a.reason);

  const previews = await designVoicePreviews({
    voiceDescription: desc,
    previewText: VOICE_CLONE_SAMPLE_SCRIPT,
    rejectHints,
  });

  const dir = slotDir(opts.styleId, opts.castKey);
  fs.mkdirSync(dir, { recursive: true });

  const added: VoiceAttempt[] = [];
  // Three takes at a time — Approve / Reject each. Local mp3 only on EL tidy.
  for (const p of previews.slice(0, 3)) {
    const attempt = emptyVoiceAttempt({
      description: desc,
      previewText: p.previewText || VOICE_CLONE_SAMPLE_SCRIPT,
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

  slot.attempts = [...added, ...slot.attempts];
  manifest[opts.castKey] = slot;
  writeCrashVoiceManifest(opts.styleId, manifest);
  return slot;
}

/** Drop temp / library ids from ElevenLabs — never throw (local sample is the keeper). */
async function scrubElevenLabsIds(ids: string[]): Promise<void> {
  const seen = new Set<string>();
  for (const raw of ids) {
    const id = raw.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    await deleteLibraryVoice(id);
  }
}

/** Persist a permanent ElevenLabs voice_id on an approved slot (no media wipe). */
export function patchCrashVoiceApprovedId(
  styleId: ShowStyleId,
  castKey: string,
  voiceId: string,
): void {
  const id = voiceId.trim();
  if (!id) return;
  const manifest = readCrashVoiceManifestRaw(styleId);
  const slot = manifest[castKey];
  if (!slot) return;
  slot.approvedVoiceId = id;
  if (slot.approvedAttemptId) {
    const att = slot.attempts.find((a) => a.id === slot.approvedAttemptId);
    if (att) att.voiceId = id;
  }
  manifest[castKey] = slot;
  writeCrashVoiceManifest(styleId, manifest);
  patchVoiceLibraryApprovedId(styleId, slot.castName, id);
}

/** True when strip / detail can safely expose a play URL (mp3 on disk). */
export function crashVoiceSlotHasSample(slot: CrashVoiceSlot | null | undefined): boolean {
  if (!slot?.approvedAttemptId) return false;
  const attempt = slot.attempts.find((a) => a.id === slot.approvedAttemptId);
  if (attempt?.fileName?.trim()) return true;
  return Boolean(slot.keeperSaved);
}

/**
 * TTS a short keeper sample for a locked voice_id (never deletes media).
 * Used after Paste/Lock ID and for "Gen sample" when play had nothing.
 */
export async function ensureCrashVoiceSample(opts: {
  styleId: ShowStyleId;
  castKey: string;
}): Promise<CrashVoiceSlot> {
  if (!elevenKeyPresent()) {
    throw new Error(
      "Missing ELEVENLABS_API_KEY in MY MOVIES\\.env — restart Studio after adding.",
    );
  }

  const castKey = opts.castKey.trim();
  if (!castKey) throw new Error("Need castKey");

  const manifest = readCrashVoiceManifestRaw(opts.styleId);
  const slot = manifest[castKey];
  if (!slot) throw new Error("No voice slot for this cast");

  const voiceId = slot.approvedVoiceId?.trim();
  if (!voiceId) throw new Error("Lock a voice ID first");

  let attempt = slot.approvedAttemptId
    ? slot.attempts.find((a) => a.id === slot.approvedAttemptId)
    : undefined;

  const attemptPath =
    attempt?.fileName &&
    crashVoiceFilePath(opts.styleId, castKey, attempt.fileName);
  const libEntry = getVoiceLibraryEntry(opts.styleId, slot.castName);
  const keeperPath = libEntry ? resolveKeeperFile(libEntry) : null;

  if (attemptPath || keeperPath) {
    // Already playable — refresh flags; copy keeper → attempt if take has no mp3
    if (keeperPath && attempt && !attemptPath) {
      const dir = slotDir(opts.styleId, castKey);
      fs.mkdirSync(dir, { recursive: true });
      attempt.fileName = `${attempt.id}.mp3`;
      fs.copyFileSync(keeperPath, path.join(dir, attempt.fileName));
    }
    if (keeperPath) {
      slot.keeperSaved = true;
      slot.keeperKey = libraryKey(opts.styleId, slot.castName);
    } else if (attemptPath && attempt) {
      saveVoiceKeeper({
        showId: opts.styleId,
        characterName: slot.castName,
        castKey,
        voiceDescription: attempt.description || slot.voiceDescription,
        approvedAttemptId: attempt.id,
        approvedVoiceId: voiceId,
        previewText: attempt.previewText,
        sourceMp3: attemptPath,
        source: "crash",
      });
      slot.keeperSaved = true;
      slot.keeperKey = libraryKey(opts.styleId, slot.castName);
    }
    manifest[castKey] = slot;
    writeCrashVoiceManifest(opts.styleId, manifest);
    return slot;
  }

  if (!attempt) {
    attempt = emptyVoiceAttempt({
      status: "approved",
      description: slot.voiceDescription || slot.castName,
      voiceId,
      generatedVoiceId: voiceId,
      previewText: `Locked ElevenLabs voice for ${slot.castName}`,
    });
    slot.attempts = [attempt, ...slot.attempts];
    slot.approvedAttemptId = attempt.id;
  }

  const previewText =
    attempt.previewText?.trim() &&
    !attempt.previewText.startsWith("Locked ElevenLabs voice")
      ? attempt.previewText.trim()
      : `Right — ${slot.castName}. This is the locked voice.`;

  const buf = await synthesizeSpeech({ voiceId, text: previewText });
  const dir = slotDir(opts.styleId, castKey);
  fs.mkdirSync(dir, { recursive: true });
  attempt.fileName = `${attempt.id}.mp3`;
  attempt.previewText = previewText;
  attempt.voiceId = voiceId;
  attempt.status = "approved";
  fs.writeFileSync(path.join(dir, attempt.fileName), buf);

  saveVoiceKeeper({
    showId: opts.styleId,
    characterName: slot.castName,
    castKey,
    voiceDescription: attempt.description || slot.voiceDescription,
    approvedAttemptId: attempt.id,
    approvedVoiceId: voiceId,
    previewText,
    sourceMp3: path.join(dir, attempt.fileName),
    source: "crash",
  });

  slot.approvedAttemptId = attempt.id;
  slot.approvedVoiceId = voiceId;
  slot.keeperSaved = true;
  slot.keeperKey = libraryKey(opts.styleId, slot.castName);
  manifest[castKey] = slot;
  writeCrashVoiceManifest(opts.styleId, manifest);
  return slot;
}

/**
 * Lock a cast to an existing ElevenLabs voice_id (paste from ElevenLabs).
 * Never deletes media or other voices. Keeps keeper mp3 if already saved.
 * Generates a short TTS sample so strip ▶ has a real mp3 (not empty src).
 */
export async function lockCrashVoiceByExternalId(opts: {
  styleId: ShowStyleId;
  castKey: string;
  castName: string;
  voiceId: string;
  voiceDescription?: string;
}): Promise<CrashVoiceSlot> {
  const id = opts.voiceId.trim();
  const castKey = opts.castKey.trim();
  const castName = opts.castName.trim() || castKey;
  if (!id) throw new Error("Need voice ID");
  if (!castKey) throw new Error("Need castKey");

  const manifest = readCrashVoiceManifestRaw(opts.styleId);
  const slot: CrashVoiceSlot = manifest[castKey] ?? {
    castKey,
    castName,
    voiceDescription: "",
    approvedAttemptId: "",
    approvedVoiceId: "",
    attempts: [],
  };

  slot.castKey = castKey;
  slot.castName = castName;
  if (opts.voiceDescription?.trim()) {
    slot.voiceDescription = opts.voiceDescription.trim();
  } else if (!slot.voiceDescription?.trim()) {
    slot.voiceDescription = castName;
  }

  let attempt = slot.approvedAttemptId
    ? slot.attempts.find((a) => a.id === slot.approvedAttemptId)
    : undefined;
  if (!attempt) {
    attempt = emptyVoiceAttempt({
      status: "approved",
      description: slot.voiceDescription,
      voiceId: id,
      generatedVoiceId: id,
      previewText: `Locked ElevenLabs voice for ${castName}`,
    });
    slot.attempts = [attempt, ...slot.attempts];
  } else {
    attempt.status = "approved";
    attempt.voiceId = id;
    if (!attempt.generatedVoiceId?.trim()) attempt.generatedVoiceId = id;
  }

  slot.approvedAttemptId = attempt.id;
  slot.approvedVoiceId = id;

  const lib = upsertVoiceLibraryApprovedId({
    showId: opts.styleId,
    characterName: slot.castName,
    castKey,
    approvedVoiceId: id,
    approvedAttemptId: slot.approvedAttemptId,
    voiceDescription: slot.voiceDescription,
    previewText: attempt.previewText,
  });
  slot.keeperKey = libraryKey(opts.styleId, slot.castName);
  const keeperOk = Boolean(resolveKeeperFile(lib));
  slot.keeperSaved = keeperOk;

  manifest[castKey] = slot;
  writeCrashVoiceManifest(opts.styleId, manifest);

  // Sample for ▶ — skip TTS if attempt/keeper mp3 already exists.
  // If TTS fails, ID stays locked; UI shows Gen sample (never empty ▶).
  try {
    return await ensureCrashVoiceSample({ styleId: opts.styleId, castKey });
  } catch {
    return slot;
  }
}

export async function keepCrashVoice(opts: {
  styleId: ShowStyleId;
  castKey: string;
  attemptId: string;
}): Promise<CrashVoiceSlot> {
  const manifest = readCrashVoiceManifestRaw(opts.styleId);
  const slot = manifest[opts.castKey];
  if (!slot) throw new Error("No voice slot for this cast");

  const attempt = slot.attempts.find((a) => a.id === opts.attemptId);
  if (!attempt?.fileName) throw new Error("Voice take not found");

  const attemptFile = path.join(
    slotDir(opts.styleId, opts.castKey),
    attempt.fileName,
  );
  if (!fs.existsSync(attemptFile)) {
    throw new Error("Preview mp3 missing on disk — hit Gen voice again");
  }

  // Local 10–20s sample is the keeper. Do NOT create / keep a voice on ElevenLabs.
  const scrubIds = slot.attempts.flatMap((a) =>
    [a.generatedVoiceId, a.voiceId].filter((x): x is string => Boolean(x?.trim())),
  );
  if (slot.approvedVoiceId?.trim()) scrubIds.push(slot.approvedVoiceId);

  const key = libraryKey(opts.styleId, slot.castName);
  saveVoiceKeeper({
    showId: opts.styleId,
    characterName: slot.castName,
    castKey: opts.castKey,
    voiceDescription: attempt.description || slot.voiceDescription,
    approvedAttemptId: opts.attemptId,
    approvedVoiceId: "",
    previewText: attempt.previewText || VOICE_CLONE_SAMPLE_SCRIPT,
    sourceMp3: attemptFile,
    source: "crash",
  });

  slot.attempts = slot.attempts.map((a) => {
    if (a.id === opts.attemptId) {
      return {
        ...a,
        status: "approved" as const,
        voiceId: "",
        generatedVoiceId: "",
      };
    }
    if (a.status === "pending") {
      return {
        ...a,
        status: "rejected" as const,
        reason: "Not chosen — other take approved",
        voiceId: "",
        generatedVoiceId: "",
      };
    }
    return { ...a, voiceId: "", generatedVoiceId: "" };
  });
  slot.approvedAttemptId = opts.attemptId;
  slot.approvedVoiceId = "";
  slot.keeperSaved = true;
  slot.keeperKey = key;
  manifest[opts.castKey] = slot;
  writeCrashVoiceManifest(opts.styleId, manifest);

  await scrubElevenLabsIds(scrubIds);
  return slot;
}

export function unlockCrashVoice(opts: {
  styleId: ShowStyleId;
  castKey: string;
}): CrashVoiceSlot | null {
  const manifest = readCrashVoiceManifestRaw(opts.styleId);
  const slot = manifest[opts.castKey];
  if (!slot) return null;
  slot.approvedAttemptId = "";
  slot.approvedVoiceId = "";
  slot.keeperSaved = false;
  slot.keeperKey = "";
  slot.attempts = slot.attempts.map((a) =>
    a.status === "approved" ? { ...a, status: "pending" as const } : a,
  );
  manifest[opts.castKey] = slot;
  writeCrashVoiceManifest(opts.styleId, manifest);
  return slot;
}

/** Drop voice takes from the manifest (files stay on disk). */
export function clearCrashVoiceAttempts(opts: {
  styleId: ShowStyleId;
  castKey: string;
}): CrashVoiceSlot | null {
  const manifest = readCrashVoiceManifestRaw(opts.styleId);
  const slot = manifest[opts.castKey];
  if (!slot) return null;
  manifest[opts.castKey] = slot;
  writeCrashVoiceManifest(opts.styleId, manifest);
  return slot;
}

export async function rejectCrashVoiceAttempt(opts: {
  styleId: ShowStyleId;
  castKey: string;
  attemptId: string;
  reason?: string;
}): Promise<CrashVoiceSlot | null> {
  const manifest = readCrashVoiceManifestRaw(opts.styleId);
  const slot = manifest[opts.castKey];
  if (!slot) return null;
  const hit = slot.attempts.find((a) => a.id === opts.attemptId);
  const scrubIds = [hit?.generatedVoiceId, hit?.voiceId].filter(
    (x): x is string => Boolean(x?.trim()),
  );
  slot.attempts = slot.attempts.map((a) =>
    a.id === opts.attemptId
      ? {
          ...a,
          status: "rejected" as const,
          reason: opts.reason?.trim() || "Rejected",
          generatedVoiceId: "",
          voiceId: "",
        }
      : a,
  );
  manifest[opts.castKey] = slot;
  writeCrashVoiceManifest(opts.styleId, manifest);
  await scrubElevenLabsIds(scrubIds);
  return slot;
}
