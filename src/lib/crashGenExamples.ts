import type { ShowStyleId } from "./showStylePresets";

type ExampleOpts = {
  /** BG locked — staging / tweak examples */
  lockedBg?: boolean;
  /** Stock still on screen — tweak chain */
  hasStock?: boolean;
};

function realismBand(n: number): "cartoon" | "balanced" | "photo" {
  if (n < 35) return "cartoon";
  if (n >= 70) return "photo";
  return "balanced";
}

/** Thumb-gen phase — character only. Location comes later (Location Lab → Lock BG → Plate). */
const CHAR_SUFFIX =
  "Medium portrait, character only, soft neutral blurred backdrop, shallow depth of field, grey overcast daylight on face";

const SKIDMARKS_LOOK =
  "highly detailed stylised 3D animated feature render, clean simplified forms, believable materials, soft overcast lighting, shallow depth of field, cinematic quality, sharp focus, not photographic, not a cartoon";

const SKIDMARKS_IDEAS: string[] = [
  `Jesus.exe — cream collar shirt, dark cross on chain, insufferable smirk, sweating brow, stylised 3D caricatured face. ${SKIDMARKS_LOOK}. ${CHAR_SUFFIX}`,
  `Kim the Gypsy KUNT — immaculate high-maintenance face, designer cream blouse neckline, gold hoop earrings, upper lip curled, hip cocked smirk, stylised 3D caricature. ${SKIDMARKS_LOOK}. ${CHAR_SUFFIX}`,
  `DAP — gaunt Über-prick pedant face, thin nasal arrogance, reedy smug contempt, stylised 3D caricatured English arsehole. ${SKIDMARKS_LOOK}. ${CHAR_SUFFIX}`,
  `CrackWhore Darryl — stained dirty singlet, greasy thinning hair, big caricatured nose, cocky pub weapon grin, filthy work boots energy, stylised 3D. ${SKIDMARKS_LOOK}. ${CHAR_SUFFIX}`,
  `Jum — Thai woman, tough kind smile, white sports top, brown skin, expressive eyes, stylised 3D portrait. ${SKIDMARKS_LOOK}. ${CHAR_SUFFIX}`,
  `Garry Crump — shiny grey polyester suit, heavy underarm sweat rings, crooked clip-on tie, oily comb-over, bloated middle-manager smirk, stylised 3D. ${SKIDMARKS_LOOK}. ${CHAR_SUFFIX}`,
];

const DEEPFAKE_LOOK =
  "locked identity face, slight uncanny smoothness, photoreal portrait bust";

const DEEPFAKE_IDEAS: string[] = [
  `Elon Musk — manic presenter face, tiny rocket model in one hand, other hand searching couch cushion for a white AirPod, dead serious. ${DEEPFAKE_LOOK}. ${CHAR_SUFFIX}`,
  `Mark Zuckerberg — stiff over-smile, coffee cup, trying to look human, earnest robot eyes, casual hoodie. ${DEEPFAKE_LOOK}. ${CHAR_SUFFIX}`,
  `Joe Biden — confused kind face, chocolate chip ice cream cone already in his hand, looking around lost for another one. ${DEEPFAKE_LOOK}. ${CHAR_SUFFIX}`,
  `Donald Trump — furious televised expression, holding a piece of slightly burnt diner toast, pointing at it passionately. ${DEEPFAKE_LOOK}. ${CHAR_SUFFIX}`,
  `Taylor Swift — dramatic tearful power-ballad face, phone in hand, emotional devastation over weak Wi-Fi signal. ${DEEPFAKE_LOOK}. ${CHAR_SUFFIX}`,
  `Pope Francis — solemn ashamed smile, game controller in hands, confessing he rage-quit Mario Kart. ${DEEPFAKE_LOOK}. ${CHAR_SUFFIX}`,
  `Keanu Reeves — serious interview face, sudden wide-eyed whisper, slight uncanny stillness, black shirt. ${DEEPFAKE_LOOK}. ${CHAR_SUFFIX}`,
  `Gordon Ramsay — screaming red face, pointing at a self-checkout screen, raw fury, chef whites. ${DEEPFAKE_LOOK}. ${CHAR_SUFFIX}`,
  `Bill Gates — exasperated face, glasses, staring at a smart-fridge screen, firmware-update frustration. ${DEEPFAKE_LOOK}. ${CHAR_SUFFIX}`,
  `Morgan Freeman — deep narrator gravitas, slow-motion documentary seriousness, wise rumbling expression, grey beard. ${DEEPFAKE_LOOK}. ${CHAR_SUFFIX}`,
  `Anthony Albanese — Australian Prime Minister, locked identity face, democracy sausage in hand, campaign trail grin, slight uncanny smoothness. ${DEEPFAKE_LOOK}. ${CHAR_SUFFIX}`,
  `Donald Trump wearing a bright pink bikini, locked identity face, slight uncanny smoothness, full photoreal portrait. ${CHAR_SUFFIX}`,
];

