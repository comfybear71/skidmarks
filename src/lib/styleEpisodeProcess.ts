/**
 * One start-to-finish process for the five ship looks.
 * Deep fake is out. Music video shares the same CAST → places → lock →
 * plates → Generate spine; TRACK / lyrics replace the talking script box.
 * Finish is ordered unstitched mp4s (shot/beat order, or song-clock order).
 * Stitch is out — it is unreliable and is not a step in any ship look.
 *
 * Style differences live here so Sunny does not get a 9-act spine,
 * Skidmarks does not get a 4-shot gag, and Photoreal does not get cel.
 *
 * Does not mint jobs. Does not rewrite a live pack. Seeding is names only.
 */

import { skidmarksBlankFromJob } from "./scriptBlueprint";
import {
  SHOW_STYLE_PRESETS,
  getShowStylePreset,
  type ShowStyleId,
} from "./showStylePresets";

export const FIVE_SHIP_STYLE_IDS = [
  "skidmarks",
  "sunny_banks",
  "doc",
  "music_video",
  "photoreal",
] as const;

export type FiveShipStyleId = (typeof FIVE_SHIP_STYLE_IDS)[number];

export function isFiveShipStyle(id: string): id is FiveShipStyleId {
  return (FIVE_SHIP_STYLE_IDS as readonly string[]).includes(id);
}

/** Talking desk vs song TRACK — the only fork after Start. */
export function styleUsesSongTrack(styleId: ShowStyleId): boolean {
  return styleId === "music_video";
}

/** Every ship look stops here. Do not concat. Play the mp4s in order. */
export const STYLE_FINISH_UNSTITCHED = true;

/** New-from-this-cast. Music video still uses a saved band. */
export function canReuseCastForNewEpisode(styleId: string | undefined): boolean {
  const id = (styleId || "").trim();
  return (
    id === "skidmarks" ||
    id === "sunny_banks" ||
    id === "doc" ||
    id === "photoreal"
  );
}

export function productionShowLabel(styleId: ShowStyleId): string {
  return getShowStylePreset(styleId).label;
}

/**
 * Names only — no faces, no stills, no folderName.
 * Sunny gets the locked ensemble. Other talking shows get places, not
 * role words like "Arsehole" or "Cast".
 */
export function styleStartRoster(styleId: ShowStyleId): {
  speakers: string[];
  placeNames: string[];
} {
  const preset = getShowStylePreset(styleId);
  if (styleId === "sunny_banks") {
    return {
      speakers: preset.presetCast.map((c) => c.name),
      placeNames: preset.presetPlaces.map((p) => p.name),
    };
  }
  if (styleId === "skidmarks" || styleId === "doc" || styleId === "photoreal") {
    return {
      speakers: [],
      placeNames: preset.presetPlaces.map((p) => p.name),
    };
  }
  return { speakers: [], placeNames: [] };
}

const SHOT_SHELL = (n: number, place: string, title = "", extra = ""): string =>
  [
    `--- SHOT ${n} ---`,
    `Place: ${place}`,
    `Title: ${title}`,
    "Action: ",
    "Plate: ",
    extra,
  ]
    .filter((line) => line !== "")
    .join("\n");

function header(title: string, gag: string): string {
  return [`EPISODE: ${title}`, `GAG: ${gag}`].join("\n");
}

function jobTitle(job: {
  prompt: string;
  artist?: string;
  songTitle?: string;
}): { title: string; gag: string } {
  const vibe = (job.prompt || "").trim();
  const artist = (job.artist || "").trim();
  const song = (job.songTitle || "").trim();
  const credit = [artist, song].filter(Boolean).join(" — ");
  return {
    title: credit || vibe.split(/\n/)[0]?.slice(0, 80) || "Untitled episode",
    gag: credit
      ? [vibe, `Artist: ${artist || "—"}`, `Song: ${song || "—"}`].filter(Boolean).join("\n")
      : vibe,
  };
}

function placesOf(job: { scenes: { placeName: string }[] }): string[] {
  return job.scenes.map((s) => (s.placeName || "").trim()).filter(Boolean);
}

