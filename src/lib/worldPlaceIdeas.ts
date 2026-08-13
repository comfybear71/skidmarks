import type { ShowStyleId } from "./showStylePresets";
import type { WorldPlaceTypeId } from "./worldPlaceTypes";

export const PLACE_SUFFIX =
  "Empty establishing plate, no people, no characters, wide shot, shallow depth of field, architecture and materials only, sharp focus";

const SK = "highly detailed stylised 3D animated feature render, clean simplified forms, believable materials, soft overcast lighting, cinematic quality. Not photographic, not a cartoon";
const SUNNY =
  "rubbery adult cartoon, thick black outlines, flat cel colour, sun-bleached Aussie palette, dusty ochre, heat haze";
const DOC = "documentary establishing still, genre-specific lighting, believable materials, interview-set realism without people";
const MV = "bold music-video colour grade, performance-stage or genre location energy, dramatic lighting, no performers on screen";
const DF = "photoreal empty location, natural daylight, believable materials, slight cinematic grade, no people";
const PR = "photoreal establishing still, natural overcast daylight, accurate materials, empty of people";

function row(name: string, detail: string, look: string): string {
  return `${name} — ${detail}. ${look}. ${PLACE_SUFFIX}`;
}

/** 6+ idea prompts per place type × show style — empty BG hunt. */
export const STYLE_WORLD_IDEAS: Record<
  ShowStyleId,
  Record<WorldPlaceTypeId, string[]>
