/**
 * Scratch prompt bible — framing, motion, camera, genre blocks.
 * Structural descriptive language only. No moderation-bypass / attire euphemism bank.
 */

export type ScratchBibleSectionId =
  | "frame"
  | "motion"
  | "camera"
  | "drama"
  | "danger"
  | "horror"
  | "enlighten"
  | "dream"
  | "dystopia";

export type ScratchBibleEntry = {
  id: string;
  label: string;
  /** Staging / motion block with {{name}} {{place}} tokens. */
  template: string;
};

export type ScratchBibleSection = {
  id: ScratchBibleSectionId;
  label: string;
  hint: string;
  entries: ScratchBibleEntry[];
};

export const SCRATCH_PROMPT_BIBLE: ScratchBibleSection[] = [
  {
    id: "frame",
    label: "Frame",
    hint: "Placement & aspect of the still",
    entries: [
      {
        id: "frame-ucu",
        label: "Ultra close-up",
        template:
          "Extreme close-up of {{name}} at {{place}}. Camera locked to eye-level. Filling the frame from neck up. Head moves slightly with speech.",
      },
      {
        id: "frame-mcu",
        label: "Medium cinematic",
        template:
          "Medium close-up of {{name}} at {{place}}. Upper torso and face visible. {{name}} holds an item naturally at chest height. Shallow depth of field.",
      },
      {
        id: "frame-ots",
        label: "Over-shoulder",
        template:
          "Over-the-shoulder perspective at {{place}}. Looking past a foreground silhouette toward {{name}} standing about three meters away.",
      },
      {
        id: "frame-thirds",
        label: "Rule of thirds",
        template:
          "Asymmetric framing at {{place}}. {{name}} positioned strictly on the left third of the frame, looking across open empty space on the right.",
      },
      {
        id: "frame-full",
        label: "Full-body silhouette",
        template:
          "Wide full-body shot of {{name}} at {{place}}. Subject centered against a dominant back-lit environment, clear body outline and stride geometry.",
      },
    ],
  },
  {
    id: "motion",
    label: "Motion stress",
    hint: "Interpolation / joint / tracking tests",
    entries: [
      {
        id: "motion-spin",
        label: "Rapid spin",
        template:
          "Dynamic rotational motion. {{name}} performs a swift 360-degree pivot mid-stride at {{place}}. Kinetic motion blur on background details.",
      },
      {
        id: "motion-stride",
        label: "Kinetic stride",
        template:
          "Brisk forward locomotion. Steady tracking camera retreats at identical speed. Continuous rhythmic footsteps matching head bobbing. {{name}} at {{place}}.",
      },
      {
        id: "motion-handcam",
        label: "Jerky hand-cam",
        template:
          "Unstable handheld documentation style. Rapid micro-jitters and organic camera shakes. {{name}} remains locked in sharp focus at {{place}}.",
      },
      {
        id: "motion-joints",
        label: "Multi-joint stressor",
        template:
          "Complex coordination. {{name}} hammers fingers rapidly against a surface while rhythmically nodding and shifting weight side-to-side at {{place}}.",
      },
      {
        id: "motion-reveal",
        label: "Spatial reveal",
        template:
          "Fast linear camera progression. Camera passes closely by static foreground obstacles to reveal {{name}} standing behind them at {{place}}.",
      },
    ],
  },
  {
    id: "camera",
    label: "Camera",
    hint: "Isolate path at the top of the prompt",
    entries: [
      {
        id: "cam-push",
        label: "Z-axis push",
        template:
          "[Camera: Steady linear push-in. Frame smoothly tightens onto {{name}}'s face over the duration, increasing background blur.]",
      },
      {
        id: "cam-low",
        label: "Low-angle menace",
        template:
          "[Camera: Low-angle perspective looking upward at {{name}}. Track slightly left to right to build environmental tension at {{place}}.]",
      },
      {
        id: "cam-crane",
        label: "Drone crane drop",
        template:
          "[Camera: High-altitude crane shot descending smoothly at {{place}}. Shifting from bird's-eye to an eye-level medium wide on {{name}}.]",
      },
      {
        id: "cam-pan",
        label: "Side profile pan",
        template:
          "[Camera: Lateral tracking shot. Moving parallel to {{name}}'s path at {{place}}, keeping spacing constant.]",
      },
    ],
  },
  {
    id: "drama",
    label: "Drama",
    hint: "Face micro-expression / slow burn",
    entries: [
      {
        id: "drama-breakdown",
        label: "Emotional breakdown",
        template:
          "Tight macro close-up of {{name}} at {{place}}. Subtle jaw trembling. Eyes watering with intense focus. Head shakes slightly in disbelief.",
      },
      {
        id: "drama-interrogation",
        label: "Interrogation",
        template:
          "Harsh top-down key light on {{name}} at {{place}}. Subject leans forward across a dark void. Shadow cuts across eyes. Minimalist dark environment.",
      },
      {
        id: "drama-confront",
        label: "Sudden confrontation",
        template:
          "Camera tracks backward rapidly. {{name}} steps forward abruptly at {{place}}. Eyes widen. Hand grasps at throat. Sharp focus shifts.",
      },
      {
        id: "drama-regret",
        label: "Quiet regret",
        template:
          "Profile silhouette of {{name}} at {{place}}. Stares out a rainy window. Droplets cast moving shadows across the cheek.",
      },
    ],
  },
  {
    id: "danger",
    label: "Danger",
    hint: "Velocity / debris / tracking",
    entries: [
      {
        id: "danger-miss",
        label: "Near miss",
        template:
          "Extreme camera shake. {{name}} ducks violently to the left at {{place}}. Debris fragments fly past the lens. High motion blur.",
      },
      {
        id: "danger-escape",
        label: "Active escape",
        template:
          "Low-angle tracking shot. {{name}} sprints forward at {{place}}. Breath mist visible. Knees lifting high. Background blurs into streaks.",
      },
      {
        id: "danger-fall",
        label: "Sudden fall",
        template:
          "Vertical camera plunge. {{name}} slips backward into darkness at {{place}}. Hands reach upward toward the camera. Spatial depth distortion.",
      },
      {
        id: "danger-shock",
        label: "Shockwave",
        template:
          "Instantaneous screen jitter. {{name}} is thrown slightly off-balance at {{place}}. Dust particles swirl rapidly around the frame.",
      },
    ],
  },
  {
    id: "horror",
    label: "Horror",
    hint: "Uncanny body / light / stutter",
    entries: [
      {
        id: "horror-glitch",
        label: "Uncanny glitch",
        template:
          "Static medium shot of {{name}} at {{place}}. Subject stands frozen. Head snaps 45 degrees instantly. Eyes wide and unblinking. Strobe lighting.",
      },
      {
        id: "horror-shadow",
        label: "Shadow creep",
        template:
          "Dim monochromatic lighting at {{place}}. High-contrast silhouettes. A dark shape expands on the wall behind oblivious {{name}}.",
      },
      {
        id: "horror-reveal",
        label: "Abrupt reveal",
        template:
          "Pitch black frame. Sudden flashlight beam illuminates {{name}}'s pale face inches from the lens at {{place}}. Jaw open wide.",
      },
      {
        id: "horror-corrupt",
        label: "Corrupted frame",
        template:
          "Atmospheric visual noise at {{place}}. {{name}} moves with jagged, missing-frame stutter. Limbs appear unnaturally elongated in shadow.",
      },
    ],
  },
  {
    id: "enlighten",
    label: "Enlighten",
    hint: "Volumetric light / particles",
    entries: [
      {
        id: "enlighten-glow",
        label: "Volumetric glow",
        template:
          "Centred symmetrical framing of {{name}} at {{place}}. Golden light rays burst from behind the subject. Floating dust motes in the beams.",
      },
      {
        id: "enlighten-awaken",
        label: "Awakening",
        template:
          "Slo-motion upward camera tilt on {{name}} at {{place}}. Looks skyward. Irises shift color subtly. Micro-particles float upward against gravity.",
      },
      {
        id: "enlighten-aura",
        label: "Aura shift",
        template:
          "Ethereal soft-focus render of {{name}} at {{place}}. Subtle prismatic light leaks ripple across the face. Shimmering bokeh background.",
      },
      {
        id: "enlighten-float",
        label: "Floating calm",
        template:
          "Weightless environment at {{place}}. {{name}} hovers millimeters off the ground. Hair and loose fabric float gently upward.",
      },
    ],
  },
  {
    id: "dream",
    label: "Dream",
    hint: "Surreal geometry / liquid",
    entries: [
      {
        id: "dream-mirror",
        label: "Liquid mirror",
        template:
          "Ground ripples like water with every footstep at {{place}}. {{name}} walks on a reflective cloud layer. Twin horizons.",
      },
      {
        id: "dream-kaleido",
        label: "Kaleidoscope",
        template:
          "Geometric background shapes shift and rotate slowly at {{place}}. Gravity appears inverted for props. {{name}} remains stable.",
      },
      {
        id: "dream-echo",
        label: "Echoing silhouette",
        template:
          "{{name}} walks forward at {{place}}, leaving fading transparent trails of previous movements in sequence.",
      },
      {
        id: "dream-scale",
        label: "Shifting scale",
        template:
          "Macro details of everyday objects appear massive behind {{name}} at {{place}}. Giant floating keys and ticking clocks. Deep focus.",
      },
    ],
  },
  {
    id: "dystopia",
    label: "Dystopia",
    hint: "Fog / neon / industrial",
    entries: [
      {
        id: "dystopia-neon",
        label: "Neon rain deck",
        template:
          "High-contrast cyber styling. {{name}} stands under a flickering neon sign at {{place}}. Rain bounces off shoulders. Deep blacks.",
      },
      {
        id: "dystopia-smog",
        label: "Industrial smog",
        template:
          "Thick volumetric green haze at {{place}}. Looming pipes and brutalist concrete. {{name}} in sleek hazard activewear.",
      },
      {
        id: "dystopia-wall",
        label: "Monolithic watcher",
        template:
          "Extreme low angle. {{name}} looks up at a massive wall of screens flashing synchronized static at {{place}}.",
      },
      {
        id: "dystopia-grime",
        label: "Tech grime",
        template:
          "Harsh fluorescent side-lighting on {{name}} at {{place}}. Subtle metallic mesh plating on skin. Dust and rust flakes in the air.",
      },
    ],
  },
];

export function applyBibleTokens(
  template: string,
  opts: { name: string; place: string; cast?: string[] },
): string {
  const name = opts.name.trim() || "Character";
  const place = opts.place.trim() || "this place";
  const cast = (opts.cast?.length ? opts.cast : [name]).join(", ");
  return template
    .replaceAll("{{name}}", name)
    .replaceAll("{{place}}", place)
    .replaceAll("{{cast}}", cast);
}

/** Build the rapid multi-genre 4-block layout. */
export function composeBibleBlocks(parts: {
  camera?: string;
  subject?: string;
  action?: string;
  style?: string;
}): string {
  const lines: string[] = [];
  if (parts.camera?.trim()) lines.push(parts.camera.trim());
  if (parts.subject?.trim()) lines.push(`[Subject] ${parts.subject.trim()}`);
  if (parts.action?.trim()) lines.push(`[Action] ${parts.action.trim()}`);
  if (parts.style?.trim()) lines.push(`[Style] ${parts.style.trim()}`);
  return lines.join("\n\n");
}

export const SCRATCH_BIBLE_DEFAULT_STYLE =
  "Stylized cinematic composition, sharp focus, consistent character identity with the face card.";
