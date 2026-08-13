import { STYLE_PICK_IDEAS, pickBrandNewStyleCharacterIdea } from "./crashGenExamples";
import type { ShowStyleId } from "./showStylePresets";
import { SHOW_STYLE_PRESETS } from "./showStylePresets";

export type StyleCharacterEntry = {
  name: string;
  brief: string;
};

/** Name + one-line brief parsed from each style Idea prompt. */
export function getStyleCharacterRoster(styleId: ShowStyleId): StyleCharacterEntry[] {
  return (STYLE_PICK_IDEAS[styleId] ?? []).map(parseIdeaPrompt);
}

/** Green face line on Script desk style cards — e.g. "Lab faces — Kim, DAP…" */
const STYLE_FACE_LABEL: Record<ShowStyleId, string> = {
  skidmarks: "Lab faces",
  sunny_banks: "Cast",
  doc: "Subjects",
  music_video: "Performers",
  deepfake: "Faces",
  photoreal: "Portraits",
};

export function styleFaceSummaryLine(styleId: ShowStyleId): string {
  const names = getStyleCharacterRoster(styleId).map((e) => e.name);
  if (!names.length) return "";
  const label = STYLE_FACE_LABEL[styleId] ?? "Faces";
  const joined = names.join(", ");
  if (joined.length <= 56) return `${label} — ${joined}`;
  const cut = joined.slice(0, 56);
  const tidy = cut.replace(/, [^,]*$/, "");
  return `${label} — ${tidy}…`;
}

export function pairStyleCharacters(
  styleId: ShowStyleId,
  thumbs: { key: string; name?: string; brief?: string; mtime?: number }[],
): { key: string; name: string; brief: string; labeled: boolean; faceCount: number }[] {
  void styleId;
  const rows = thumbs.map((thumb, i) => {
    const rawName = (thumb.name || "").trim();
    const brief = (thumb.brief || "").trim();
    // Re-parse brief/prompt when manifest stuck on junk "Character"
    const repaired =
      !rawName || /^character$/i.test(rawName)
        ? parseIdeaPrompt(brief || rawName)
        : null;
    const name = repaired?.name && !/^character$/i.test(repaired.name)
      ? repaired.name
      : rawName;
    const finalBrief = repaired?.brief || brief;
    const mtime = thumb.mtime || 0;

    if (name && !/^character$/i.test(name) && finalBrief) {
      return {
        key: thumb.key,
        name,
        brief: finalBrief,
        labeled: true,
        mtime,
      };
    }
    if (name && !/^character$/i.test(name)) {
      return {
        key: thumb.key,
        name,
        brief: finalBrief || "Pick who this is — image and name must match",
        labeled: Boolean(thumb.name && !/^character$/i.test(thumb.name)),
        mtime,
      };
    }
    return {
      key: thumb.key,
      name: `Face ${i + 1}`,
      brief: "Pick who this is — image and name must match",
      labeled: false,
      mtime,
    };
  });

  // One cast row per person — extra takes stay faces, not clone cast members.
  const byName = new Map<
    string,
    { key: string; name: string; brief: string; labeled: boolean; mtime: number; faceCount: number }
  >();
  for (const row of rows) {
    const id = row.labeled
      ? row.name.trim().toLowerCase()
      : `unnamed:${row.key}`;
    const prev = byName.get(id);
    if (!prev) {
      byName.set(id, { ...row, faceCount: 1 });
      continue;
    }
    prev.faceCount += 1;
    // Prefer newest thumb as the row face; keep a real brief (not "session take").
    const briefBetter =
      !/session take/i.test(row.brief) && /session take/i.test(prev.brief);
    if (row.mtime >= prev.mtime || briefBetter) {
      prev.key = row.key;
      prev.mtime = Math.max(prev.mtime, row.mtime);
      if (briefBetter || prev.brief.length < row.brief.length) {
        prev.brief = row.brief;
      }
    }
  }
  return [...byName.values()].map(({ mtime: _m, ...rest }) => rest);
}