> = {
  skidmarks: {
    natural_wild: [
      row("Overcast English beach", "wet shingle, grey sea, mown grass path, deserted", SK),
      row("Misty pine forest", "needle floor, grey trunks, soft fog between trees", SK),
      row("Snowy moorland track", "frozen puddles, brown heather, low cloud", SK),
      row("River bank weir", "wet limestone, slow brown water, reeds", SK),
      row("Cliff-top coast path", "chalk edge, wind-bent grass, grey horizon", SK),
      row("Flooded meadow", "mirror water, half-sunk fence posts, overcast sky", SK),
    ],
    social_public: [
      row("Dirty Dog Pub", "wet cast iron stools, sticky carpet, grey daylight through windows", SK),
      row("Greasy spoon cafe", "Formica tables, steam on windows, fluorescent tubes", SK),
      row("Village shop", "newspaper racks, linoleum floor, rain on glass door", SK),
      row("Community hall", "folding chairs stacked, village notice board, bare bulb", SK),
      row("Bookies shop front", "TV screens off, laminated odds sheets, empty counter", SK),
      row("Fish and chip shop", "stainless counter, fryer glow off, salt shaker on ledge", SK),
    ],
    domestic_private: [
      row("Council flat kitchen", "peeling laminate, mug on draining board, grey light", SK),
      row("Semi-detached lounge", "fake fireplace, floral sofa, net curtains", SK),
      row("Bedroom with unmade bed", "poster on wall, clothes on chair, overcast window", SK),
      row("Garage workshop", "oil stains, pegboard tools, half-open up-and-over door", SK),
      row("Back garden patio", "wet paving slabs, broken plastic chair, fence panels", SK),
      row("Hallway with shoes", "coats on hooks, muddy doormat, frosted glass door", SK),
      row("Bathroom with steam", "condensed mirror, cracked tile grout, towel rail", SK),
    ],
    historic_sacred: [
      row("Norman churchyard", "wet headstones, yew tree, flint wall", SK),
      row("Castle ruin courtyard", "broken arch, puddles on flagstones, grey sky", SK),
      row("Museum gallery", "empty plinths, polished floor, soft spotlights off", SK),
      row("Stone circle hill", "ancient uprights, sheep-cropped grass, mist", SK),
      row("Roman mosaic floor", "excavated tiles under glass roof, empty viewing walkway", SK),
      row("Abbey cloister", "wet cobbles, arched walkway, central grass square", SK),
    ],
    urban_industrial: [
      row("Suburban high street", "kerbs, shop fronts, parked cars, mown verges", SK),
      row("Bus station shelter", "wet concrete, timetable case, empty benches", SK),
      row("Office open-plan", "empty desks, monitors off, grey ceiling panels", SK),
      row("Warehouse aisle", "metal shelving, cardboard boxes, high windows", SK),
      row("Multi-storey car park", "concrete ramps, oil stains, fluorescent strips", SK),
      row("Alley behind shops", "wheelie bins, brick wall, puddle reflecting sky", SK),
    ],
    speculative_unreal: [
      row("Hell cellar", "damp stone steps, candle sconces unlit, iron door", SK),
      row("Limbo void", "grey floor fading to black, single distant light", SK),
      row("Mars habitat corridor", "rounded white panels, red dust on viewport", SK),
      row("Dream staircase", "impossible angles, soft purple fog, no rails", SK),
      row("Abandoned space station", "floating dust, cracked viewport, Earth far below", SK),
      row("Underworld riverbank", "black water, obsidian rocks, pale mist", SK),
    ],
  },
  sunny_banks: {
    natural_wild: [
      row("Dry creek bed", "red sand, gum roots, heat shimmer", SUNNY),
      row("Caravan park bush edge", "scrub, tin sheds in distance, harsh sun", SUNNY),
      row("Beach carpark", "bitumen melt lines, dunes, empty bay", SUNNY),
      row("Bushfire-scorched ridge", "black trunks, orange dirt, bleached sky", SUNNY),
      row("Water tank dam", "low muddy water, fence line, flies implied", SUNNY),
      row("Roadside rest stop", "bin on pole, red dirt, single gum", SUNNY),
    ],
    social_public: [
      row("Servo forecourt", "fuel pumps, pie warmer glow, faded awning", SUNNY),
      row("RSL club interior", "pokies off, carpet pattern, empty bar stools", SUNNY),
      row("Site laundry", "coin machines, concrete floor, wire baskets", SUNNY),
      row("Bottle-o front", "security mesh, posters, warm fridge glow", SUNNY),
      row("Community pool", "empty lanes, blue water, chain-link fence", SUNNY),
      row("Outdoor BBQ shelter", "steel plate, picnic table, gum overhead", SUNNY),
    ],
    domestic_private: [
      row("Fibro caravan interior", "lace curtains, laminex table, tiny sink", SUNNY),
      row("Site kitchen", "magnet fridge, fan on bench, flyscreen door", SUNNY),
      row("Back shed", "lawns mower, VB crate, corrugated walls", SUNNY),
      row("Screened veranda", "worn cane chairs, Hills hoist view", SUNNY),
      row("Share-house lounge", "faded couch, fan, cricket on muted TV off", SUNNY),
      row("Demountable bedroom", "portable AC, unmade bed, thin carpet", SUNNY),
    ],
    historic_sacred: [
      row("Gold rush pub exterior", "weatherboard, veranda posts, dusty street", SUNNY),
      row("War memorial park", "stone soldier, wreath, dry lawn", SUNNY),
      row("Old gaol yard", "sandstone walls, iron gate, harsh sun", SUNNY),
      row("Pioneer museum shed", "rusty plough, corrugated roof, dirt floor", SUNNY),
      row("Coastal lighthouse base", "white tower, rocky ground, grey sea", SUNNY),
      row("Aboriginal rock art site", "overhang, red ochre panels, quiet bush", SUNNY),
    ],
    urban_industrial: [
      row("Mining town main street", "wide road, ute parked, pub sign", SUNNY),
      row("Warehouse loading dock", "roller door, pallet jack, asphalt heat", SUNNY),
      row("Highway truck stop", "empty tables, road noise implied, shade sail", SUNNY),
      row("Demountable site office", "portable steps, paperwork on desk through window", SUNNY),
      row("Construction slab", "rebar grid, orange cones, red dirt", SUNNY),
      row("Empty skate bowl", "concrete curves, graffiti, midday sun", SUNNY),
    ],
    speculative_unreal: [
      row("Purple alien landing site", "crater ring, antennae rock, two moons sky", SUNNY),
      row("Inside a giant esky", "frost walls, beer-can scale, cold blue light", SUNNY),
      row("Dream billabong", "impossible colours, floating tinny, still water", SUNNY),
      row("Heat-haze mirage city", "wobbly towers on horizon, dead flat salt", SUNNY),
      row("Orbiting servo", " pumps floating, Earth curve, neon sign", SUNNY),
      row("Bush tornado path", "stripped trees, twisted corrugated, eerie calm", SUNNY),
    ],
  },
  doc: {
    natural_wild: [
      row("Retro NASA launch pad", "70s concrete, warm film grain, empty gantry", DOC),
      row("Antarctic ice shelf", "blue crack lines, research flags, no figures", DOC),
      row("Deep rainforest canopy", "mist, lianas, single sun shaft", DOC),
      row("Volcanic ash field", "grey dunes, steam vent, overcast", DOC),
      row("Desert observatory dome", "white sphere, red dirt, star prep dusk", DOC),
      row("Coral reef aerial", "turquoise shallows, boat shadow only", DOC),
    ],
    social_public: [
      row("Clinical lab corridor", "white tiles, glass doors, safety posters blank", DOC),
      row("University lecture hall", "empty tiered seats, projector off", DOC),
      row("Hospital waiting room", "plastic chairs, muted TV off, fish tank", DOC),
      row("Parliament committee room", "microphones, empty leather chairs", DOC),
      row("Archive reading room", "lamps, wooden desks, stacked boxes", DOC),
      row("TV news studio", "empty desk, LED wall dark, cameras on dollies", DOC),
    ],
    domestic_private: [
      row("Scientist home office", "whiteboard equations, coffee ring, blinds half down", DOC),
      row("Kitchen interview nook", "window light, fruit bowl, recorder on table", DOC),
      row("Basement archive", "shelving, label boxes, single bulb", DOC),
      row("Attic discovery room", "trunks, dust motes, slanted roof window", DOC),
      row("Safe house bedroom", "sparse furniture, taped curtain edge", DOC),
      row("Farmhouse kitchen", "AGA stove, checked cloth, rain on pane", DOC),
    ],
    historic_sacred: [
      row("Egyptian tomb antechamber", "hieroglyph walls, empty sarcophagus platform", DOC),
      row("Medieval scriptorium", "desks, ink pots, candle stubs, no monks", DOC),
      row("WWII bunker map room", "paper maps, phones, low ceiling", DOC),
      row("Temple excavation trench", "sandbags, measuring sticks, partial column", DOC),
      row("Library rare books room", "gloves on table, glass case open", DOC),
      row("Stone age cave entrance", "fire pit cold, ochre hand prints", DOC),
    ],
    urban_industrial: [
      row("Abandoned factory floor", "rust belts, broken windows, pigeons implied off-screen", DOC),
      row("Subway platform night", "wet tiles, empty bench, tunnel dark", DOC),
      row("Power station control room", "analog dials, empty swivel chair", DOC),
      row("Shipping container yard", "stacked boxes, crane idle, overcast", DOC),
      row("Data centre aisle", "server lights, cold blue, glass door", DOC),
      row("Police evidence room", "shelving, tagged bags, fluorescent", DOC),
    ],
    speculative_unreal: [
      row("Simulated Mars dome interior", "hydroponics, white panels, red window", DOC),
      row("Particle accelerator tunnel", "curved pipe, warning stripes, deep perspective", DOC),
      row("AI server dreamscape", "infinite racks fading to white", DOC),
      row("Deep-sea sub viewport", "black water, bioluminescent specks", DOC),
      row("Time-lapse city void", "blurred light trails, empty intersection centre", DOC),
      row("Cryo chamber hall", "frost pods, mist floor, cyan light", DOC),
    ],
  },
  music_video: {
    natural_wild: [
      row("Country dirt road", "golden hour, fence posts, pickup tyre tracks", MV),
      row("Rock quarry lake", "still green water, cliff walls, dramatic sky", MV),
      row("Neon beach night", "pink sand, cyan wave glow, empty shore", MV),
      row("Desert highway mirage", "heat lines, telegraph poles, wide sky", MV),
      row("Rain-soaked forest stage", "mud path, coloured gel light through trees", MV),
      row("Snow field music stand", "white expanse, single mic stand, no singer", MV),
    ],
    social_public: [
      row("Empty jazz club", "small stage, brass mic, velvet curtain", MV),
      row("Arena before doors", "empty seats, spotlight on centre stage", MV),
      row("Dive bar back room", "pool table, beer neon off, smoke haze", MV),
      row("Retro diner booth", "checker floor, jukebox glow, no customers", MV),
      row("Warehouse rave space", "LED truss, fog machine idle, concrete", MV),
      row("Chapel acoustic set", "wood pews, stained glass colour on floor", MV),
    ],
    domestic_private: [
      row("Bedroom tape deck shrine", "posters, unmade bed, warm lamp", MV),
      row("Garage band practice", "amps, cable spaghetti, egg cartons on wall", MV),
      row("Hotel room after party", "confetti, overturned chair, city window", MV),
      row("Kitchen slow-dance floor", "linoleum, fridge magnets, moody window light", MV),
      row("Walk-in wardrobe runway", "clothes rails, mirror bulbs, empty aisle", MV),
      row("Bathroom mirror lip-sync", "steam edge, harsh bulb, tiled echo", MV),
    ],
    historic_sacred: [
      row("Gothic cathedral nave", "empty aisle, coloured light beams, organ pipes", MV),
      row("Roman amphitheatre", "stone tiers, centre sand, sunset", MV),
      row("Art-deco ballroom", "parquet floor, chandelier off, velvet rope", MV),
      row("Abandoned theatre", " torn velvet seats, stage bare, spotlight", MV),
      row("Castle great hall", "long tables cleared, torch brackets unlit", MV),
      row("Museum atrium", "marble floor, sculpture plinth, glass roof", MV),
    ],
    urban_industrial: [
      row("Rooftop skyline stage", "AC units, cable runs, city bokeh", MV),
      row("Parking garage neon", "concrete pillars, magenta tubes, wet floor", MV),
      row("Subway car empty", "plastic seats, tunnel lights streak", MV),
      row("Alley fire escape", "steam vent, brick, single street lamp", MV),
      row("Bridge underpass", "graffiti, river glimpse, bass-bin implied", MV),
      row("Studio backlot street", "false facades, painted sky backdrop", MV),
    ],
    speculative_unreal: [
      row("Synthwave grid horizon", "neon floor grid, purple sun, no figure", MV),
      row("Floating platform clouds", "white void, speaker stacks, impossible height", MV),
      row("Liquid mirror stage", "reflective floor, infinite lights", MV),
      row("VHS glitch bedroom", "tracking lines, purple static, 80s props", MV),
      row("Outer space disco ball", "stars, mirrored sphere, no dancers", MV),
      row("Underwater cathedral", "blue rays, floating dust, silent nave", MV),
    ],
  },
  deepfake: {
    natural_wild: [
      row("Malibu cliff overlook", "Pacific grey-blue, guard rail, telephoto haze", DF),
      row("Swiss alpine meadow", "green slope, distant peaks, crisp air", DF),
      row("Amazon river bend", "brown water, dense green, humid haze", DF),
      row("Sahara dune ridge", "orange sand, sharp shadow, clear sky", DF),
      row("Iceland black beach", "basalt sand, white surf, low cloud", DF),
      row("Central Park path autumn", "leaves, bench, city skyline soft", DF),
    ],
    social_public: [
      row("Oscars red carpet empty", "velvet rope, stanchions, camera platforms", DF),
      row("White House briefing room", "empty podium, flags, camera tripods", DF),
      row("Tech conference stage", "LED wall dark, lone lectern, spot track", DF),
      row("Fine dining restaurant", "white tablecloths, wine glasses, candle stubs", DF),
      row("Airport VIP lounge", "leather seats, bar closed, tarmac window", DF),
      row("Casino high-roller room", "green felt table, chips stacked, no players", DF),
    ],
    domestic_private: [
      row("Penthouse living room", "floor-to-ceiling glass, designer sofa, dusk city", DF),
      row("Celebrity kitchen", "marble island, espresso machine, paparazzi-safe blinds", DF),
      row("Home studio vocal booth", "foam panels, mic on stand, laptop glow", DF),
      row("Walk-in wardrobe luxury", "shoe walls, centre island, mirror lights", DF),
      row("Bunker safe room", "concrete, monitors off, supply shelves", DF),
      row("Mansion foyer", "double stairs, chandelier, empty echo", DF),
    ],
    historic_sacred: [
      row("Vatican corridor", "marble, Swiss guard booth empty, soft light", DF),
      row("Westminster hall", "stone floor, banners, empty benches", DF),
      row("Pyramid plateau", "limestone blocks, sand, heat shimmer", DF),
      row("Acropolis overlook", "columns, Athens haze, tourist-free", DF),
      row("Berlin wall remnant", "graffiti, watchtower, grey sky", DF),
      row("Hollywood sign hillside", "scrub, letters distant, clear LA smog", DF),
    ],
    urban_industrial: [
      row("Wall Street canyon", "flags, wet asphalt, empty crosswalk", DF),
      row("Silicon Valley campus", "glass buildings, e-scooters parked", DF),
      row("London black cab rank empty", "wet pavement, pub sign, tube entrance", DF),
      row("Tokyo crossing still", "zebra lines, billboards on, no crowd", DF),
      row("Dubai marina walkway", "glass towers, yacht masts, haze", DF),
      row("News studio alley rear", "satellite dishes, cable coils, dumpster", DF),
    ],
    speculative_unreal: [
      row("Mars colony atrium", "red dust on glass, hydro trays, empty benches", DF),
      row("Virtual metaverse plaza", "uncanny smooth floors, floating logos off", DF),
      row("Deepfake server farm glow", "blue LED racks, cold aisle, no technicians", DF),
      row("Simulation white room", "infinite white, single door, no horizon", DF),
      row("Orbital hotel corridor", "curve floor, Earth window, soft carpet", DF),
      row("Apocalypse green screen set", "ruined facade flat, studio lights visible at edge", DF),
    ],
  },
  photoreal: {
    natural_wild: [
      row("English pebble beach", "grey stones, gentle waves, overcast", PR),
      row("Wheat field lane", "tram lines, hedgerow, cumulus sky", PR),
      row("Scottish loch shore", "peat water, stones, low cloud", PR),
      row("Suburban park pond", "ducks implied off-frame, bench, reeds", PR),
      row("Motorway verge", "crash barrier, rain, tail lights streak off-screen", PR),
      row("Allotment plots", "sheds, bean poles, muddy path", PR),
    ],
    social_public: [
      row("High street charity shop", "window display, rail inside, fluorescent", PR),
      row("GP surgery waiting", "plastic chairs, health posters, reception desk", PR),
      row("Pub snug", "dark wood, beer taps, empty glasses on tray", PR),
      row("Supermarket aisle", "trolley bay, linoleum, shelf ends", PR),
      row("Train carriage empty", "fabric seats, window streak, station blur", PR),
      row("Job centre interior", "counters, queue barriers, notice boards", PR),
    ],
    domestic_private: [
      row("Terraced house front room", "bay window, TV off, mug on table", PR),
      row("Flat kitchen diner", "IKEA units, washing on airer, rain glass", PR),
      row("Student bedsit", "desk lamp, unmade bed, takeaway boxes stacked neat", PR),
      row("Elderly bungalow", "radiator, lace cloth, fireguard", PR),
      row("New-build show home", "staging vase, blank walls, harsh LED", PR),
      row("Night kitchen sink", "under-cabinet light, dripping tap, dark garden window", PR),
    ],
    historic_sacred: [
      row("Parish church interior", "pews, hymn books, stained glass muted", PR),
      row("Cemetery chapel", "stone floor, flower buckets, open door light", PR),
      row("Industrial heritage site", "brick chimney,Interpretation board, gravel", PR),
      row("Manor house library", "leather chairs, ladder shelf, dust motes", PR),
      row("Roman wall segment", "town park, explanatory plaque, bench", PR),
      row("War memorial interior", "book of names, wreath, silence", PR),
    ],
    urban_industrial: [
      row("Council estate walkway", "concrete, bin store, grey sky", PR),
      row("Retail park carpark", "trolley shelter, puddles, big-box units", PR),
      row("Office kitchen", "microwave, notice about milk, sad plant", PR),
      row("Building site hoarding", "plywood, warning signs, crane behind", PR),
      row("Night bus stop", "shelter light, wet poster, empty road", PR),
      row("Lock-up garage row", "up-and-over doors, oil stain, pigeons off-screen", PR),
    ],
    speculative_unreal: [
      row("Fog-bound street", "lamp halos, pavement vanishes, no figures", PR),
      row("Abandoned shopping centre", "fountain dry, skylight dust, shuttered units", PR),
      row("Dream stairwell", "repeating flights, wrong angles, bare bulb", PR),
      row("Storm beach hut row", "peeling paint, boards nailed, black sky", PR),
      row("Mirror-world duplicate street", "same shop twice, subtle wrongness, empty", PR),
      row("Limbo waiting room", "plastic chairs infinite, buzzer ticket machine", PR),
    ],
  },
};