const MUSIC_VIDEO_LOOK =
  "bold music-video colour grade on face and costume, performance portrait energy, genre styling";

const MUSIC_VIDEO_IDEAS: string[] = [
  `Country & Western cowboy — dusty denim, oversized silver belt buckle, cowboy boots, dramatically crying into his cowboy hat, heartbroken over his dog. ${MUSIC_VIDEO_LOOK}. ${CHAR_SUFFIX}`,
  `Classic Rock star — distressed leather jacket, long wild hair, explosive guitar-smash pose, horrified realization, cardboard prop guitar splinters in hands. ${MUSIC_VIDEO_LOOK}. ${CHAR_SUFFIX}`,
  `Delta Bluesman — shadowy worn hat, hazy smoke on face, deeply emotional singing expression, rusty resonator guitar against shoulder, tragic oat-milk sorrow. ${MUSIC_VIDEO_LOOK}. ${CHAR_SUFFIX}`,
  `Swing Jazz trumpeter — sharp pinstripe suit, brass trumpet at lips, solo so intense his toupee is lifting off his head, art-deco glamour. ${MUSIC_VIDEO_LOOK}. ${CHAR_SUFFIX}`,
  `Synthwave singer — neon pink and cyan glow on face, retro sunglasses, keytar shoulder strap tangled around neck, glowing palm-tree prop chaos. ${MUSIC_VIDEO_LOOK}. ${CHAR_SUFFIX}`,
  `Punk rebel — shredded tartan trousers, safety pins, leather jacket covered in band patches, guilty panicked face after throwing a TV out a hotel window. ${MUSIC_VIDEO_LOOK}. ${CHAR_SUFFIX}`,
  `Heavy Metal singer — all-black spikes, long hair, terrifying mid-scream face, holding brutal scream for twenty seconds, pizza delivery announcement energy. ${MUSIC_VIDEO_LOOK}. ${CHAR_SUFFIX}`,
  `Hip-Hop rapper — oversized streetwear, designer sneakers, delivering an incredibly fast verse, giant gold chain clearly painted plastic. ${MUSIC_VIDEO_LOOK}. ${CHAR_SUFFIX}`,
  `Reggae artist — vibrant red gold and green clothing, knitted tam, acoustic guitar, peaceful singing face while a chaotic seagull lands on his shoulder. ${MUSIC_VIDEO_LOOK}. ${CHAR_SUFFIX}`,
  `Classical conductor — formal black tuxedo, mid-fling baton, horrified apologetic expression, elegant concert-hall gravitas gone wrong. ${MUSIC_VIDEO_LOOK}. ${CHAR_SUFFIX}`,
];

const DOC_LOOK =
  "documentary talking-head portrait, believable skin, genre-specific lighting and costume on subject";

