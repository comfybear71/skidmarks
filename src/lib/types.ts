export type ShotKind = "story" | "talk" | "silent";

export type AttemptStatus = "pending" | "approved" | "rejected" | "parked";

/**
 * Cartoon (0) ←→ Photo (100).
 * Skidmarks / DAP lock sits ~50–65 (stylised 3D feature). Default 60.
 */
export type StyleRealism = number;

export function styleRealismLabel(n: number): string {
  if (n < 35) return "Too cartoon";
  if (n < 50) return "Cartoon lean";
  if (n <= 65) return "Skidmarks zone";
  if (n < 80) return "Photo lean";
  if (n < 90) return "Near photo";
  return "Too photo";
}

export function emptyFaceAttempt(partial?: Partial<FaceAttempt>): FaceAttempt {
  return {
    id: newId("face"),
    status: "pending",
    reason: "",
    note: "",
    fileName: "",
    /** DAP / STYLE_LOCK default — between cartoon and photo */
    styleRealism: 60,
    source: "text",
    createdAt: new Date().toISOString(),
    ...partial,
  };
}

export type FaceAttempt = {
  id: string;
  status: AttemptStatus;
  /** Why reject — feeds the next try */
  reason: string;
  /** Scratch notes / prompt for this try */
  note: string;
  /** Relative under data/characters/<id>/faces/ — generated (or manual) result */
  fileName: string;
  /** 0 cartoon … 60 Skidmarks … 100 photo */
  styleRealism: StyleRealism;
  /** How this attempt was made */
  source: "generated" | "upload" | "text";
  createdAt: string;
};

export type FaceReference = {
  id: string;
  fileName: string;
  label: string;
  createdAt: string;
};

export type VoiceAttempt = {
  id: string;
  status: AttemptStatus;
  reason: string;
  /** Casting / design prompt */
  description: string;
  /** Line spoken in the preview */
  previewText: string;
  /** ElevenLabs preview id — needed to lock into library */
  generatedVoiceId: string;
  /** Permanent library voice_id after Approve */
  voiceId: string;
  /** mp3 under data/characters/<id>/voices/ */
  fileName: string;
  createdAt: string;
};

/** A pinned episode draft — usually the output of the Episode Template pasted into an outside AI. */
export type CharacterScript = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
};

export type Character = {
  id: string;
  name: string;
  /** Who they were to you */
  pastNote: string;
  /**
   * Locked look line — body, clothes, footwear, hair, build.
   * Goes onto every plate this character appears in, in every episode.
   * This is what holds them consistent show-wide.
   */
  lookNote: string;
  /** How we might fuck with them (scratch — can refine on episode) */
  tormentScratch: string;
  approved: boolean;
  /** Uploaded refs — not the final face; used to generate */
  references: FaceReference[];
  faceAttempts: FaceAttempt[];
  /** Approved face attempt id, if any */
  approvedFaceId: string;
  /** Voice casting notes (default for Generate voice) */
  voiceDescription: string;
  voiceAttempts: VoiceAttempt[];
  approvedVoiceAttemptId: string;
  /** Locked ElevenLabs library voice_id */
  approvedVoiceId: string;
  /** Pinned episode drafts — kept even if the character never goes further than this */
  scripts: CharacterScript[];
  createdAt: string;
  updatedAt: string;
};

export type LocationPlateAttempt = {
  id: string;
  status: AttemptStatus;
  reason: string;
  note: string;
  fileName: string;
  styleRealism: StyleRealism;
  source: "generated" | "upload" | "text";
  createdAt: string;
};

export type LocationRef = {
  id: string;
  fileName: string;
  label: string;
  createdAt: string;
};

/** One room inside a location — lounge, kitchen, bedroom… each has its own locked plate. */
export type Room = {
  id: string;
  name: string;
  notes: string;
  lookNote: string;
  approved: boolean;
  references: LocationRef[];
  plateAttempts: LocationPlateAttempt[];
  approvedPlateId: string;
  createdAt: string;
  updatedAt: string;
};

