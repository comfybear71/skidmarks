import {
  CRASH_SHOW_STYLE_EVENT,
  CRASH_SHOW_STYLE_CLEAR_EVENT,
  CRASH_SCRIPT_FIELDS_EVENT,
} from "./crashStyleSync";
import { SCRIPT_FIELDS_KEY } from "./crashScriptFields";

/** Which show / render recipe is locked for this Crash Lab session. */
export type ShowStyleId =
  | "skidmarks"
  | "sunny_banks"
  | "doc"
  | "music_video"
  | "deepfake"
  | "photoreal";

export type PresetCharacter = {
  id: string;
  name: string;
  rule: string;
  lookHint: string;
};

export type PresetPlace = {
  id: string;
  name: string;
  hint: string;
};

export type ShowStylePreset = {
  id: ShowStyleId;
  label: string;
  tagline: string;
  /** Plain-English blurb on the style card */
  description: string;
  /** Locked render / plate line for Image gen + plates */
  lookPrompt: string;
  /** Cartoon ←→ photo default for Image gen slider */
  defaultRealism: number;
  /** arsehole = one victim lock · ensemble = fixed cast roster */
  characterMode: "arsehole" | "ensemble";
  presetCast: PresetCharacter[];
  /** Placeholder BG slots — drop PNGs in data/crash/placeholders/{id}/places/ */
  presetPlaces: PresetPlace[];
  /** 9-stage Skidmarks spine vs gag-pack shows */
  hasStorySpine: boolean;
  storyNote: string;
};

const SKIDMARKS_LOOK =
  "highly detailed stylised 3D animated feature render, clean simplified forms, believable materials, soft overcast lighting, shallow depth of field, cinematic quality, sharp focus. Not photographic, not a cartoon";

const SUNNY_LOOK =
  "rubbery adult cartoon, thick black outlines, flat cel colour, big heads, noodly arms, sun-bleached Aussie palette, dusty ochre, faded teal, washed-out yellow, heat haze";

