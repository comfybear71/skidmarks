/** Human-readable file names for dialogue + SFX (Resolve + Comfy). */

export function slugToken(raw: string, max = 28): string {
  return (
    raw
      .normalize("NFKD")
      .replace(/[^\w\s'-]+/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, max) || "line"
  );
}

export function slugSpeaker(name: string): string {
  return slugToken(name.replace(/\s+/g, "_"), 24);
}

/** e.g. 03_02_Nuggets_Wah-wah-skree-boop.mp3 */
export function dialogueFileName(opts: {
  shotNum: number;
  beatNum: number;
  speaker: string;
  text: string;
}): string {
  const s = String(opts.shotNum).padStart(2, "0");
  const b = String(opts.beatNum).padStart(2, "0");
  return `${s}_${b}_${slugSpeaker(opts.speaker)}_${slugToken(opts.text, 36)}.mp3`;
}

/** e.g. 03_SFX_Tarp-flap.mp3 */
export function sfxFileName(opts: { shotNum: number; label: string }): string {
  const s = String(opts.shotNum).padStart(2, "0");
  return `${s}_SFX_${slugToken(opts.label, 40)}.mp3`;
}

export function shotFolderName(opts: {
  shotNum: number;
  shotId: string;
  title: string;
}): string {
  const s = String(opts.shotNum).padStart(2, "0");
  const title = slugToken(opts.title, 32);
  return `${s}_${title || opts.shotId}`;
}
