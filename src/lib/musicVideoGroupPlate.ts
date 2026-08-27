import { isEmptyStageStaging } from "./emptyStagePlate";

/**
 * Music-video group plates.
 *
 * Who is named on this job is who is drawn. A new song does not inherit
 * another job's cameras, grade, instruments, or roster. Instruments only
 * when THIS job's Position names them. No extras. No character-plate sheets.
 */

export const MUSIC_VIDEO_GROUP_MAX = 3;

/**
 * Forgotten people plates must match the Grok videos he made
 * (graveyard / wooden house / leafless tree). Same colours. No watermark.
 */
export const FORGOTTEN_GROK_GRADE =
  "Same grade as the Grok plates: deep black and blood crimson only, red mist, two red spotlight beams from the top corners. No teal, no white daylight, no green, no orange lava, no watermark, no Grok logo.";

/** Seedream cel-ifies Jack's graphic card. This lock must be on the send. */
export const MUSIC_VIDEO_NO_CEL =
  "Live-action photograph. Real human skin, real cloth, real brass and wood. No cel shading, no GTA, no Archer, no comic outlines, no cartoon, no anime, no illustrated character sheet.";

/** Learned Crash Lab cameras — music video only, no clothes-change / pie / beer. */
export const MUSIC_VIDEO_CAMERAS = {
  "tight-cu":
    "TIGHT CLOSE-UP, face fills the frame, shoulders barely visible, huge and near the camera. Not a distant full-body. Not a wide of the place.",
  mcu: "MEDIUM CLOSE-UP, head and shoulders fill the frame, crop the waist and legs, huge and near the camera. Not a distant full-body.",
  medium: "MEDIUM SHOT, full upper body. Three-quarter, not a lineup.",
  wide: "WIDE full-body, head to toe, lots of the place around them, smaller in frame. Show the ground and the sky.",
  ots: "MEDIUM SHOT. Three-quarter back, looking back over the shoulder at the camera. Same face. Not a selfie.",
  sitting: "MEDIUM SHOT. Sitting, knees bent, planted. Use the place as a seat, not a backdrop.",
  "ots-two":
    "OVER THE SHOULDER two-shot. Camera looks past the nearer person at the farther one. Not a lineup. Not a selfie.",
  "wide-three":
    "WIDE three-shot. All three in the place, not a police lineup facing camera. Depth, not a mug-shot row.",
} as const;

export type MusicVideoCameraKey = keyof typeof MUSIC_VIDEO_CAMERAS;

/**
 * Two cameras that are not a straight-on mug shot.
 * A new solo Start uses both so the song is two angles, not one stare.
 */
export const MUSIC_VIDEO_OFF_AXIS_CAMERAS: readonly MusicVideoCameraKey[] = [
  "medium",
  "ots",
];

export function musicVideoCameraLabel(key: MusicVideoCameraKey): string {
  if (key === "medium") return "three-quarter";
  if (key === "ots") return "over shoulder";
  if (key === "ots-two") return "over shoulder two-shot";
  if (key === "wide-three") return "wide three-shot";
  if (key === "tight-cu") return "tight close-up";
  if (key === "mcu") return "medium close-up";
  if (key === "sitting") return "sitting";
  if (key === "wide") return "wide";
  return key;
}

/**
 * Jack Ghost walk-away cameras — kept for a later cutaway.
 * Forgotten who-plays now sings Jack and only tries the muted trumpet. Sax stays off. Grok videos fill fails.
 */
export const JACK_WALK_CAMERAS = [
  "WIDE from behind. He walks away from camera into the dark, smaller in frame. Full silhouette — fedora, dark suit. Ominous. Not a portrait. Not facing camera.",
  "THREE-QUARTER REAR. Walking away, slight angle so the hat and shoulders read, face stays black. Not looking back over the shoulder.",
] as const;

/** Two short cutaways. Everything else is sing. */
export const JACK_WALK_START_SEC = [106, 186] as const;