export const SHOW_STYLE_PRESETS: ShowStylePreset[] = [
  {
    id: "skidmarks",
    label: "Skidmarks",
    tagline: "Stylised 3D · arsehole gets smashed",
    description:
      "English/Aussie nasty comedy. One arsehole per episode — fake win, then smashed. Stylised 3D feature look, not photo, not cartoon.",
    lookPrompt: SKIDMARKS_LOOK,
    defaultRealism: 60,
    characterMode: "arsehole",
    presetCast: [
      {
        id: "arsehole",
        name: "Arsehole",
        rule: "Real person drawn from life — gets the fake win then smashed",
        lookHint: "Character Lab → New arsehole → Gen face lock",
      },
    ],
    presetPlaces: [
      {
        id: "dirty_dog_pub",
        name: "Dirty Dog Pub",
        hint: "English pub interior — wet cast iron stools, sticky carpet, grey daylight through windows",
      },
      {
        id: "suburban_street",
        name: "Suburban street",
        hint: "Overcast English high street — kerbs, shop fronts, parked cars, mown grass verges",
      },
      {
        id: "wake_house",
        name: "Wake house",
        hint: "Front room after a funeral — sandwiches, folding chairs, grey daylight",
      },
      {
        id: "bus_terminal",
        name: "Bus terminal",
        hint: "Concrete bus station — plastic seats, timetable board, overcast sky",
      },
      {
        id: "hell_cellar",
        name: "Hell cellar",
        hint: "Stone cellar — candles, damp walls, mean shadow, no people",
      },
    ],
    hasStorySpine: true,
    storyNote: "9-stage spine — same path every episode",
  },
  {
    id: "sunny_banks",
    label: "Sunny Banks",
    tagline: "Cel cartoon · park gag engine",
    description:
      "Rubbery adult cartoon at a caravan park. Same cast every gag — stupid problem, insane fix, Nan’s one line, credits.",
    lookPrompt: SUNNY_LOOK,
    defaultRealism: 25,
    characterMode: "ensemble",
    presetCast: [
      {
        id: "dazza",
        name: "Dazza",
        rule: "Can solve anything. Reaches for violence or beer first.",
        lookHint: "Singlet, mullet, thongs, ray-gun junk inventions",
      },
      {
        id: "shazza",
        name: "Shazza",
        rule: "Knows everything about everyone, and will use it.",
        lookHint: "Leopard print, high pony, permanent dart",
      },
      {
        id: "nuggets",
        name: "Nuggets",
        rule: "Goes along with it, complains, secretly loves it.",
        lookHint: "Skinny teen, servo pie permanently in hand",
      },
      {
        id: "unit4",
        name: "The Unit 4s",
        rule: "Desperate to blend in. Researched Australia from 1987 tourism footage.",
        lookHint: "Two purple aliens, thongs on hands, bucket hat",
      },
      {
        id: "bazza",
        name: "Ranger Bazza",
        rule: "Enforces rules he invented. Ignores actual crimes in front of him.",
        lookHint: "Khaki too tight, wraparound sunnies, clipboard",
      },
      {
        id: "nan",
        name: "Nan",
        rule: "Unbothered. By anything. Including the invasion.",
        lookHint: "Housecoat, slippers, tea, cricket bat — last line every ep",
      },
    ],
    presetPlaces: [
      {
        id: "caravan_park",
        name: "Caravan park",
        hint: "Rows of caravans and awnings — dusty ochre, heat haze, faded teal accents",
      },
      {
        id: "unit_9",
        name: "Unit 9",
        hint: "Dazza's annex — junk inventions, beer cans, singlet on the line",
      },
      {
        id: "ranger_office",
        name: "Ranger office",
        hint: "Park office — khaki clutter, rules on wall, wraparound sunnies on desk",
      },
      {
        id: "bbq_shelter",
        name: "BBQ shelter",
        hint: "Gas bottles, plastic chairs, faded umbrella, sausage smoke",
      },
      {
        id: "amenities",
        name: "Amenities block",
        hint: "Coin laundry, faded teal tiles, vending machine, harsh fluorescent",
      },
      {
        id: "nan_site",
        name: "Nan's site",
        hint: "Housecoat on peg, cricket bat by chair, tea cup, unbothered clutter",
      },
    ],
    hasStorySpine: false,
    storyNote: "Gag shape: problem → insane solution → escalate → Nan one line → credits",
  },
  {
    id: "doc",
    label: "Documentary",
    tagline: "Talking heads · real-ish",
    description:
      "Interview and witness framing. Natural light, believable faces. Hook → witness → turn → sting.",
    lookPrompt:
      "documentary interview framing, natural available light, shallow depth of field, handheld feel, believable skin and fabric",
    defaultRealism: 75,
    characterMode: "ensemble",
    presetCast: [
      {
        id: "presenter",
        name: "Presenter / subject",
        rule: "Who is on camera and why we believe them",
        lookHint: "One lock per person — Character Lab",
      },
    ],
    presetPlaces: [
      {
        id: "interview_room",
        name: "Interview room",
        hint: "Neutral wall, soft window light, empty chair facing camera",
      },
    ],
    hasStorySpine: false,
    storyNote: "Beat sheet: hook → witness → turn → sting",
  },
  {
    id: "music_video",
    label: "Music video",
    tagline: "Performance · cut rhythm",
    description:
      "Performance-led cuts. Bold grade, hero performer lock, sections follow the song.",
    lookPrompt:
      "music video cinematography, bold colour grade, performance lighting, stylised but not cartoon",
    defaultRealism: 50,
    characterMode: "ensemble",
    presetCast: [
      {
        id: "artist",
        name: "Artist / performer",
        rule: "Who is on mic or in frame",
        lookHint: "Hero lock + wardrobe line",
      },
    ],
    presetPlaces: [
      {
        id: "performance_set",
        name: "Performance set",
        hint: "Bold lit stage or location — hero framing, empty of crowd",
      },
    ],
    hasStorySpine: false,
    storyNote: "Sections map to song structure — verse / chorus / bridge",
  },
  {
    id: "deepfake",
    label: "Deep fake",
    tagline: "Face swap · must match source photo",
    description:
      "Not AI-invented faces — locked identity from YOUR reference still. Swap pass (FaceFusion / DeepFaceLab) required. Plate together is blocking only.",
    lookPrompt:
      "photographic portrait lighting, believable skin pores, slight uncanny smoothness, locked identity",
    defaultRealism: 100,
    characterMode: "ensemble",
    presetCast: [
      {
        id: "face_lock",
        name: "Face lock",
        rule: "Identity source — one reference still per person",
        lookHint: "Reference still in Image gen → tweak chain",
      },
    ],
    presetPlaces: [
      {
        id: "plate_bg",
        name: "Plate background",
        hint: "Empty photographic location matching the swap",
      },
    ],
    hasStorySpine: false,
    storyNote: "Shot list + line list — no Skidmarks spine",
  },
  {
    id: "photoreal",
    label: "Photoreal",
    tagline: "Near-camera · no cartoon",
    description:
      "Cinematic photoreal stills. Named cast, standard script breakdown — not the Skidmarks spine.",
    lookPrompt:
      "photorealistic cinematic still, natural materials, accurate lighting, shallow depth of field, sharp focus",
    defaultRealism: 90,
    characterMode: "ensemble",
    presetCast: [
      {
        id: "cast",
        name: "Cast",
        rule: "Named people every time",
        lookHint: "Character Lab locks",
      },
    ],
    presetPlaces: [
      {
        id: "location",
        name: "Location",
        hint: "Empty establishing plate — materials and light named",
      },
    ],
    hasStorySpine: false,
    storyNote: "Standard script breakdown — not Skidmarks spine",
  },
];

