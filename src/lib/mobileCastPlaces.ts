/**
 * Two-house plate bible. Cast goes to their rooms — not the first place
 * on the job. Jo Too later uses the same Jo-house shared rooms as Tee / BC / Ladder One.
 *
 * Jo house: cell (Jo only), upstairs lounge, pool.
 * 2nd house: front house, Land Lady / Comfy bedroom, donga, Matty's bar.
 * Everyone goes to Matty's bar except Jo.
 */
export type CastHouseId = "jo_house" | "second_house";

export type CastPlaceKind =
  | "jo_cell"
  | "jo_lounge"
  | "jo_pool"
  | "front_house"
  | "ll_bedroom"
  | "donga"
  | "matty_bar";

export type CastRosterTag =
  | "jo"
  | "jo_too"
  | "tee"
  | "bc"
  | "ladder"
  | "big_sexy"
  | "land_lady"
  | "comfy"
  | "matty";

export function classifyCastRoster(name: string): CastRosterTag | null {
  const n = name.trim().toLowerCase().replace(/[_-]+/g, " ");
  if (!n) return null;
  if (/\bjo\b/.test(n) && /\btoo\b/.test(n)) return "jo_too";
  if (/\btee\b/.test(n)) return "tee";
  if (/\bbc\b/.test(n)) return "bc";
  if (/\bladder\b/.test(n)) return "ladder";
  if (/\bbig sexy\b/.test(n) || /\bsexy\b/.test(n)) return "big_sexy";
  if (/land\s*lady/.test(n)) return "land_lady";
  if (/\bcomfy\b/.test(n)) return "comfy";
  if (/\bmatty\b/.test(n)) return "matty";
  if (/\bjo\b/.test(n)) return "jo";
  return null;
}

export function classifyCastPlace(placeName: string): CastPlaceKind | null {
  const n = placeName.trim().toLowerCase();
  if (!n) return null;
  if (/\bmatty/.test(n) && /\bbar\b/.test(n)) return "matty_bar";
  if (/\bdonga\b/.test(n)) return "donga";
  if (/\bpool\b/.test(n)) return "jo_pool";
  if (/\blounge\b/.test(n) || /\bupstairs\b/.test(n)) return "jo_lounge";
  if (/\bfront\b/.test(n) && /\bhouse\b/.test(n)) return "front_house";
  if (/\bfront house\b/.test(n) || /\bfront-house\b/.test(n)) return "front_house";
  if (/\bcell\b/.test(n)) return "jo_cell";
  if (/\bjo\b/.test(n) && /\bbed/.test(n)) return "jo_cell";
  if (/\bbed/.test(n) && !/\bjo\b/.test(n) && !/\bcell\b/.test(n)) return "ll_bedroom";
  return null;
}

/** Home rooms for this face. Shared Jo-house people never get the cell. */
export function castHomePlaces(tag: CastRosterTag): CastPlaceKind[] {
  if (tag === "jo") return ["jo_cell"];
  if (tag === "tee" || tag === "bc" || tag === "ladder" || tag === "jo_too") {
    return ["jo_lounge", "jo_pool"];
  }
  if (tag === "land_lady" || tag === "comfy") return ["ll_bedroom", "front_house"];
  if (tag === "big_sexy") return ["donga"];
  if (tag === "matty") return ["matty_bar"];
  return [];
}

export function castGoesToMattyBar(tag: CastRosterTag): boolean {
  return tag !== "jo";
}

export function castPlaceKindsFor(name: string): CastPlaceKind[] {
  const tag = classifyCastRoster(name);
  if (!tag) return [];
  const home = castHomePlaces(tag);
  if (castGoesToMattyBar(tag) && !home.includes("matty_bar")) home.push("matty_bar");
  return home;
}

export type CastPlaceScene = { id: string; placeName: string };

export function scenesForPlaceKind(
  scenes: CastPlaceScene[],
  kind: CastPlaceKind,
): CastPlaceScene[] {
  return scenes.filter((s) => classifyCastPlace(s.placeName) === kind);
}

export function firstSceneForPlaceKind(
  scenes: CastPlaceScene[],
  kind: CastPlaceKind,
): CastPlaceScene | null {
  return scenesForPlaceKind(scenes, kind)[0] || null;
}

export type MissingCastPlacePlate = {
  speaker: string;
  kind: CastPlaceKind;
  sceneId: string;
  placeName: string;
};

/** One card per face × their rooms that exist on this job. */
export function requiredCastPlacePlates(
  speakers: string[],
  scenes: CastPlaceScene[],
): MissingCastPlacePlate[] {
  const out: MissingCastPlacePlate[] = [];
  for (const speaker of speakers) {
    const name = speaker.trim();
    if (!name) continue;
    for (const kind of castPlaceKindsFor(name)) {
      const scene = firstSceneForPlaceKind(scenes, kind);
      if (!scene) continue;
      out.push({ speaker: name, kind, sceneId: scene.id, placeName: scene.placeName });
    }
  }
  return out;
}