export function isJackWalkStartSec(startSec: number): boolean {
  const start = Math.round(startSec);
  return (JACK_WALK_START_SEC as readonly number[]).includes(start);
}

export function jackWalkCameraForStartSec(startSec: number): string {
  const start = Math.round(startSec);
  const i = (JACK_WALK_START_SEC as readonly number[]).indexOf(start);
  const idx = i >= 0 ? i : Math.abs(start) % JACK_WALK_CAMERAS.length;
  return JACK_WALK_CAMERAS[idx];
}

/** Position for a Jack walk plate — camera behind, empty hands, no face. */
export function forgottenJackWalkStaging(placeName: string, startSec: number): string {
  const place = (placeName.trim() || "the stage").replace(/[.]+$/, "");
  return defaultMusicVideoGroupStaging(
    ["JACK GHOST"],
    place,
    jackWalkCameraForStartSec(startSec),
  );
}

export const FORGOTTEN_LYRICS = `FORGOTTEN.mp3 [Instrumental Intro,  muted trumpet snaking middle eastern melody, dark Arabic scale, heavy 12-string drone, deep dragging slide bass]

[Verse 1]

The last thing I felt was a cold, iron snap
A flat-line rattle in a blackout trap
Woke up with my boots in a sulfur stream
Red sky boiling like a fever dream
A wall of mirrors but the glass is blurred
I’m screaming out my name but I forget the word
The keeper at the gate has a heavy iron ledger
Says he’s calculating every past pleasure

[Chorus]

But I left in confusion, I walked out blind
Left the keys to my kingdom and my name behind
Trying to remember all the wreckage I made
Every debt I ignored, every hand I betrayed
It didn't look like sin when the sun was high
Now the memory fades like a closing eye

Who am I?
Who am I?

[Verse 2, muted trumpet snaking middle eastern melody]

A face in the smoke says I burned down a town
Another one swears that I watched someone drown
It sounds like a myth or a ghost story told
A pocket full of silver that was traded for gold
Was I the hammer or was I the nail?
Did I build the gallows or did I break the jail?
The more I look back, the more the ink bleeds
Just a nameless shadow doing nameless deeds

[Chorus]

'Cause I left in confusion, I walked out blind
Left the keys to my kingdom and my name behind
Trying to remember all the wreckage I made
Every debt I ignored, every hand I betrayed
It didn't look like sin when the sun was high
Now the memory fades like a closing eye

Who am I?
Who am I?

[Bridge, groove drops out, crying Eastern trumpet solo, weeping slide bass]
Strip away the house, strip away the clothes
Strip away the people that I thought I chose
Take the skin off the bone till the ledger is clean
I’m a blank white page in a black machine
Can’t even remember the sins I defend
Just a ghost at the beginning of the end

[Outro, heavy swampy groove slams back, vocals fading into abstract wall of sound]
Losing the face...

Losing the frame...

Losing the sins...

Forgot the name

[End, sudden silence]`;

export const FORGOTTEN_PROMPT =
  "THE JACK ASH BAND — FORGOTTEN. Waking up in hell, then slowly forgetting your name. Muted trumpet, dark Arabic scale, 12-string drone. Jack Ghost empty-handed. Horn plays the muted trumpet.";

export type MusicVideoBudgetTier = "CHEAP_TAKE" | "EXPENSIVE_TAKE";

export type MusicVideoGroupDraft = {
  speakers: string[];
  title: string;
  summary: string;
  staging: string;
  budget: MusicVideoBudgetTier;
  visual: string;
};