export function rosterEntryByName(
  styleId: ShowStyleId,
  name: string,
): StyleCharacterEntry | null {
  return getStyleCharacterRoster(styleId).find((e) => e.name === name) ?? null;
}

/** Name + brief from an Idea prompt — "Name — brief. look line…" */
export function parseCharacterPromptLabel(prompt: string): StyleCharacterEntry {
  return parseIdeaPrompt(prompt);
}

/** Idea for a new face — skips names already saved for this style. */
export function pickFreshStyleCharacterIdea(
  styleId: ShowStyleId,
  usedNames: string[] = [],
  avoid?: string,
): string {
  return pickBrandNewStyleCharacterIdea(styleId, usedNames, avoid);
}

/** True when develop-box text belongs to a different style's roster. */
export function characterPromptWrongStyle(
  styleId: ShowStyleId,
  text: string,
): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  const name = parseCharacterPromptLabel(trimmed).name.toLowerCase();
  const own = getStyleCharacterRoster(styleId).some(
    (e) => e.name.toLowerCase() === name,
  );
  if (own) return false;
  for (const preset of SHOW_STYLE_PRESETS) {
    if (preset.id === styleId) continue;
    if (
      getStyleCharacterRoster(preset.id).some(
        (e) => e.name.toLowerCase() === name,
      )
    ) {
      return true;
    }
  }
  return false;
}

function looksLikePersonName(raw: string): boolean {
  const name = raw.trim();
  if (name.length < 2 || name.length > 48) return false;
  if (/^(character|face\s*\d*|portrait|a|an|the|untitled)$/i.test(name)) {
    return false;
  }
  // Places / props that slipped into cast
  if (
    /\b(hatchback|car|pub|street|location|podium|room|kitchen|exterior)\b/i.test(
      name,
    )
  ) {
    return false;
  }
  return /^[A-Za-z][A-Za-z0-9 .'\-]*$/.test(name);
}

/** Name + brief from Idea / CURSOR prompts — em dash, "Name is…", or "Name, portrait…". */
function parseIdeaPrompt(prompt: string): StyleCharacterEntry {
  const trimmed = prompt.trim();
  if (!trimmed) return { name: "Character", brief: "" };

  const dash = trimmed.indexOf(" — ");
  if (dash !== -1) {
    const name = trimmed.slice(0, dash).trim();
    const rest = trimmed.slice(dash + 3);
    const cut = rest.split(".")[0]?.trim() || rest;
    if (looksLikePersonName(name)) {
      return { name, brief: trimBrief(cut) };
    }
  }

  // Prefer "Deep Fried Terry is…" — name words only (no "highly detailed. …").
  const isHit = trimmed.match(
    /(?:^|[.!?]\s+)([A-Z][A-Za-z0-9'\-]*(?:\s+[A-Z][A-Za-z0-9'\-]*){0,4})\s+is\s+(a|an|the)\b/,
  );
  if (isHit && looksLikePersonName(isHit[1])) {
    return {
      name: isHit[1].trim().replace(/\s+/g, " "),
      brief: trimBrief(trimmed),
    };
  }

  const portraitHit = trimmed.match(
    /^([A-Za-z][A-Za-z0-9 .'\-]{1,48}?),\s*(portrait|highly|stylised|stylized)\b/i,
  );
  if (portraitHit && looksLikePersonName(portraitHit[1])) {
    return {
      name: portraitHit[1].trim().replace(/\s+/g, " "),
      brief: trimBrief(trimmed.slice(portraitHit[0].length)),
    };
  }

  const comma = trimmed.indexOf(",");
  if (comma > 1 && comma <= 40) {
    const maybe = trimmed.slice(0, comma).trim();
    if (looksLikePersonName(maybe)) {
      return { name: maybe, brief: trimBrief(trimmed.slice(comma + 1)) };
    }
  }

  return { name: "Character", brief: trimBrief(trimmed) };
}

function trimBrief(text: string, max = 110): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}
