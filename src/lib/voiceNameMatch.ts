/** Token match so "Crazy Big Hole Jo Too" still hits a library voice named Jo. */

function normalizeName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export function voiceNamesMatch(a: string, b: string): boolean {
  const n = normalizeName(a);
  const cn = normalizeName(b);
  if (!n || !cn) return false;
  if (n === cn) return true;
  if (cn.endsWith(` ${n}`) || cn.startsWith(`${n} `)) return true;
  if (n.endsWith(` ${cn}`) || n.startsWith(`${cn} `)) return true;
  if (n.length >= 4 && cn.includes(n)) return true;
  if (cn.length >= 4 && n.includes(cn)) return true;
  const skip = new Set(["the", "big", "too", "one", "crazy", "hole"]);
  const tokens = n.split(/[^a-z0-9]+/).filter((t) => t.length >= 2 && !skip.has(t));
  for (const t of tokens) {
    if (
      t.length >= 2 &&
      (cn === t ||
        cn.endsWith(` ${t}`) ||
        cn.startsWith(`${t} `) ||
        cn.includes(` ${t} `))
    ) {
      return true;
    }
  }
  return false;
}

export const STOCK_ADAM_VOICE_ID = "pNInz6obpgDQGcFmaJgB";

export type PickableVoice = {
  voiceId: string;
  name: string;
  category?: string;
  gender?: string;
};

export function usableLibraryVoices(library: PickableVoice[]): PickableVoice[] {
  return library.filter(
    (v) =>
      v.voiceId?.trim() &&
      v.voiceId !== STOCK_ADAM_VOICE_ID &&
      (v.category || "").toLowerCase() !== "premade",
  );
}

function stableIndex(name: string, count: number): number {
  let hash = 0;
  for (const ch of name.trim().toLowerCase()) {
    hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  }
  return count > 0 ? hash % count : 0;
}

/** Core picker — no show-preset imports, so the check script can load it. */
export function pickLibraryVoiceFromPool(opts: {
  speaker: string;
  library: PickableVoice[];
  taken?: Iterable<string>;
  showLabel: string;
  otherLabels: string[];
  wantedSex: "female" | "male";
}): string {
  const used = new Set(
    [...(opts.taken || [])].map((id) => id.trim()).filter(Boolean),
  );
  const usable = usableLibraryVoices(opts.library).filter((v) => !used.has(v.voiceId));
  if (!usable.length) return "";
  const named = usable.filter((v) => voiceNamesMatch(opts.speaker, v.name));
  const showLabel = opts.showLabel.toLowerCase();
  const otherLabels = opts.otherLabels.map((o) => o.toLowerCase());
  const thisShow = named.filter((v) => v.name.toLowerCase().includes(showLabel));
  const unclaimed = named.filter(
    (v) => !otherLabels.some((o) => v.name.toLowerCase().includes(o)),
  );
  const bySex = usable.filter((v) => v.gender === opts.wantedSex);
  const pool = bySex.length ? bySex : usable;
  return (
    thisShow[0]?.voiceId ||
    unclaimed[0]?.voiceId ||
    named[0]?.voiceId ||
    pool[stableIndex(opts.speaker, pool.length)]?.voiceId ||
    ""
  );
}