/** Blank the director / AI fills. Same field names, different shape per look. */
export function styleEpisodeBlank(job: {
  prompt: string;
  speakers: string[];
  scenes: { placeName: string }[];
  artist?: string;
  songTitle?: string;
  styleId?: ShowStyleId;
}): string {
  const styleId = job.styleId;
  const { title, gag } = jobTitle(job);
  const places = placesOf(job);

  if (styleId === "skidmarks") {
    return skidmarksBlankFromJob(job);
  }

  if (styleId === "sunny_banks") {
    const p1 = places[0] || "Caravan park";
    const p2 = places[1] || places[0] || "Ranger office";
    const p3 = places[2] || places[0] || "BBQ shelter";
    const nanPlace =
      places.find((n) => /nan/i.test(n)) || places[places.length - 1] || "Nan's site";
    return [
      header(title, gag),
      "",
      SHOT_SHELL(1, p1, "Stupid problem"),
      "",
      SHOT_SHELL(2, p2, "Insane fix"),
      "",
      SHOT_SHELL(3, p3, "Escalate"),
      "",
      SHOT_SHELL(4, nanPlace, "Nan button"),
    ].join("\n");
  }

  if (styleId === "doc") {
    const p = (i: number, fallback: string) => places[i] || places[0] || fallback;
    return [
      header(title, gag),
      "",
      SHOT_SHELL(1, p(0, "Interview room"), "Hook"),
      "",
      SHOT_SHELL(2, p(1, "Interview room"), "Witness"),
      "",
      SHOT_SHELL(3, p(2, "Interview room"), "Turn"),
      "",
      SHOT_SHELL(4, p(3, "Interview room"), "Sting"),
    ].join("\n");
  }

  if (styleId === "photoreal") {
    const shots = (places.length ? places : ["Location"]).map((place, i) =>
      SHOT_SHELL(i + 1, place, ""),
    );
    return [header(title, gag), "", shots.join("\n\n")].join("\n\n");
  }

  const shots = places.map((place, i) => SHOT_SHELL(i + 1, place));
  return [header(title, gag), "", ...shots].join("\n\n");
}

/** /m AI the story — one box, this look's layout only. */
export function styleEpisodeAssistRules(styleId: ShowStyleId): string {
  const label = getShowStylePreset(styleId).label;
  const shared = `WRITE: the whole episode document for ${label}.
- Output ONLY the episode. No markdown commentary. No preamble.
- Use ONLY the locked cast names. Do not invent people.
- Every Place: must be one of the locked places, spelled exactly.
- Held props only if the draft already names them. Default empty hands, no phone.
- If the box already has a draft, refine it. Do not throw a working draft away unless it is an empty template.
- No [VISUAL]. No [SPEECH]. No lip-sync lead.`;

  if (styleId === "skidmarks") {
    return `${shared}
- Fill the MASTER EPISODE CONSTRUCTION TEMPLATE already in the box (nine ACTS).
- Do not rewrite it as a 4-shot gag. Do not copy a fairy tale or a wolf.
- CHEAP_TAKE [VISUAL_ACTION] is a sitting talking-head — face and upper chest, facing camera, empty hands.
- [DIAL] is who speaks and the line. [SFX] / [MUSIC] / [CUTAWAY] or blank.`;
  }

  if (styleId === "sunny_banks") {
    return `${shared}
- This is ONE gag: exactly four --- SHOT --- blocks. Not a 9-act spine. Not a full feature.
- Shots 1–3: exactly THREE spoken lines each. Shot 4: Nan ONLY, ONE line (the button).
- Nuggets lines are phonetic alien gibberish.
- Layout: EPISODE: / GAG: / --- SHOT n --- / Place: / Title: / Action: / Plate: / NAME / line.`;
  }

  if (styleId === "doc") {
    return `${shared}
- Talking-head documentary shape: Hook → Witness → Turn → Sting. Four --- SHOT --- blocks.
- Not the Skidmarks nine-act spine. Not a Sunny Banks park gag.
- Interview MCU. Physical cues, not "he feels sad".
- Layout: EPISODE: / GAG: / --- SHOT n --- / Place: / Title: / Action: / Plate: / NAME / line.`;
  }

  if (styleId === "photoreal") {
    return `${shared}
- Cinematic photoreal talking plates. Not cartoon. Not cel. Not a 4-shot park gag.
- Not the Skidmarks nine-act spine unless the box already is that template.
- Layout: EPISODE: / GAG: / --- SHOT n --- / Place: / Title: / Action: / Plate: / NAME / line.
- You may add more shots at the same Place when the vibe needs length.`;
  }

  if (styleId === "music_video") {
    return `${shared}
- This box is not the song. Lyrics and the mp3 live on TRACK.
- Do not write a comedy gag or a 9-act spine.
- If you must output shots: performance MCU, no crowd, instruments only when Position names them.`;
  }

  return `${shared}
- Layout: EPISODE: / GAG: / --- SHOT n --- / Place: / Title: / Action: / Plate: / NAME / line.`;
}

/** Every ship look is in SHOW_STYLE_PRESETS — used by the check script. */
export function fiveShipStyleRows(): { id: FiveShipStyleId; label: string }[] {
  return FIVE_SHIP_STYLE_IDS.map((id) => ({
    id,
    label: SHOW_STYLE_PRESETS.find((p) => p.id === id)?.label || id,
  }));
}