const DOC_IDEAS: string[] = [
  `Retro-Space astronaut — vintage 1970s NASA-style suit, heavy film grain on face, puzzled expression, headphones on, colleague pocket-dial revelation. ${DOC_LOOK}. ${CHAR_SUFFIX}`,
  `Clinical scientist — crisp white coat, minimalist sterile lighting, dead-serious face, supercomputer grilled-cheese flip calculation energy. ${DOC_LOOK}. ${CHAR_SUFFIX}`,
  `Ancient historian — sepia-toned scholarly face, reading stone tablet, baffled realization, 3000-year-old copper complaint translation. ${DOC_LOOK}. ${CHAR_SUFFIX}`,
  `Counter-culture hippie rebel — aging underground comix grit, crosshatched edgy portrait feel, strictly organized neighborhood garden-swap revolutionary. ${DOC_LOOK}. ${CHAR_SUFFIX}`,
  `Steampunk inventor — brass goggles, Victorian waistcoat, copper tones, proud face beside absurd 5000-gear steam machine for one bag of potato chips. ${DOC_LOOK}. ${CHAR_SUFFIX}`,
  `Bio-psychedelic nature narrator — neon-saturated trippy glow on face, intense documentary gravity, frog-on-leaf existential seriousness. ${DOC_LOOK}. ${CHAR_SUFFIX}`,
  `Urbex explorer — moody decay lighting on face, head torch, shocked expression, confused 1994 security guard still on duty. ${DOC_LOOK}. ${CHAR_SUFFIX}`,
  `True crime investigator — cold blue rainy-night noir lighting, shadowy interview portrait, billionaire stuck in walk-in closet mystery. ${DOC_LOOK}. ${CHAR_SUFFIX}`,
  `Deep-sea crew member — deep-teal bioluminescent glow on face, underwater camera headset, horrified realization filming a plastic grocery bag. ${DOC_LOOK}. ${CHAR_SUFFIX}`,
  `Archival biographer — scrapbook collage mood, handwritten notes in hand, polaroid edges visible, childhood mud-diary revelation face. ${DOC_LOOK}. ${CHAR_SUFFIX}`,
];

const SUNNY_BANKS_LOOK =
  "rubbery adult cartoon, thick black outlines, flat cel colour, big head, sun-bleached Aussie palette, dusty ochre, faded teal, heat haze";

const SUNNY_BANKS_IDEAS: string[] = [
  `Dazza — wild mullet, bloodshot eyes, stained blue singlet, Australia tattoo on shoulder, junk ray-gun in hand, gap-toothed grubby grin. ${SUNNY_BANKS_LOOK}. ${CHAR_SUFFIX}`,
  `Shazza — big blonde hair, gold hoop earrings, cigarette dangling, leopard-print tank top, arms folded, sceptical nosy smirk. ${SUNNY_BANKS_LOOK}. ${CHAR_SUFFIX}`,
  `Nuggets — skinny anxious teen, buzz cut, oversized blue and yellow sports jersey, holding a servo meat pie in both hands, worried complaining face. ${SUNNY_BANKS_LOOK}. ${CHAR_SUFFIX}`,
  `The Unit 4s — two short purple aliens side by side, antennae, bulging eyes, bucket hats, thongs held in hands, wide toothy grins trying to blend in. ${SUNNY_BANKS_LOOK}. ${CHAR_SUFFIX}`,
  `Ranger Bazza — portly park ranger, thick mustache, wraparound sunnies, tight khaki uniform straining at buttons, clipboard and whistle, rules face. ${SUNNY_BANKS_LOOK}. ${CHAR_SUFFIX}`,
  `Nan — tiny elderly woman, hair bun, big round glasses, purple floral housecoat, pink bunny slippers, floral teacup in one hand, cricket bat over shoulder, unbothered stare. ${SUNNY_BANKS_LOOK}. ${CHAR_SUFFIX}`,
];

const PHOTOREAL_LOOK =
  "photoreal portrait bust, natural skin pores, accurate daylight, sharp focus on face, near-camera, no cartoon";

