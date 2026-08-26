/**
 * Sunny Banks create-episode card — series machine, not a vibe box.
 * Names and aliases only. Does not mint jobs.
 */
function placeKey(name: string): string {
  return name
    .replace(/^(int|ext)\.\s*/i, "")
    .replace(/\s+-\s+(day|night|dawn|dusk|evening|morning|later|continuous|same).*$/i, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export const SUNNY_SERIES_NAMES = [
  "Dazza",
  "Shazza",
  "Nuggets",
  "Nan",
  "Ranger Bazza",
  "The Unit 4s",
] as const;

/** Script names that are the same person as a plated series regular. */
const SUNNY_NAME_ALIASES: Record<string, string> = {
  "ranger dan": "Ranger Bazza",
  "ranger bazza": "Ranger Bazza",
  bazza: "Ranger Bazza",
  dan: "Ranger Bazza",
  "the unit 4s": "The Unit 4s",
  "unit 4s": "The Unit 4s",
  "unit 4": "The Unit 4s",
  "alien 1": "The Unit 4s",
  "alien 2": "The Unit 4s",
  aliens: "The Unit 4s",
  dazza: "Dazza",
  shazza: "Shazza",
  nuggets: "Nuggets",
  nan: "Nan",
};

export const SUNNY_CAMERAS = [
  "tight close-up",
  "medium close-up",
  "three-quarter",
  "wide",
  "over-shoulder",
  "over-shoulder two-shot",
  "wide three-shot",
  "sitting",
  "looking down",
  "looking up",
] as const;

export function sunnyNameKey(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Ranger Dan → Ranger Bazza. Unknown names stay as written. */
export function canonicalSunnyName(name: string): string {
  const raw = name.trim().replace(/\s*\([^)]*\)\s*$/, "").trim();
  if (!raw) return "";
  const hit = SUNNY_NAME_ALIASES[sunnyNameKey(raw)];
  return hit || raw;
}

export function isSunnySeriesName(name: string): boolean {
  const canon = canonicalSunnyName(name);
  return SUNNY_SERIES_NAMES.some((n) => sunnyNameKey(n) === sunnyNameKey(canon));
}

/** Crowd / animal / prop / costume — not a face we must hold. */
export function isSunnyExtraName(name: string): boolean {
  const k = sunnyNameKey(canonicalSunnyName(name));
  if (!k || k === "none") return true;
  if (/resident/.test(k)) return true;
  if (/^(the )?bush turkeys?$/.test(k) || /^turkeys?$/.test(k)) return true;
  if (/foam monster/.test(k)) return true;
  if (/discarded manuals?/.test(k) || k === "manuals") return true;
  if (/^(crowd|extras|background)$/.test(k)) return true;
  return false;
}

export const SUNNY_MAX_FACES = 3;

export type SunnyEpisodeScan = {
  title: string;
  gag: string;
  speakers: string[];
  places: string[];
  guests: string[];
  unknownPlaces: string[];
  overcastShots: string[];
};

const SKIP_FIELD = /^(place|title|action|plate|cast|sfx|gag|episode|camera|name):/i;

function keepSunnyName(raw: string): string {
  const n = canonicalSunnyName(raw);
  if (!n || /^none$/i.test(n)) return "";
  return n;
}

/** Read names and places from a pasted --- SHOT --- script. Does not lock. */
export function scanSunnyEpisodeScript(raw: string): SunnyEpisodeScan {
  const text = (raw || "").trim();
  const title = text.match(/^EPISODE:\s*(.+)$/im)?.[1]?.trim() || "";
  const gag = text.match(/^GAG:\s*(.+)$/im)?.[1]?.trim() || "";
  const speakers = new Set<string>();
  const places = new Set<string>();
  const overcastShots: string[] = [];

  const headers = [...text.matchAll(/---\s*SHOT(?:\s+(\d+[A-Za-z]*))?\s*---/gi)];
  const parts = text.split(/(?:^|\n)---\s*SHOT(?:\s+\d+[A-Za-z]*)?\s*---\s*/im).slice(1);
  for (const [i, block] of parts.entries()) {
    const people = new Set<string>();
    for (const line of block.split("\n").map((l) => l.trim()).filter(Boolean)) {
      const place = line.match(/^Place:\s*(.+)$/i);
      if (place) {
        places.add(place[1].trim());
        continue;
      }
      const cast = line.match(/^Cast:\s*(.+)$/i);
      if (cast) {
        for (const name of cast[1].split(/,|&|\//)) {
          const n = keepSunnyName(name);
          if (n && !isSunnyExtraName(n)) {
            speakers.add(n);
            people.add(n);
          }
        }
        continue;
      }
      const named = line.match(/^Name:\s*(.+)$/i);
      if (named) {
        const n = keepSunnyName(named[1]);
        if (n && !isSunnyExtraName(n)) {
          speakers.add(n);
          people.add(n);
        }
        continue;
      }
      if (SKIP_FIELD.test(line) || /^\[[^\]]+\]/.test(line)) continue;
      const inline = line.match(/^([^:]{1,40}):\s+(.+)$/);
      if (inline && !SKIP_FIELD.test(`${inline[1]}:`)) {
        const n = keepSunnyName(inline[1]);
        if (n && !isSunnyExtraName(n)) {
          speakers.add(n);
          people.add(n);
        }
      }
    }
    if (people.size > SUNNY_MAX_FACES) {
      const shotNo = headers[i]?.[1] || String(i + 1);
      overcastShots.push(`SHOT ${shotNo} (${[...people].join(", ")})`);
    }
  }

  const guests = [...speakers].filter((n) => !isSunnySeriesName(n));
  return {
    title,
    gag,
    speakers: [...speakers],
    places: [...places],
    guests,
    unknownPlaces: [],
    overcastShots,
  };
}

/** Exact shelf spelling only. "Caravan Park Main Deck" is not "Caravan park". */
export function matchSunnyPlace<T extends { name: string }>(
  wanted: string,
  shelf: T[],
): T | null {
  const key = placeKey(wanted);
  if (!key) return null;
  return shelf.find((p) => placeKey(p.name) === key) || null;
}

export function sunnyEpisodeGate(opts: {
  brief: string;
  script: string;
  shelfPlaces: { name: string }[];
}): { ok: true; scan: SunnyEpisodeScan } | { ok: false; error: string; scan: SunnyEpisodeScan } {
  const brief = opts.brief.trim();
  const script = opts.script.trim();
  const scan = scanSunnyEpisodeScript(script);
  if (brief && !scan.gag) scan.gag = brief.split(/\n/)[0]?.trim() || brief;
  if (!script) {
    return { ok: false, error: "Paste the episode script.", scan };
  }
  if (!scan.places.length) {
    return { ok: false, error: "Need at least one --- SHOT --- with Place:.", scan };
  }
  const unknownPlaces = scan.places.filter((p) => !matchSunnyPlace(p, opts.shelfPlaces));
  scan.unknownPlaces = unknownPlaces;
  if (scan.overcastShots.length) {
    return {
      ok: false,
      error: `Max ${SUNNY_MAX_FACES} people on a plate: ${scan.overcastShots.join("; ")}.`,
      scan,
    };
  }
  return { ok: true, scan };
}

export const SUNNY_EPISODE_BLANK = `EPISODE: 
GAG: 

--- SHOT 1 ---
Title: 
Place: 
Cast: 
Camera: 
Plate: 
Name: 
[]
`;