export const DEFAULT_SHOW_STYLE: ShowStyleId = "skidmarks";

export const SHOW_STYLE_STORAGE_KEY = "crashlab-show-style";
export const GEN_REALISM_STORAGE_KEY = "crashlab-gen-realism";

export function loadGenRealism(fallback = 60): number {
  try {
    const raw = localStorage.getItem(GEN_REALISM_STORAGE_KEY);
    if (raw != null) {
      const n = Number(raw);
      if (Number.isFinite(n)) return Math.max(0, Math.min(100, n));
    }
  } catch {
    /* ignore */
  }
  return fallback;
}

export function saveGenRealism(n: number): void {
  try {
    localStorage.setItem(GEN_REALISM_STORAGE_KEY, String(n));
  } catch {
    /* ignore */
  }
}

export function getShowStylePreset(id: ShowStyleId): ShowStylePreset {
  return (
    SHOW_STYLE_PRESETS.find((p) => p.id === id) ||
    SHOW_STYLE_PRESETS[0]
  );
}

export function loadShowStyleIdOptional(): ShowStyleId | null {
  try {
    const raw = localStorage.getItem(SHOW_STYLE_STORAGE_KEY);
    if (!raw || raw === "none") return null;
    if (SHOW_STYLE_PRESETS.some((p) => p.id === raw)) {
      return raw as ShowStyleId;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function loadShowStyleId(): ShowStyleId {
  return loadShowStyleIdOptional() ?? DEFAULT_SHOW_STYLE;
}

export function saveShowStyleId(id: ShowStyleId): void {
  try {
    localStorage.setItem(SHOW_STYLE_STORAGE_KEY, id);
    const raw = localStorage.getItem(SCRIPT_FIELDS_KEY);
    const prev = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    localStorage.setItem(
      SCRIPT_FIELDS_KEY,
      JSON.stringify({ ...prev, showStyle: id }),
    );
    window.dispatchEvent(
      new CustomEvent(CRASH_SHOW_STYLE_EVENT, {
        detail: { id, ts: Date.now() },
      }),
    );
    window.dispatchEvent(new CustomEvent(CRASH_SCRIPT_FIELDS_EVENT));
  } catch {
    /* ignore */
  }
}

export function clearShowStyleId(): void {
  try {
    localStorage.removeItem(SHOW_STYLE_STORAGE_KEY);
    const raw = localStorage.getItem(SCRIPT_FIELDS_KEY);
    if (raw) {
      const prev = JSON.parse(raw) as Record<string, unknown>;
      delete prev.showStyle;
      localStorage.setItem(SCRIPT_FIELDS_KEY, JSON.stringify(prev));
    }
    window.dispatchEvent(new CustomEvent(CRASH_SHOW_STYLE_CLEAR_EVENT));
    window.dispatchEvent(new CustomEvent(CRASH_SCRIPT_FIELDS_EVENT));
  } catch {
    /* ignore */
  }
}