const PHOTOREAL_IDEAS: string[] = [
  `Middle-aged woman — supermarket uniform, tired kind smile, fluorescent soft light on face, natural skin texture. ${PHOTOREAL_LOOK}. ${CHAR_SUFFIX}`,
  `Young man — hoodie, stubble, overcast daylight on face, ordinary street clothes, believable portrait. ${PHOTOREAL_LOOK}. ${CHAR_SUFFIX}`,
  `Office worker — blouse, lanyard, fluorescent interview light, natural materials on skin and fabric. ${PHOTOREAL_LOOK}. ${CHAR_SUFFIX}`,
  `Elderly man — weathered skin, flat cap, kind eyes, soft overcast daylight, photoreal bust. ${PHOTOREAL_LOOK}. ${CHAR_SUFFIX}`,
  `Bricklayer on smoko — sun-weathered face, high-vis vest, meat pie grease on chin, squinting grin. ${PHOTOREAL_LOOK}. ${CHAR_SUFFIX}`,
  `Dog walker — rain on face, puffer jacket, lead in hand, miserable English weather, natural portrait. ${PHOTOREAL_LOOK}. ${CHAR_SUFFIX}`,
  `Night taxi driver — cab light glow on face, tired eyes, stubble, dashboard reflection, photoreal close-up. ${PHOTOREAL_LOOK}. ${CHAR_SUFFIX}`,
  `Teen on first shift — nervous half-smile, fast-food cap, acne, overcast daylight, believable youth portrait. ${PHOTOREAL_LOOK}. ${CHAR_SUFFIX}`,
];

/** 4–6 rotating Idea prompts per style — card thumb hunting. */
export const STYLE_PICK_IDEAS: Record<ShowStyleId, string[]> = {
  skidmarks: SKIDMARKS_IDEAS,
  sunny_banks: SUNNY_BANKS_IDEAS,
  doc: DOC_IDEAS,
  music_video: MUSIC_VIDEO_IDEAS,
  deepfake: DEEPFAKE_IDEAS,
  photoreal: PHOTOREAL_IDEAS,
};

/** Brand-new faces — not the locked main cast. Idea button on Characters step. */
const SUNNY_BANKS_NEW_IDEAS: string[] = [
  `Cheryl from Site 7 — perm and pink tracksuit, arms folded, nosey park-dweller smirk, cigarette energy. ${SUNNY_BANKS_LOOK}. ${CHAR_SUFFIX}`,
  `Smoko Steve — sunburnt tradie, high-vis vest, meat pie in hand, squinting grin, tool belt. ${SUNNY_BANKS_LOOK}. ${CHAR_SUFFIX}`,
  `Backpacker Britt — sunburnt Pom, giant pack, confused grin, wrong thongs, heat stroke face. ${SUNNY_BANKS_LOOK}. ${CHAR_SUFFIX}`,
  `Grey nomad Gary — caravan polish obsessive, khaki shorts, beer gut, proud detailer face. ${SUNNY_BANKS_LOOK}. ${CHAR_SUFFIX}`,
  `Wayne the ex — mullet, stained singlet, still thinks he owns site 9, wounded bloke bravado. ${SUNNY_BANKS_LOOK}. ${CHAR_SUFFIX}`,
  `Beryl Bingo — loud cardigan, megaphone energy, bingo caller face, unimpressed stare. ${SUNNY_BANKS_LOOK}. ${CHAR_SUFFIX}`,
  `Kev the Kiosk — servo attendant, dead eyes, overheated pie tongs, thousand-yard stare. ${SUNNY_BANKS_LOOK}. ${CHAR_SUFFIX}`,
  `Muzz the Mosquito bloke — singlet and shorts, spray can, obsessive biter-hunter face. ${SUNNY_BANKS_LOOK}. ${CHAR_SUFFIX}`,
];

