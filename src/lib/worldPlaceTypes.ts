/** Six shared place-type headings — style only changes render look. */
export type WorldPlaceTypeId =
  | "natural_wild"
  | "social_public"
  | "domestic_private"
  | "historic_sacred"
  | "urban_industrial"
  | "speculative_unreal";

export type WorldPlaceType = {
  id: WorldPlaceTypeId;
  name: string;
  brief: string;
};

export const WORLD_PLACE_TYPES: WorldPlaceType[] = [
  {
    id: "natural_wild",
    name: "Natural & wild",
    brief: "Beach, desert, forest, coast, open sky",
  },
  {
    id: "social_public",
    name: "Social & public",
    brief: "Pub, cafe, shop, stadium, street market",
  },
  {
    id: "domestic_private",
    name: "Domestic & private",
    brief: "House, kitchen, lounge, hotel room",
  },
  {
    id: "historic_sacred",
    name: "Historic & sacred",
    brief: "Pyramid, ruins, temple, castle, museum",
  },
  {
    id: "urban_industrial",
    name: "Urban & industrial",
    brief: "Street, office, factory, car park, alley",
  },
  {
    id: "speculative_unreal",
    name: "Speculative & unreal",
    brief: "Mars, hell, void, space station, dream space",
  },
];

export function worldPlaceTypeById(id: string): WorldPlaceType | undefined {
  return WORLD_PLACE_TYPES.find((t) => t.id === id);
}

export function parsePlacePromptLabel(prompt: string): {
  name: string;
  brief: string;
} {
  const dash = prompt.indexOf(" — ");
  if (dash === -1) {
    const trimmed = prompt.trim();
    const dot = trimmed.indexOf(". ");
    if (dot > 0 && dot < 80) {
      return { name: trimmed.slice(0, dot), brief: trimmed.slice(dot + 2, 120) };
    }
    return { name: trimmed.slice(0, 48) || "Place", brief: trimmed.slice(0, 120) };
  }
  return {
    name: prompt.slice(0, dash).trim(),
    brief: prompt.slice(dash + 3).trim().slice(0, 120),
  };
}
