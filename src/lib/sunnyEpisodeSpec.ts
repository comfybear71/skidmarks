/**
 * Sunny Banks create-episode card — series machine, not a vibe box.
 * Names and aliases only. Does not mint jobs.
 */
import type { CrashStoryDoc } from "./crashStoryTypes";

export function placeKey(name: string): string {
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

/**
 * Cast:/Name: field → people. "Bubbles (Sludge Monster)" stays Bubbles.
 * "The Laundry Monster (Shazza and Nan in disguise)" also yields Shazza + Nan.
 */
export function splitSunnyCastField(raw: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (name: string) => {
    const n = keepSunnyName(name);
    if (!n) return;
    const k = sunnyNameKey(n);
    if (seen.has(k)) return;
    seen.add(k);
    out.push(n);
  };
  for (const part of String(raw || "").split(/,|&|\//)) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const paren = trimmed.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
    add(paren?.[1] || trimmed);
    if (paren) {
      const inner = paren[2].trim();
      if (/in disguise/i.test(inner) || /\band\b/i.test(inner)) {
        const cleaned = inner.replace(/\s+in disguise.*$/i, "");
        for (const bit of cleaned.split(/,|&|\band\b/i)) add(bit);
      }
    }
  }
  return out;
}

/** Crowd / animal / prop / costume — not a face we must hold. */
export function isSunnyExtraName(name: string): boolean {
  const k = sunnyNameKey(canonicalSunnyName(name));
  if (!k || k === "none") return true;
  if (/resident/.test(k)) return true;
  if (/^(the )?bush turkeys?$/.test(k) || /^turkeys?$/.test(k)) return true;
  if (/foam monster/.test(k)) return true;
  if (/laundry monster/.test(k)) return true;
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
  /** Shots with no plate plan — Make must not start. */
  blockedShots: string[];
  compositeCount: number;
  hangPlaceCount: number;
};

export type SunnyShotPlan = {
  shot: string;
  title: string;
  place: string;
  onCard: string[];
  plan: "composite" | "hang-place" | "blocked";
  blockers: string[];
};

/** One shot: who is on the card, or hang the place still. Does not draw. */
export function planSunnyShot(block: string, shotLabel: string): SunnyShotPlan {
  let title = "";
  let place = "";
  const named: string[] = [];
  for (const line of block.split("\n").map((l) => l.trim()).filter(Boolean)) {
    const t = line.match(/^Title:\s*(.+)$/i);
    if (t) {
      title = t[1].trim();
      continue;
    }
    const p = line.match(/^Place:\s*(.+)$/i);
    if (p) {
      place = p[1].trim();
      continue;
    }
    const cast = line.match(/^Cast:\s*(.+)$/i);
    if (cast) {
      named.push(...splitSunnyCastField(cast[1]));
      continue;
    }
    const nm = line.match(/^Name:\s*(.+)$/i);
    if (nm) {
      named.push(...splitSunnyCastField(nm[1]));
    }
  }
  const onCard: string[] = [];
  const seen = new Set<string>();
  for (const n of named) {
    if (!n || isSunnyExtraName(n)) continue;
    const k = sunnyNameKey(n);
    if (seen.has(k)) continue;
    seen.add(k);
    onCard.push(n);
  }
  const blockers: string[] = [];
  if (!place) blockers.push("need Place:");
  if (!onCard.length && !place) blockers.push("need a named person or a place still to hang");
  const plan: SunnyShotPlan["plan"] = blockers.length
    ? "blocked"
    : onCard.length
      ? "composite"
      : "hang-place";
  return { shot: shotLabel, title, place, onCard, plan, blockers };
}

export function planSunnyEpisodeShots(script: string): SunnyShotPlan[] {
  const text = String(script || "");
  const headers = [...text.matchAll(/---\s*SHOT(?:\s+(\d+[A-Za-z]*))?\s*---/gi)];
  const parts = text.split(/(?:^|\n)---\s*SHOT(?:\s+\d+[A-Za-z]*)?\s*---\s*/im).slice(1);
  return parts.map((block, i) =>
    planSunnyShot(block, `SHOT ${headers[i]?.[1] || String(i + 1)}`),
  );
}

const SKIP_FIELD = /^(place|title|action|plate|cast|sfx|gag|episode|camera|name):/i;

function keepSunnyName(raw: string): string {
  const n = canonicalSunnyName(raw);
  if (!n || /^none$/i.test(n)) return "";
  return n;
}

/** Parenthetical on Cast:/Name: — look words for a guest we have to draw. */
export function sunnyGuestLooksFromScript(raw: string): Record<string, string> {
  const looks: Record<string, string> = {};
  for (const line of (raw || "").split("\n")) {
    const field = line.match(/^(?:Cast|Name):\s*(.+)$/i);
    if (!field) continue;
    for (const part of field[1].split(/,|&|\//)) {
      const paren = part.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
      if (!paren) continue;
      const name = keepSunnyName(paren[1]);
      const look = paren[2].trim();
      if (!name || !look || isSunnyExtraName(name) || isSunnySeriesName(name)) continue;
      if (!looks[name]) looks[name] = look;
    }
  }
  return looks;
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
        for (const n of splitSunnyCastField(cast[1])) {
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
  const plans = planSunnyEpisodeShots(text);
  return {
    title,
    gag,
    speakers: [...speakers],
    places: [...places],
    guests,
    unknownPlaces: [],
    overcastShots,
    blockedShots: plans
      .filter((p) => p.blockers.length)
      .map((p) => `${p.shot}${p.title ? ` ${p.title}` : ""}: ${p.blockers.join("; ")}`),
    compositeCount: plans.filter((p) => p.plan === "composite").length,
    hangPlaceCount: plans.filter((p) => p.plan === "hang-place").length,
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

/**
 * Exact first, then containment either way so "Caravan Park Main Deck"
 * still finds the shelf card "Caravan park". Short keys under 4 letters
 * do not fuzzy-match.
 */
export function matchSunnyPlaceLoose<T extends { name: string }>(
  wanted: string,
  shelf: T[],
): T | null {
  const exact = matchSunnyPlace(wanted, shelf);
  if (exact) return exact;
  const key = placeKey(wanted);
  if (key.length < 4) return null;
  const hits = shelf.filter((p) => {
    const k = placeKey(p.name);
    if (!k || k.length < 4) return false;
    return key.includes(k) || k.includes(key);
  });
  hits.sort((a, b) => placeKey(b.name).length - placeKey(a.name).length);
  return hits[0] || null;
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
  if (scan.blockedShots.length) {
    return {
      ok: false,
      error: `Won't start. ${scan.blockedShots.length} shot${scan.blockedShots.length === 1 ? "" : "s"} have no plate plan: ${scan.blockedShots.join(" · ")}`,
      scan,
    };
  }

  const unknownPlaces = scan.places.filter((p) => !matchSunnyPlace(p, opts.shelfPlaces));
  scan.unknownPlaces = unknownPlaces;
  return { ok: true, scan };
}

/** Write Cast: names onto an already-parsed story so silent roster people stay on the plate. */
export function applySunnyScriptCastToStory(
  story: CrashStoryDoc,
  script: string,
): CrashStoryDoc {
  const byTitle = new Map<string, string[]>();
  const parts = String(script || "")
    .split(/(?:^|\n)---\s*SHOT(?:\s+\d+[A-Za-z]*)?\s*---\s*/im)
    .slice(1);
  for (const block of parts) {
    const title = block.match(/^Title:\s*(.+)$/im)?.[1]?.trim() || "";
    const castLine = block.match(/^Cast:\s*(.+)$/im)?.[1]?.trim() || "";
    const nameLine = block.match(/^Name:\s*(.+)$/im)?.[1]?.trim() || "";
    const unique: string[] = [];
    const seen = new Set<string>();
    for (const n of [...splitSunnyCastField(castLine), ...splitSunnyCastField(nameLine)]) {
      const k = sunnyNameKey(n);
      if (seen.has(k)) continue;
      seen.add(k);
      unique.push(n);
    }
    if (title && unique.length) byTitle.set(title.toLowerCase(), unique);
  }
  if (!byTitle.size) return story;
  return {
    ...story,
    scenes: story.scenes.map((sc) => ({
      ...sc,
      shots: sc.shots.map((sh) => {
        const cast = byTitle.get((sh.title || "").trim().toLowerCase());
        if (!cast?.length) return sh;
        const prefix = `Cast: ${cast.join(", ")}.`;
        const staging = String(sh.staging || "");
        return {
          ...sh,
          castNames: cast,
          staging: /^\s*cast:/i.test(staging) ? staging : `${prefix} ${staging}`.trim(),
        };
      }),
    })),
  };
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