const SKIDMARKS_NEW_IDEAS: string[] = [
  `Nigel the Neighbour — twitching net-curtain face, passive-aggressive smirk, cardigan, peering over fence energy. ${SKIDMARKS_LOOK}. ${CHAR_SUFFIX}`,
  `Councillor Prue — pearl necklace, fake smile, clipboard tyrant, laminated badge, pursed lips. ${SKIDMARKS_LOOK}. ${CHAR_SUFFIX}`,
  `Taxi Trevor — yellow badge, sour face, chewing gum, knows everyone's business, stained shirt. ${SKIDMARKS_LOOK}. ${CHAR_SUFFIX}`,
  `Charity Shop Pat — mothball cardigan, judging eyes, price sticker on everything, sanctimonious grin. ${SKIDMARKS_LOOK}. ${CHAR_SUFFIX}`,
  `Pub Landlord Mick — wet bar towel, dead eyes, knows when you're lying, heavy forearms. ${SKIDMARKS_LOOK}. ${CHAR_SUFFIX}`,
  `Neighbourhood Watch Terry — high-vis vest, binoculars, righteous panic face, clipboard. ${SKIDMARKS_LOOK}. ${CHAR_SUFFIX}`,
];

const DOC_NEW_IDEAS: string[] = [
  `Local historian — cardigan, magnifying glass, dusty archive face, thrilled by a receipt. ${DOC_LOOK}. ${CHAR_SUFFIX}`,
  `Planning officer — fluorescent office light, tired bureaucrat face, endless forms energy. ${DOC_LOOK}. ${CHAR_SUFFIX}`,
  `Dog-walking witness — rain hood, lead in hand, saw everything, reluctant talker face. ${DOC_LOOK}. ${CHAR_SUFFIX}`,
  `Charity shop volunteer — name badge, gentle smile hiding judgment, tea mug. ${DOC_LOOK}. ${CHAR_SUFFIX}`,
  `Night-shift security — monitor glow on face, stale coffee, thousand-yard stare. ${DOC_LOOK}. ${CHAR_SUFFIX}`,
  `Amateur ufologist — tinfoil hat off, earnest believer face, blurry photo in hand. ${DOC_LOOK}. ${CHAR_SUFFIX}`,
];

const MUSIC_VIDEO_NEW_IDEAS: string[] = [
  `One-hit wonder — dated haircut, leather jacket, still performing the same chorus face. ${MUSIC_VIDEO_LOOK}. ${CHAR_SUFFIX}`,
  `Session musician — bored pro face, expensive headphones, seen it all. ${MUSIC_VIDEO_LOOK}. ${CHAR_SUFFIX}`,
  `Karaoke king — cheap mic, over-confident grin, living room rock god energy. ${MUSIC_VIDEO_LOOK}. ${CHAR_SUFFIX}`,
  `Folk singer in wrong venue — acoustic guitar, gentle face, crowd not listening. ${MUSIC_VIDEO_LOOK}. ${CHAR_SUFFIX}`,
  `Disco revival act — mirror ball glow on face, flared trousers, earnest groove. ${MUSIC_VIDEO_LOOK}. ${CHAR_SUFFIX}`,
  `Busker with one good song — open guitar case, hopeful tired face, cap out. ${MUSIC_VIDEO_LOOK}. ${CHAR_SUFFIX}`,
];

const DEEPFAKE_NEW_IDEAS: string[] = [
  `Anthony Albanese — Australian Prime Minister, locked identity face, holding a democracy sausage, earnest campaign smile, slight uncanny smoothness. ${DEEPFAKE_LOOK}. ${CHAR_SUFFIX}`,
  `Peter Dutton — locked identity face, opposition leader scowl, Australian parliament energy, slight uncanny smoothness. ${DEEPFAKE_LOOK}. ${CHAR_SUFFIX}`,
  `Rupert Murdoch — media mogul face, locked identity, newspaper in hand, calculating thin smile. ${DEEPFAKE_LOOK}. ${CHAR_SUFFIX}`,
  `Kylie Minogue — pop icon, locked identity portrait, superstar smile, slight uncanny polish. ${DEEPFAKE_LOOK}. ${CHAR_SUFFIX}`,
  `Chris Hemsworth — action star face, locked identity, baffled by flat-pack furniture instructions. ${DEEPFAKE_LOOK}. ${CHAR_SUFFIX}`,
  `Margot Robbie — locked identity Hollywood portrait, polished grin, slight uncanny smoothness. ${DEEPFAKE_LOOK}. ${CHAR_SUFFIX}`,
  `Shane Warne — locked identity, cricket ball in hand, larrikin smirk, photoreal bust. ${DEEPFAKE_LOOK}. ${CHAR_SUFFIX}`,
  `Paul Hogan — locked identity, cork hat energy, that's-not-a-knife grin, slight uncanny smoothness. ${DEEPFAKE_LOOK}. ${CHAR_SUFFIX}`,
];

