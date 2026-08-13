/**
 * Filename stems for cloud hydrate — plates, mp3s, mp4s, world cards.
 * EP01 uses plate_shower_S1_cake_tea.png + S1_cake_tea.mp4 + S01_cake_tea.mp3.
 */

const DROP = new Set([
  "plate",
  "preview",
  "previewplate",
  "cplate",
  "loc",
  "look",
  "v1",
  "v2",
  "v3",
  "mp3",
  "mp4",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "to",
  "the",
  "a",
  "on",
]);

export function humanMediaLabel(fileName: string): string {
  const base = String(fileName || "")
    .trim()
    .replace(/\.[^.]+$/, "");
  if (!base) return fileName || "";
  const stripped = base
    .replace(/^(preview_plate_|preview_|plate_|cplate_)/i, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return stripped.replace(/\b([a-z])/g, (ch) => ch.toUpperCase()) || base;
}

export function mediaTokens(fileName: string): string[] {
  const base = String(fileName || "")
    .replace(/\.[^.]+$/, "")
    .toLowerCase();
  const raw = base.split(/[^a-z0-9]+/).filter(Boolean);
  const out: string[] = [];
  for (const t of raw) {
    if (DROP.has(t)) continue;
    if (/^\d+$/.test(t) && t.length > 8) continue;
    out.push(t);
    const num = t.match(/^(?:l|d|s|h)?0*(\d+)$/i);
    if (num) out.push(num[1]);
  }
  return out;
}

export function mediaMatchScore(a: string, b: string): number {
  const ta = new Set(mediaTokens(a));
  const tb = mediaTokens(b);
  if (!ta.size || !tb.length) return 0;
  let n = 0;
  for (const t of tb) {
    if (ta.has(t)) n += t.length >= 3 ? 2 : 1;
  }
  return n;
}

/** Best unused candidate for `needle`, or null if too weak. */
export function pickBestMediaMatch(
  needle: string,
  candidates: string[],
  taken?: Set<string>,
  minScore = 3,
): string | null {
  let best: string | null = null;
  let bestScore = minScore - 1;
  for (const c of candidates) {
    if (taken?.has(c)) continue;
    const s = mediaMatchScore(needle, c);
    if (s > bestScore) {
      bestScore = s;
      best = c;
    }
  }
  return best;
}

export function isLtxDirectorName(fileName: string): boolean {
  return /LTX_Director/i.test(fileName);
}

/**
 * Attach pack mp4s to story beats for Animate / storyboard thumbs.
 * Named stems first (EP01 `plate_A_dark_sleep` → `A_dark_sleep.mp4`).
 * Comfy `ltx_*_LTX_Director_00012_.mp4` files have no plate tokens — fill
 * leftover plated beats in filename order (EP03/EP04).
 */
export function mapPackMp4sToBeats(
  beats: { beatId: string; plateFile?: string }[],
  mp4Filenames: string[],
): { beatId: string; file: string }[] {
  const mp4s = mp4Filenames.map((n) => String(n || "").trim()).filter(Boolean);
  const named = mp4s.filter((n) => !isLtxDirectorName(n));
  const director = mp4s
    .filter(isLtxDirectorName)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const taken = new Set<string>();
  const assigned = new Map<string, string>();

  for (const b of beats) {
    if (!b.plateFile?.trim()) continue;
    const unused = named.filter((n) => !taken.has(n));
    const hit = pickBestMediaMatch(b.plateFile, unused, undefined, 3);
    if (!hit) continue;
    taken.add(hit);
    assigned.set(b.beatId, hit);
  }

  const leftover = [...director, ...named].filter((n) => !taken.has(n));
  let i = 0;
  for (const b of beats) {
    if (assigned.has(b.beatId)) continue;
    if (b.beatId === "__intro__" || b.beatId === "__outro__") continue;
    if (!b.plateFile?.trim()) continue;
    const file = leftover[i++];
    if (!file) break;
    taken.add(file);
    assigned.set(b.beatId, file);
  }

  return [...assigned.entries()].map(([beatId, file]) => ({ beatId, file }));
}

const PLACE_HINTS: { tokens: string[]; files: string[] }[] = [
  { tokens: ["bedroom", "sleep", "sunrise", "wakes", "wake"], files: ["dap_bedroom.png"] },
  { tokens: ["house", "wreck", "shit"], files: ["dap_house_wreck.png"] },
  {
    tokens: [
      "street",
      "walk",
      "shops",
      "door",
      "invite",
      "stranger",
      "suitcase",
      "cash",
      "fuzz",
      "beating",
    ],
    files: [
      "street.png",
      "suburban_street_main.png",
      "loc_town_street_side_v1.png",
    ],
  },
  { tokens: ["kerb", "pavement", "whack"], files: ["pavement_whack.png", "pavement.png"] },
  {
    tokens: ["shower", "cake", "rummage", "larva", "brawl"],
    files: ["dap_house_wreck.png"],
  },
  { tokens: ["prison", "jail", "loom"], files: ["crack_house_basement.png"] },
  { tokens: ["judge", "court", "book"], files: ["back_room.png"] },
  { tokens: ["park"], files: ["park.png"] },
  { tokens: ["shop", "chip"], files: ["place_v3_shop_1786364984333.png"] },
];

/** World thumb keys (g:file) implied by plate names, if those WORLD files exist. */
export function inferWorldKeysFromPlates(
  plateFilenames: string[],
  worldFilenames: string[],
): string[] {
  const world = new Set(worldFilenames);
  const blob = plateFilenames.join(" ").toLowerCase();
  const out: string[] = [];
  const add = (file: string) => {
    if (!world.has(file)) return;
    const key = `g:${file}`;
    if (!out.includes(key)) out.push(key);
  };
  for (const hint of PLACE_HINTS) {
    if (!hint.tokens.some((t) => blob.includes(t))) continue;
    for (const f of hint.files) add(f);
  }
  for (const w of worldFilenames) {
    if (mediaMatchScore(w, blob) >= 4) add(w);
  }
  return out;
}