export function pickWorldPlaceIdea(
  styleId: ShowStyleId,
  placeType: WorldPlaceTypeId,
  avoid?: string,
): string {
  const pool = STYLE_WORLD_IDEAS[styleId]?.[placeType] ?? [];
  if (!pool.length) return "";
  const choices = avoid ? pool.filter((p) => p !== avoid) : pool;
  const pickFrom = choices.length ? choices : pool;
  return pickFrom[Math.floor(Math.random() * pickFrom.length)] ?? pool[0];
}

export function pickFreshWorldPlaceIdea(
  styleId: ShowStyleId,
  placeType: WorldPlaceTypeId,
  usedNames: string[] = [],
  avoid?: string,
): string {
  const pool = STYLE_WORLD_IDEAS[styleId]?.[placeType] ?? [];
  if (!pool.length) return "";
  const used = new Set(usedNames.map((n) => n.toLowerCase().trim()));
  const fresh = pool.filter((p) => {
    if (p === avoid) return false;
    const dash = p.indexOf(" — ");
    const name = (dash === -1 ? p : p.slice(0, dash)).toLowerCase().trim();
    return !used.has(name);
  });
  const pickFrom = fresh.length ? fresh : pool.filter((p) => p !== avoid);
  const choices = pickFrom.length ? pickFrom : pool;
  return choices[Math.floor(Math.random() * choices.length)] ?? pool[0];
}
