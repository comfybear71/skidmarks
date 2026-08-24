/**
 * Music-video group plates — last-night lock, reused on FORGOTTEN.
 *
 * 2–3 people on a still. Never the whole band. Who is named is who is drawn.
 * Instruments only when Position names them (HORN / SAX / GUITAR / DRUMMER).
 * Jack Ghost keeps empty hands. No extras. No character-plate sheets.
 */

export const MUSIC_VIDEO_GROUP_MAX = 3;

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
  "THE JACK ASH BAND — FORGOTTEN. Waking up in hell, then slowly forgetting your name. Muted trumpet, dark Arabic scale, 12-string drone. Jack Ghost empty-handed. Horn plays the muted trumpet. Not a talking episode. Not Little Red. Not HYBRID cartoon-on-photoreal.";

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
): string {
  const names = clampMusicVideoGroup(speakers);
  const place = placeName.trim() || "the stage";
  const who = rollCall(names);
  const props = names
    .map((n) => {
      const held = namedInstrumentFor(n);
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
    const visual =
      "static camera, cheap two-shot. JACK GHOST lost, boots in the dirt, empty hands. HORN plays the muted trumpet, snaking Middle Eastern melody. Not a selfie. Not a lineup.";
    out.push({
      speakers: speakers2,
      title: `${jack} + ${horn}`,
      budget: "CHEAP_TAKE",
      visual,
      summary: `[BUDGET_TIER] CHEAP_TAKE. [VISUAL_ACTION] ${visual}`,
      staging: defaultMusicVideoGroupStaging(speakers2, place, visual),
    });
  }

  if (jack && sax) {
    const speakers2 = [jack, sax];
    const visual =
      "static camera, cheap two-shot. JACK GHOST half turned, mouth closed. SAXOPHONE holds the sax. Eyes not on camera. Not a selfie.";
    out.push({
      speakers: speakers2,
      title: `${jack} + ${sax}`,
      budget: "CHEAP_TAKE",
      visual,
      summary: `[BUDGET_TIER] CHEAP_TAKE. [VISUAL_ACTION] ${visual}`,
      staging: defaultMusicVideoGroupStaging(speakers2, place, visual),
    });
  }

  if (horn && sax) {
    const speakers2 = [horn, sax];
    const visual =
      "static camera, cheap two-shot. Horn section only. HORN muted trumpet. SAXOPHONE sax. No singer. No extras.";
    out.push({
      speakers: speakers2,
      title: `${horn} + ${sax}`,
      budget: "CHEAP_TAKE",
      visual,
      summary: `[BUDGET_TIER] CHEAP_TAKE. [VISUAL_ACTION] ${visual}`,
      staging: defaultMusicVideoGroupStaging(speakers2, place, visual),
    });
  }

  if (jack && horn && sax) {
    const speakers3 = [jack, horn, sax];
    const visual =
      "three people only. JACK GHOST centre, empty hands, cannot remember his name. HORN and SAXOPHONE either side with their named horns. Wall of blurred mirrors or sulfur red sky already in the place. Static camera. Not five of the band. Not a selfie.";
    out.push({
      speakers: speakers3,
      title: `${jack} + ${horn} + ${sax}`,
      budget: "EXPENSIVE_TAKE",
      visual,
      summary: `[BUDGET_TIER] EXPENSIVE_TAKE. [VISUAL_ACTION] ${visual}`,
      staging: defaultMusicVideoGroupStaging(speakers3, place, visual),
    });
  }

  return out;
}

/** Rewrite Position after Add cast so the still names everyone on the card. */
export function stagingAfterAddCast(opts: {
  styleId?: string;
  speakers: string[];
  placeName: string;
  previous?: string;
  soloStaging: (speaker: string) => string;
}): string {
  const names = uniqueCastNames(opts.speakers);
  if (names.length <= 1) {
    const prev = (opts.previous || "").trim();
    if (prev) return prev;
    return opts.soloStaging(names[0] || "");
  }
  if (opts.styleId === "music_video") {
    return defaultMusicVideoGroupStaging(names, opts.placeName);
  }
  const who = rollCall(names);
  return `${who}. Only ${who} in frame, no one else appears. Exactly ${names.length} people. Empty hands unless Position already named a held object.`;
}