const PHOTOREAL_NEW_IDEAS: string[] = [
  `Lollipop lady — high-vis tabard, kind firm face, stop sign energy, rain on hood. ${PHOTOREAL_LOOK}. ${CHAR_SUFFIX}`,
  `Charity collector — clipboard, persistent polite smile, high street daylight. ${PHOTOREAL_LOOK}. ${CHAR_SUFFIX}`,
  `Fish and chip shop owner — flour on apron, tired Friday night face, fryer glow. ${PHOTOREAL_LOOK}. ${CHAR_SUFFIX}`,
  `GP receptionist — headset, professional patience face, fluorescent light. ${PHOTOREAL_LOOK}. ${CHAR_SUFFIX}`,
  `Dog groomer — clipped fur on shirt, cheerful handling face, salon light. ${PHOTOREAL_LOOK}. ${CHAR_SUFFIX}`,
  `Park runner — red face, earbuds, exhausted triumph, overcast morning. ${PHOTOREAL_LOOK}. ${CHAR_SUFFIX}`,
];

export const STYLE_NEW_CHARACTER_IDEAS: Record<ShowStyleId, string[]> = {
  skidmarks: SKIDMARKS_NEW_IDEAS,
  sunny_banks: SUNNY_BANKS_NEW_IDEAS,
  doc: DOC_NEW_IDEAS,
  music_video: MUSIC_VIDEO_NEW_IDEAS,
  deepfake: DEEPFAKE_NEW_IDEAS,
  photoreal: PHOTOREAL_NEW_IDEAS,
};