export function uniqueCastNames(names: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of names) {
    const name = String(raw || "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

/** 2–3 people. Drops extras instead of drawing a crowd. */
export function clampMusicVideoGroup(names: string[]): string[] {
  return uniqueCastNames(names).slice(0, MUSIC_VIDEO_GROUP_MAX);
}

export function isForgottenSongJob(job: {
  songTitle?: string;
  prompt?: string;
  lyrics?: string;
}): boolean {
  const blob = [job.songTitle, job.prompt, job.lyrics].join("\n");
  return /\bforgott?en\b/i.test(blob) || /\bfogotten\b/i.test(blob);
}

function rollCall(names: string[]): string {
  const unique = uniqueCastNames(names);
  if (!unique.length) return "the people in the start image";
  if (unique.length === 1) return unique[0]!;
  return `${unique.slice(0, -1).join(", ")} and ${unique[unique.length - 1]}`;
}

/** Named instrument only — never invent a mug / phone / extra horn. */
export function namedInstrumentFor(speaker: string): string {
  const n = speaker.trim().toLowerCase();
  if (n === "horn") return "muted trumpet at the lips";
  if (n === "saxophone") return "saxophone in both hands";
  if (n === "guitar") return "heavy 12-string guitar";
  if (n === "drummer") return "drumsticks, sitting the kit";
  return "";
}

export function defaultMusicVideoGroupStaging(
  speakers: string[],
  placeName: string,
  visual = "",
  opts?: { nameInstruments?: boolean },
): string {
  const names = clampMusicVideoGroup(speakers);
  const place = (placeName.trim() || "the stage").replace(/[.]+$/, "");
  const who = rollCall(names);
  const allowHeld = opts?.nameInstruments === true;
  const props = names
    .map((n) => {
      const held = allowHeld ? namedInstrumentFor(n) : "";
      return held ? `${n} holds ${held}` : `${n} empty hands, no phone`;
    })
    .join(". ");
  const action = (visual || "").trim() || "half turned, not facing camera as a lineup";
  return [
    `${who}. Only ${who} in frame, no one else appears.`,
    `Exactly ${names.length} people. No extras. No doubles.`,
    `At ${place}. ${action}.`,
    props,
    "NO SINGING MOUTH NOT MOVE. No invented objects.",
  ].join(" ");
}

function pickSpeaker(speakers: string[], want: string): string | "" {
  const wantKey = want.trim().toLowerCase();
  return speakers.find((s) => s.trim().toLowerCase() === wantKey) || "";
}

/**
 * Extra FORGOTTEN plates after the per-member solos.
 * Cheap = static / reuse / two-shot. Dear = Siray still of 3 max, not LTX.
 */
export function forgottenResearchDrafts(
  speakers: string[],
  placeName: string,
): MusicVideoGroupDraft[] {
  const jack = pickSpeaker(speakers, "JACK GHOST");
  const horn = pickSpeaker(speakers, "HORN");
  const sax = pickSpeaker(speakers, "SAXOPHONE");
  const place = placeName.trim() || "the stage";
  const out: MusicVideoGroupDraft[] = [];

  if (jack && horn) {
    const speakers2 = [jack, horn];
    const visual = `${MUSIC_VIDEO_CAMERAS["ots-two"]} Look past JACK GHOST at HORN. JACK GHOST lost, boots in the dirt, empty hands. HORN plays the muted trumpet. Cheap two-shot.`;
    out.push({
      speakers: speakers2,
      title: `${jack} + ${horn}`,
      budget: "CHEAP_TAKE",
      visual,
      summary: `[BUDGET_TIER] CHEAP_TAKE. [VISUAL_ACTION] ${visual}`,
      staging: defaultMusicVideoGroupStaging(speakers2, place, visual, {
        nameInstruments: true,
      }),
    });
  }

  if (jack && sax) {
    const speakers2 = [jack, sax];
    const visual = `${MUSIC_VIDEO_CAMERAS.medium} JACK GHOST half turned, mouth closed. SAXOPHONE holds the sax. Eyes not on camera. Cheap two-shot.`;
    out.push({
      speakers: speakers2,
      title: `${jack} + ${sax}`,
      budget: "CHEAP_TAKE",
      visual,
      summary: `[BUDGET_TIER] CHEAP_TAKE. [VISUAL_ACTION] ${visual}`,
      staging: defaultMusicVideoGroupStaging(speakers2, place, visual, {
        nameInstruments: true,
      }),
    });
  }

  if (horn && sax) {
    const speakers2 = [horn, sax];
    const visual = `${MUSIC_VIDEO_CAMERAS["ots-two"]} Horn section only. Look past HORN at SAXOPHONE. HORN muted trumpet. SAXOPHONE sax. No singer.`;
    out.push({
      speakers: speakers2,
      title: `${horn} + ${sax}`,
      budget: "CHEAP_TAKE",
      visual,
      summary: `[BUDGET_TIER] CHEAP_TAKE. [VISUAL_ACTION] ${visual}`,
      staging: defaultMusicVideoGroupStaging(speakers2, place, visual, {
        nameInstruments: true,
      }),
    });
  }

  if (jack && horn && sax) {
    const speakers3 = [jack, horn, sax];
    const visual = `${MUSIC_VIDEO_CAMERAS["wide-three"]} JACK GHOST centre, empty hands, cannot remember his name. HORN and SAXOPHONE either side with their named horns. Sulfur red sky already in the place.`;
    out.push({
      speakers: speakers3,
      title: `${jack} + ${horn} + ${sax}`,
      budget: "EXPENSIVE_TAKE",
      visual,
      summary: `[BUDGET_TIER] EXPENSIVE_TAKE. [VISUAL_ACTION] ${visual}`,
      staging: defaultMusicVideoGroupStaging(speakers3, place, visual, {
        nameInstruments: true,
      }),
    });
  }

  return out;
}

/** This job only. Do not pick a camera from another song's roster. */
function musicVideoCameraKey(_speaker: string): keyof typeof MUSIC_VIDEO_CAMERAS {
  void _speaker;
  return "medium";
}

/** Forgotten pack only — those names are this job's roster, not a house default. */
function forgottenCameraKey(speaker: string): keyof typeof MUSIC_VIDEO_CAMERAS {
  const who = speaker.trim();
  if (who === "JACK GHOST") return "wide";
  if (who === "SAXOPHONE") return "mcu";
  if (who === "DRUMMER") return "sitting";
  if (who === "GUITAR") return "wide";
  if (who === "HORN") return "ots";
  return "medium";
}

/** New music-video Start — this job's camera menu key. Empty hands. */
export function musicVideoSoloCameraAt(
  speaker: string,
  placeName: string,
  cameraKey: MusicVideoCameraKey = "medium",
): string {
  const who = speaker.trim();
  const place = (placeName.trim() || "the stage").replace(/[.]+$/, "");
  const key = cameraKey in MUSIC_VIDEO_CAMERAS ? cameraKey : "medium";
  return defaultMusicVideoGroupStaging(
    [who],
    place,
    MUSIC_VIDEO_CAMERAS[key],
    { nameInstruments: false },
  );
}

/** New music-video Start default — medium, empty hands. No other song's camera table. */
export function musicVideoSoloCamera(speaker: string, placeName: string): string {
  return musicVideoSoloCameraAt(speaker, placeName, musicVideoCameraKey(speaker));
}

export function forgottenSoloCamera(speaker: string, placeName: string): string {
  const who = speaker.trim();
  const place = (placeName.trim() || "the stage").replace(/[.]+$/, "");
  return defaultMusicVideoGroupStaging(
    [who],
    place,
    `${MUSIC_VIDEO_CAMERAS[forgottenCameraKey(who)]} ${FORGOTTEN_GROK_GRADE}`,
    { nameInstruments: true },
  );
}

/** Position for an existing Forgotten shot title — cameras from the Crash Lab set. */
export function forgottenPlateStaging(
  title: string,
  speakers: string[],
  placeName: string,
): string {
  const names = clampMusicVideoGroup(speakers.length ? speakers : [title]);
  const place = (placeName.trim() || "the stage").replace(/[.]+$/, "");
  const t = title.trim().toUpperCase();
  if (names.length <= 1) return forgottenSoloCamera(names[0] || title, place);
  if (/\bJACK\b/.test(t) && /\bHORN\b/.test(t) && /\bSAX/.test(t)) {
    return defaultMusicVideoGroupStaging(
      names,
      place,
      `${MUSIC_VIDEO_CAMERAS["wide-three"]} JACK GHOST centre, empty hands. HORN and SAXOPHONE either side.`,
      { nameInstruments: true },
    );
  }
  if (/\bJACK\b/.test(t) && /\bHORN\b/.test(t)) {
    return defaultMusicVideoGroupStaging(
      names,
      place,
      `${MUSIC_VIDEO_CAMERAS["ots-two"]} Look past JACK GHOST at HORN and the muted trumpet.`,
      { nameInstruments: true },
    );
  }
  if (/\bJACK\b/.test(t) && /\bSAX/.test(t)) {
    return defaultMusicVideoGroupStaging(
      names,
      place,
      `${MUSIC_VIDEO_CAMERAS.medium} JACK GHOST half turned. SAXOPHONE holds the sax.`,
      { nameInstruments: true },
    );
  }
  if (/\bHORN\b/.test(t) && /\bSAX/.test(t)) {
    return defaultMusicVideoGroupStaging(
      names,
      place,
      `${MUSIC_VIDEO_CAMERAS["ots-two"]} Look past HORN at SAXOPHONE. Horn section only.`,
      { nameInstruments: true },
    );
  }
  return defaultMusicVideoGroupStaging(names, place, MUSIC_VIDEO_CAMERAS.medium, {
    nameInstruments: true,
  });
}

/** Rewrite Position after Add cast so the still names everyone on the card. */
/**
 * Adding someone to a plate used to overwrite the shot title with the joined
 * cast list, so "SHOT 03 — Dazza" (or a Title: line straight from the script)
 * silently became "Ranger Bazza, Shazza". The title is the director's, and it
 * is not only cosmetic — orderedJobClips names the exported mp4s from it, so a
 * rename changed the filenames in the clips zip too.
 *
 * Keep whatever the shot is called. The only title we still rewrite is one we
 * wrote ourselves: an empty title, or one that is exactly the old cast list,
 * which keeps auto-named plates in step as people come and go.
 */
export function titleAfterAddCast(opts: {
  current?: string;
  previousCast: string[];
  nextCast: string[];
}): string {
  const roll = (names: string[]) =>
    [...new Set(names.map((n) => n.trim()).filter(Boolean))].join(", ");
  const current = (opts.current || "").trim();
  const next = roll(opts.nextCast);
  if (!current) return next || current;
  const was = roll(opts.previousCast);
  if (was && current.toLowerCase() === was.toLowerCase()) return next || current;
  return current;
}

export function stagingAfterAddCast(opts: {
  styleId?: string;
  speakers: string[];
  placeName: string;
  previous?: string;
  soloStaging: (speaker: string) => string;
}): string {
  const names = uniqueCastNames(opts.speakers);
  const prev = (opts.previous || "").trim();
  // Empty-stage establishing text says "No people. No faces." Keeping it
  // when Shazza steps onto the card is how the model invented a stranger.
  const keepPrev = Boolean(prev) && !isEmptyStageStaging(prev);
  if (names.length <= 1) {
    if (keepPrev) return prev;
    return opts.soloStaging(names[0] || "");
  }
  if (opts.styleId === "music_video") {
    return defaultMusicVideoGroupStaging(names, opts.placeName);
  }
  const who = rollCall(names);
  return `${who}. Only ${who} in frame, no one else appears. Exactly ${names.length} people. Empty hands unless Position already named a held object.`;
}