/** Shared location pool — houses, pubs, streets. Reuse across episodes. */
export type Location = {
  id: string;
  name: string;
  slug: string;
  /** Who this place belongs to / is tied to (character ids) */
  characterIds: string[];
  notes: string;
  /** Overall place look (shared by rooms unless a room overrides) */
  lookNote: string;
  approved: boolean;
  /** House-level refs (optional; rooms can have their own too) */
  references: LocationRef[];
  /** @deprecated migrated into rooms[0] if present */
  plateAttempts: LocationPlateAttempt[];
  approvedPlateId: string;
  rooms: Room[];
  createdAt: string;
  updatedAt: string;
};

export function emptyLocationPlate(
  partial?: Partial<LocationPlateAttempt>,
): LocationPlateAttempt {
  return {
    id: newId("lplate"),
    status: "pending",
    reason: "",
    note: "",
    fileName: "",
    styleRealism: 60,
    source: "text",
    createdAt: new Date().toISOString(),
    ...partial,
  };
}

export function emptyRoom(partial?: Partial<Room>): Room {
  const now = new Date().toISOString();
  return {
    id: newId("room"),
    name: "New room",
    notes: "",
    lookNote: "",
    approved: false,
    references: [],
    plateAttempts: [],
    approvedPlateId: "",
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

export function emptyLocation(partial?: Partial<Location>): Location {
  const now = new Date().toISOString();
  return {
    id: newId("loc"),
    name: "New location",
    slug: "location",
    characterIds: [],
    notes: "",
    lookNote: "",
    approved: false,
    references: [],
    plateAttempts: [],
    approvedPlateId: "",
    rooms: [],
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

/**
 * One Comfy mp4 saved back onto a shot.
 * approved = Keeper (use it). parked = not quite, keep for salvage.
 * v1, v2… stay forever — never delete a take.
 */
export type ShotRender = {
  id: string;
  /** Display label — v1, v2… */
  version: string;
  status: AttemptStatus;
  note: string;
  /** Under data/episodes/<ep>/renders/ */
  fileName: string;
  /** Read from the mp4 itself on drop — seconds, undefined if ffprobe missing */
  durationSeconds?: number;
  createdAt: string;
};

/**
 * Supporting cast for one episode only — not Character Lab.
 * Anti-heroes stay in Lab; Chloe/Sarah/cameos live here.
 */
export type EpisodeCastMember = {
  id: string;
  name: string;
  /** Role / look note for generate */
  roleNote: string;
  voiceDescription: string;
  /** Default line for voice preview */
  previewText: string;
  /** Uploaded refs — not the final face; sent to Grok as identity */
  references: FaceReference[];
  faceAttempts: FaceAttempt[];
  approvedFaceId: string;
  voiceAttempts: VoiceAttempt[];
  approvedVoiceAttemptId: string;
  approvedVoiceId: string;
  createdAt: string;
  updatedAt: string;
};

/** One prior text take kept under a field (Use / Delete). */
export type SavedText = {
  id: string;
  text: string;
  savedAt: string;
};

/** Prior mp3 rebuild kept under a beat (Use / Delete). */
export type SavedVoice = {
  id: string;
  fileName: string;
  savedAt: string;
  /** Short label — usually the quoted line */
  label: string;
};

/**
 * One Director row-pair: IMAGE plate + TEXT (+ optional mp3).
 * A shot is a stack of these = one Comfy Queue.
 */
export type ShotBeat = {
  id: string;
  /** "Beat 1 — Darryl" */
  label: string;
  /** Who speaks this TEXT — drives TTS */
  speaker: string;
  plateFile: string;
  /**
   * What Build plate should draw — who, pose, props, place vibe.
   * Separate from Comfy IMAGE [VISUAL]/[SPEECH].
   */
  platePrompt: string;
  /**
   * IMAGE segment under plate — use [VISUAL]: / [SPEECH]: tags.
   * Body + who speaks; spoken line in [SPEECH] must match mp3 quotes.
   */
  imageMotion: string;
  imageSeconds: number;
  /** TEXT for Generate mp3 — quotes only / line for voice */
  textSegment: string;
  textSeconds: number;
  voiceFile: string;
  /**
   * Add Text action beat AFTER this IMAGE+mp3 (before next beat).
   * Car-style: "Chloe … shakes her head" — no plate.
   */
  actionSegment: string;
  actionSeconds: number;
  /** Empty AUDIO seconds after this beat before the next (default 1) */
  gapAfterSeconds: number;
  /** Steer typed once, read by every AI button on this beat. Saved like Label. */
  aiNudge: string;
  platePromptHistory: SavedText[];
  imageMotionHistory: SavedText[];
  textSegmentHistory: SavedText[];
  actionSegmentHistory: SavedText[];
  voiceHistory: SavedVoice[];
};

export type Shot = {
  id: string;
  code: string;
  title: string;
  kind: ShotKind;
  cutUnder: string;
  /** Editable shot script / dialogue — what happens in this shot */
  script: string;
  scriptHistory: SavedText[];
  /** Display / Comfy plate name */
  plate: string;
  /** Mirrored from beats[0] — legacy / quick access */
  plateFile: string;
  /** Display / Comfy voice name */
  voice: string;
  /** Mirrored from beats[0] */
  voiceFile: string;
  width: number;
  height: number;
  guide: number;
  /** Mirrored from beats[0] */
  imageSeconds: number;
  /** Mirrored from beats[0] */
  textSeconds: number;
  inpaintOff: boolean;
  global: string;
  globalHistory: SavedText[];
  /** Steer typed once, read by the GLOBAL AI button. Saved like Label. */
  aiNudgeGlobal: string;
  /** Mirrored from beats[0] */
  imageMotion: string;
  /** Mirrored from beats[0] */
  textSegment: string;
  resolveNotes: string;
  cutUnderHistory: SavedText[];
  resolveNotesHistory: SavedText[];
  /** Director stack — one Comfy Queue */
  beats: ShotBeat[];
  /** Cutaway / insert — inherits scene place look */
  cutaway: boolean;
  /** Comfy outputs saved back — duds stay as rejected */
  renders: ShotRender[];
  /** The keeper mp4 for Resolve */
  approvedRenderId: string;
  done: boolean;
};

export type Scene = {
  id: string;
  slug: string;
  title: string;
  notes: string;
  /** Location Lab place for this scene */
  locationId: string;
  /** Room inside that place — cutaways share this background */
  roomId: string;
  shots: Shot[];
};

export type Episode = {
  id: string;
  show: string;
  title: string;
  slug: string;
  logline: string;
  characterNote: string;
  /** Victim from Character Lab */
  victimCharacterId: string;
  /** How we fuck with them this episode */
  torment: string;
  /** Episode-only supporting cast */
  cast: EpisodeCastMember[];
  /** Morph clips attached from Crash Lab Morph */
  crashMorphs: CrashMorphEntry[];
  createdAt: string;
  updatedAt: string;
  scenes: Scene[];
};

/** Morph / still parked on episode Crash Lab shelf (beat optional until assigned) */
export type CrashMorphEntry = {
  id: string;
  /** morph = mp4 · still = plate png */
  kind: "morph" | "still";
  runId: string;
  fileName: string;
  /** Empty until “Add to beat” */
  sceneId: string;
  shotId: string;
  beatId: string;
  createdAt: string;
};

export function newId(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Sortable on disk: prefix_YYYYMMDDHHMMSSmmm_xxx */
export function sortableId(prefix = "id"): string {
  const d = new Date();
  const stamp = [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
    String(d.getHours()).padStart(2, "0"),
    String(d.getMinutes()).padStart(2, "0"),
    String(d.getSeconds()).padStart(2, "0"),
    String(d.getMilliseconds()).padStart(3, "0"),
  ].join("");
  return `${prefix}_${stamp}_${Math.random().toString(36).slice(2, 5)}`;
}

export function emptyVoiceAttempt(partial?: Partial<VoiceAttempt>): VoiceAttempt {
  return {
    id: newId("voice"),
    status: "pending",
    reason: "",
    description: "",
    previewText: "",
    generatedVoiceId: "",
    voiceId: "",
    fileName: "",
    createdAt: new Date().toISOString(),
    ...partial,
  };
}

export function emptyCharacter(partial?: Partial<Character>): Character {
  const now = new Date().toISOString();
  return {
    id: newId("char"),
    name: "New arsehole",
    pastNote: "",
    lookNote: "",
    tormentScratch: "",
    approved: false,
    references: [],
    faceAttempts: [],
    approvedFaceId: "",
    voiceDescription: "",
    voiceAttempts: [],
    approvedVoiceAttemptId: "",
    approvedVoiceId: "",
    scripts: [],
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

export function emptyShotRender(
  partial?: Partial<ShotRender>,
): ShotRender {
  return {
    id: newId("rend"),
    version: "v1",
    status: "pending",
    note: "",
    fileName: "",
    durationSeconds: undefined,
    createdAt: new Date().toISOString(),
    ...partial,
  };
}

/** m:ss, or blank if we never managed to read the length. */
export function formatDuration(seconds: number | undefined): string {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return "";
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function emptyCastMember(
  partial?: Partial<EpisodeCastMember>,
): EpisodeCastMember {
  const now = new Date().toISOString();
  return {
    id: newId("cast"),
    name: "New cast",
    roleNote: "",
    voiceDescription: "",
    previewText: "",
    references: [],
    faceAttempts: [],
    approvedFaceId: "",
    voiceAttempts: [],
    approvedVoiceAttemptId: "",
    approvedVoiceId: "",
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

export function emptyBeat(partial?: Partial<ShotBeat>): ShotBeat {
  const p = partial || {};
  return {
    id: newId("beat"),
    label: "Beat 1",
    speaker: "",
    plateFile: "",
    platePrompt: "",
    imageMotion: "",
    imageSeconds: 4,
    textSegment: "",
    textSeconds: 6,
    voiceFile: "",
    actionSegment: "",
    actionSeconds: 4,
    gapAfterSeconds: 1,
    aiNudge: "",
    ...p,
    platePromptHistory: Array.isArray(p.platePromptHistory)
      ? p.platePromptHistory
      : [],
    imageMotionHistory: Array.isArray(p.imageMotionHistory)
      ? p.imageMotionHistory
      : [],
    textSegmentHistory: Array.isArray(p.textSegmentHistory)
      ? p.textSegmentHistory
      : [],
    actionSegmentHistory: Array.isArray(p.actionSegmentHistory)
      ? p.actionSegmentHistory
      : [],
    voiceHistory: Array.isArray(p.voiceHistory) ? p.voiceHistory : [],
  };
}

export function pushSavedText(
  history: SavedText[] | undefined,
  text: string,
  max = 10,
): SavedText[] {
  const t = (text || "").trim();
  if (!t) return history || [];
  const prev = history || [];
  if (prev[0]?.text === text) return prev;
  return [
    { id: newId("sav"), text, savedAt: new Date().toISOString() },
    ...prev.filter((h) => h.text !== text),
  ].slice(0, max);
}

/** Every shot: 1–4 beats. Story can be 1; talk stacks often 2–4. */
export const MIN_SHOT_BEATS = 1;
export const MAX_SHOT_BEATS = 4;

/** Ensure beats[] exists (at least 1); mirror beats[0] onto legacy flat fields. */
export function ensureShotBeats(sh: Shot): Shot {
  let beats = Array.isArray(sh.beats) ? [...sh.beats] : [];
  if (beats.length === 0) {
    beats = [
      emptyBeat({
        label: "Beat 1",
        speaker: "",
        plateFile: sh.plateFile || "",
        imageMotion: sh.imageMotion || "",
        imageSeconds: sh.imageSeconds ?? 4,
        textSegment: sh.textSegment || "",
        textSeconds: sh.textSeconds ?? 6,
        voiceFile: sh.voiceFile || "",
        gapAfterSeconds: 1,
      }),
    ];
  }
  while (beats.length < MIN_SHOT_BEATS) {
    const n = beats.length + 1;
    beats.push(
      emptyBeat({
        label: `Beat ${n}`,
        gapAfterSeconds: n < MIN_SHOT_BEATS ? 1 : 0,
      }),
    );
  }
  if (beats.length > MAX_SHOT_BEATS) {
    beats = beats.slice(0, MAX_SHOT_BEATS);
  }
  beats = beats.map((b, i) => ({
    ...emptyBeat(b),
    id: b.id || newId("beat"),
    label: b.label || `Beat ${i + 1}`,
    gapAfterSeconds:
      i < beats.length - 1
        ? b.gapAfterSeconds ?? 1
        : 0,
  }));
  const b0 = beats[0];
  return {
    ...sh,
    script: sh.script || "",
    scriptHistory: Array.isArray(sh.scriptHistory) ? sh.scriptHistory : [],
    globalHistory: Array.isArray(sh.globalHistory) ? sh.globalHistory : [],
    cutUnderHistory: Array.isArray(sh.cutUnderHistory)
      ? sh.cutUnderHistory
      : [],
    resolveNotesHistory: Array.isArray(sh.resolveNotesHistory)
      ? sh.resolveNotesHistory
      : [],
    beats,
    plateFile: b0.plateFile || sh.plateFile || "",
    voiceFile: b0.voiceFile || sh.voiceFile || "",
    imageMotion: b0.imageMotion ?? sh.imageMotion ?? "",
    textSegment: b0.textSegment ?? sh.textSegment ?? "",
    imageSeconds: b0.imageSeconds ?? sh.imageSeconds ?? 4,
    textSeconds: b0.textSeconds ?? sh.textSeconds ?? 6,
  };
}

export function mirrorBeat0(sh: Shot): Shot {
  const withBeats = ensureShotBeats(sh);
  const b0 = withBeats.beats[0];
  return {
    ...withBeats,
    plateFile: b0.plateFile || "",
    voiceFile: b0.voiceFile || "",
    imageMotion: b0.imageMotion || "",
    textSegment: b0.textSegment || "",
    imageSeconds: b0.imageSeconds ?? 4,
    textSeconds: b0.textSeconds ?? 6,
    plate: withBeats.plate || b0.plateFile || "",
    voice: withBeats.voice || b0.voiceFile || "",
  };
}

export function emptyShot(partial?: Partial<Shot>): Shot {
  const base = {
    id: newId("shot"),
    code: "T01",
    title: "New shot",
    kind: "talk" as ShotKind,
    cutUnder: "",
    script: "",
    scriptHistory: [],
    plate: "",
    plateFile: "",
    voice: "",
    voiceFile: "",
    width: 768,
    height: 512,
    guide: 0.45,
    imageSeconds: 4,
    textSeconds: 6,
    inpaintOff: true,
    global: "",
    globalHistory: [],
    aiNudgeGlobal: "",
    imageMotion: "",
    textSegment: "",
    resolveNotes: "",
    cutUnderHistory: [],
    resolveNotesHistory: [],
    beats: [
      emptyBeat({ label: "Beat 1", gapAfterSeconds: 1 }),
      emptyBeat({ label: "Beat 2", gapAfterSeconds: 0 }),
    ] as ShotBeat[],
    cutaway: false,
    renders: [],
    approvedRenderId: "",
    done: false,
    ...partial,
  };
  return mirrorBeat0({
    ...base,
    script: base.script || "",
    scriptHistory: Array.isArray(base.scriptHistory) ? base.scriptHistory : [],
  });
}

export function emptyScene(partial?: Partial<Scene>): Scene {
  return {
    id: newId("scene"),
    slug: "scene_01",
    title: "Scene 01",
    notes: "",
    locationId: "",
    roomId: "",
    shots: [],
    ...partial,
  };
}

export function emptyEpisode(partial?: Partial<Episode>): Episode {
  const now = new Date().toISOString();
  return {
    id: newId("ep"),
    show: "Skidmarks",
    title: "New episode",
    slug: "episode02-untitled",
    logline: "",
    characterNote: "",
    victimCharacterId: "",
    torment: "",
    cast: [],
    crashMorphs: [],
    createdAt: now,
    updatedAt: now,
    scenes: [
      emptyScene({
        slug: "scene_01",
        title: "Scene 01",
        shots: [emptyShot({ code: "S01", title: "First shot" })],
      }),
    ],
    ...partial,
  };
}