/** Random brand-new face for Characters step — skips names already saved. */
export function pickBrandNewStyleCharacterIdea(
  styleId: ShowStyleId,
  usedNames: string[] = [],
  avoid?: string,
): string {
  const pool = STYLE_NEW_CHARACTER_IDEAS[styleId] ?? [];
  if (!pool.length) return pickStyleIdeaPrompt(styleId, avoid);
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

const BY_STYLE: Record<
  ShowStyleId,
  Record<"cartoon" | "balanced" | "photo", string>
> = {
  skidmarks: {
    cartoon:
      `Jesus.exe — cream collar shirt, dark cross on chain, insufferable smirk, sweating brow, stylised 3D caricatured face. ${CHAR_SUFFIX}`,
    balanced:
      `Middle-aged English man, cream collar shirt, dark cross necklace, insufferable smirk, caricatured nose and brow, stylised 3D feature render. ${CHAR_SUFFIX}`,
    photo:
      `Middle-aged English man, cream shirt, dark cross on chain, believable skin texture, insufferable smirk, cinematic portrait. ${CHAR_SUFFIX}`,
  },
  sunny_banks: {
    cartoon:
      `Dazza — white singlet, mullet, thongs, junk ray-gun in hand, thick black outlines, flat cel colour, big head rubbery cartoon. ${CHAR_SUFFIX}`,
    balanced:
      `Dazza — singlet, mullet, thongs, ray-gun junk invention, sun-bleached Aussie caricature, rubbery adult cartoon. ${CHAR_SUFFIX}`,
    photo:
      `Australian man — singlet, mullet, thongs, sun-weathered skin, squinting grin, natural portrait. ${CHAR_SUFFIX}`,
  },
  doc: {
    cartoon:
      `Documentary subject, talking head, facing camera, believable skin, interview energy, slightly stylised. ${CHAR_SUFFIX}`,
    balanced:
      `Documentary witness, talking head, facing camera, natural available light on face, believable shirt fabric. ${CHAR_SUFFIX}`,
    photo:
      `Documentary interview portrait, subject on camera, natural skin pores, soft light on face, shallow depth of field. ${CHAR_SUFFIX}`,
  },
  music_video: {
    cartoon:
      `Pop performer upper body, on mic, bold magenta and teal grade on face and clothes, hero pose, performance energy. ${CHAR_SUFFIX}`,
    balanced:
      `Music video performer, on mic, bold colour grade, performance lighting on face, stylised hero portrait. ${CHAR_SUFFIX}`,
    photo:
      `Music video performer close-up, on mic, stage sweat, bold grade, sharp lens on face. ${CHAR_SUFFIX}`,
  },
  deepfake: {
    cartoon:
      `Portrait bust, locked identity, smooth skin, slight uncanny polish, facing camera. ${CHAR_SUFFIX}`,
    balanced:
      `Photographic portrait, locked identity, believable skin, slight uncanny smoothness, soft key light. ${CHAR_SUFFIX}`,
    photo:
      `Photoreal portrait bust, locked identity, skin pores, full photoreal, sharp focus on eyes. ${CHAR_SUFFIX}`,
  },
  photoreal: {
    cartoon:
      `Named person, ordinary clothes, natural face, soft overcast daylight, simplified forms. ${CHAR_SUFFIX}`,
    balanced:
      `Named person, ordinary clothes, natural materials on skin and fabric, overcast daylight portrait. ${CHAR_SUFFIX}`,
    photo:
      `Named person, photoreal portrait, natural skin texture, accurate daylight, sharp focus on face. ${CHAR_SUFFIX}`,
  },
};

const TWEAK_EXAMPLES = [
  "Worried brows, clenched jaw, hands on sides of head",
  "Red hat, same face, same age, same clothes",
  "Fatter, same outfit stretched tight, same smirk",
  "Pale, thin, frightened eyes, bare wrists, same hair",
];

const PLATE_TWEAK_EXAMPLES = [
  "Standing centre frame, arms folded, smug",
  "Seated on pub stool, leaning forward, sweating",
  "Two people — one standing, one seated, clear spacing",
];

/** Random Idea from the style pool — avoids repeating the last prompt when possible. */
export function pickStyleIdeaPrompt(
  styleId: ShowStyleId,
  avoid?: string,
): string {
  const pool = STYLE_PICK_IDEAS[styleId] ?? STYLE_PICK_IDEAS.skidmarks;
  if (!pool.length) return "";
  if (pool.length === 1) return pool[0];
  const choices = avoid ? pool.filter((p) => p !== avoid) : pool;
  const pickFrom = choices.length ? choices : pool;
  return pickFrom[Math.floor(Math.random() * pickFrom.length)];
}

export function styleIdeaCount(styleId: ShowStyleId): number {
  return (STYLE_PICK_IDEAS[styleId] ?? []).length;
}

/** First Idea when a show style is picked (random from pool). */
export function crashGenStylePickPrompt(
  styleId: ShowStyleId,
  avoid?: string,
): string {
  return pickStyleIdeaPrompt(styleId, avoid);
}

/** Example prompt for Image gen — matches locked show style + slider band. */
export function crashGenExamplePrompt(
  styleId: ShowStyleId,
  styleRealism: number,
  opts: ExampleOpts = {},
): string {
  if (opts.lockedBg) {
    const i = Math.min(
      PLATE_TWEAK_EXAMPLES.length - 1,
      Math.floor(styleRealism / 40),
    );
    return PLATE_TWEAK_EXAMPLES[i] ?? PLATE_TWEAK_EXAMPLES[0];
  }
  if (opts.hasStock) {
    const i = Math.min(
      TWEAK_EXAMPLES.length - 1,
      Math.floor(styleRealism / 30),
    );
    return TWEAK_EXAMPLES[i] ?? TWEAK_EXAMPLES[0];
  }
  if (styleId === "deepfake") {
    return pickStyleIdeaPrompt(styleId);
  }
  const band = realismBand(styleRealism);
  return BY_STYLE[styleId]?.[band] ?? BY_STYLE.skidmarks[band];
}
