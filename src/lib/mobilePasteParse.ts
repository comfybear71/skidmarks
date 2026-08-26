import { parseProductionScript } from "./scriptParser";
import { newId, type ScriptCharacterData, type ScriptEpisodeData } from "./types";
import type {
  CrashStoryBeat,
  CrashStoryDoc,
  CrashStoryScene,
  CrashStoryShot,
} from "./crashStoryTypes";
import type { ShowStyleId } from "./showStylePresets";
import { productionShowLabel, styleEpisodeBlank } from "./styleEpisodeProcess";
import { canonicalSunnyName } from "./sunnyEpisodeSpec";

export const MOBILE_PASTE_SAMPLE = `EPISODE: Crazy Big Hole Jo
GAG: Jo falls in a hole. Matty has a bar.

--- SHOT 1 ---
Place: Matty bar
Title: Matty waves her in
Action: Tire tracks on the lawn. Matty leans on the fridge.
MATTY
You coming in or what?
JO
I fell in a hole.`;

export function episodeTemplateFromJob(job: {
  prompt: string;
  speakers: string[];
  scenes: { placeName: string }[];
  artist?: string;
  songTitle?: string;
  styleId?: ShowStyleId;
}): string {
  return styleEpisodeBlank(job);
}

export function storyHasSpokenLine(story: CrashStoryDoc): boolean {
  return story.scenes.some((sc) =>
    sc.shots.some((sh) => sh.beats.some((b) => b.text.trim())),
  );
}

export type MobilePasteResult = {
  title: string;
  logline: string;
  characters: ScriptCharacterData[];
  story: CrashStoryDoc;
};

/** Fold INT./EXT. headings and job place names onto the same key. */
export function normalizePlaceKey(name: string): string {
  return name
    .replace(/^(int|ext)\.\s*/i, "")
    .replace(/\s+-\s+(day|night|dawn|dusk|evening|morning|later|continuous|same).*$/i, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function titleCaseName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

/** Place match happens on lock from the job's picked stills — not the world shelf. */

function canonSpeaker(styleId: ShowStyleId, name: string): string {
  const raw = name.trim();
  if (!raw) return "";
  return styleId === "sunny_banks" ? canonicalSunnyName(raw) : raw;
}

function holdOrSpoken(
  lines: { speaker: string; text: string }[],
): CrashStoryBeat[] {
  if (!lines.length) {
    const id = newId("beat");
    return [{ id, speaker: "", text: "", voiceFile: `${id}.mp3` }];
  }
  return lines.map((d) => ({
    id: newId("beat"),
    speaker: d.speaker.trim() ? titleCaseName(d.speaker) : "",
    text: d.text.trim(),
    voiceFile: "",
  }));
}

function emptyBookend() {
  return { title: "", notes: "", sfx: [] as CrashStoryDoc["intro"]["sfx"] };
}

type LooseShot = {
  placeName: string;
  title: string;
  summary: string;
  staging: string;
  camera?: string;
  castNames?: string[];
  cues?: string[];
  lines: { speaker: string; text: string }[];
};

function cuesFromSfxLine(raw: string): string[] {
  return raw
    .split("|")
    .map((bit) => bit.replace(/^\[|\]$/g, "").trim())
    .filter(Boolean);
}

function cuesFromBracketLine(raw: string): string[] {
  const out: string[] = [];
  const re = /\[([^\[\]]+)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    const bit = (m[1] || "").trim();
    if (bit) out.push(bit);
  }
  return out;
}

function shotsToStory(
  styleId: ShowStyleId,
  title: string,
  logline: string,
  shots: LooseShot[],
): CrashStoryDoc {
  const scenes: CrashStoryScene[] = [];
  const byPlace = new Map<string, CrashStoryScene>();

  for (const shot of shots) {
    const placeName = shot.placeName.trim();
    if (!placeName) continue;
    const key = normalizePlaceKey(placeName);
    let scene = byPlace.get(key);
    if (!scene) {
      scene = {
        id: newId("scene"),
        title: placeName,
        placeName,
        worldThumbKey: "",
        shots: [],
      };
      byPlace.set(key, scene);
      scenes.push(scene);
    }
    const beats = holdOrSpoken(shot.lines);
    const cast = Array.from(
      new Set(
        [...(shot.castNames || []), ...beats.map((b) => b.speaker)].filter(Boolean),
      ),
    );
    const camera = (shot.camera || "").trim();
    const stagingBits = [
      camera ? `Camera: ${camera}.` : "",
      shot.staging,
    ].filter(Boolean);
    const next: CrashStoryShot = {
      id: newId("shot"),
      title: shot.title || placeName,
      summary: shot.summary,
      staging:
        stagingBits.join(" ") ||
        (cast.length ? `${cast.join(", ")} · ${placeName}` : placeName),
      plateFile: "",
      beats,
      sfx: (shot.cues || []).map((label) => ({
        id: newId("sfx"),
        label,
        notes: "",
      })),
    };
    scene.shots.push(next);
  }

  if (!scenes.length) {
    throw new Error("Need at least one shot with a Place.");
  }

  return {
    styleId,
    campaignLabel: title,
    gagNote: logline,
    intro: emptyBookend(),
    outro: emptyBookend(),
    scenes,
    updatedAt: new Date().toISOString(),
  };
}

function charactersFromNames(names: string[]): ScriptCharacterData[] {
  const seen = new Set<string>();
  const out: ScriptCharacterData[] = [];
  for (const raw of names) {
    const name = raw.trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    out.push({ name, description: "", appearance: "" });
  }
  return out;
}

function speakersFromStory(story: CrashStoryDoc): string[] {
  return story.scenes.flatMap((sc) =>
    sc.shots.flatMap((sh) => sh.beats.map((b) => b.speaker).filter(Boolean)),
  );
}

function stripFence(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json|text|screenplay)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function readLine(obj: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function parseBeats(raw: unknown): { speaker: string; text: string }[] {
  if (!Array.isArray(raw)) return [];
  const lines: { speaker: string; text: string }[] = [];
  for (const item of raw) {
    if (typeof item === "string") {
      const m = item.match(/^([^:]+):\s*(.+)$/);
      if (m) lines.push({ speaker: m[1].trim(), text: m[2].trim() });
      else if (item.trim()) lines.push({ speaker: "", text: item.trim() });
      continue;
    }
    const rec = asRecord(item);
    if (!rec) continue;
    const speaker = readLine(rec, "speaker", "character", "name");
    const text = readLine(rec, "line", "text", "dialogue");
    if (speaker || text) lines.push({ speaker, text });
  }
  return lines;
}

function parseJsonPaste(doc: Record<string, unknown>, styleId: ShowStyleId): MobilePasteResult {
  if (Array.isArray(doc.episodes)) {
    const episodes = doc.episodes as ScriptEpisodeData[];
    const first = episodes[0];
    if (!first?.scenes?.length) {
      throw new Error("JSON episodes need at least one scene.");
    }
    const shots: LooseShot[] = first.scenes.map((sc) => {
      const heading = sc.heading || "";
      const place = heading.replace(/^(INT|EXT)\.\s*/i, "").replace(/\s+-\s+.+$/, "").trim() || heading;
      return {
        placeName: place,
        title: heading || place,
        summary: (sc.action || []).join(" ").trim(),
        staging: "",
        lines: (sc.dialogueLines || []).map((d) => ({
          speaker: d.character,
          text: d.line,
        })),
      };
    });
    const title = first.title || readLine(doc, "title", "episode") || "Untitled episode";
    const story = shotsToStory(styleId, title, first.logline || "", shots);
    return {
      title,
      logline: first.logline || "",
      characters: charactersFromNames(speakersFromStory(story)),
      story,
    };
  }

  const title = readLine(doc, "title", "episode") || "Untitled episode";
  const logline = readLine(doc, "logline", "gag");
  const scenesIn = Array.isArray(doc.scenes) ? doc.scenes : [];
  if (!scenesIn.length) {
    throw new Error('JSON needs "scenes" (place + shots + beats) or "episodes".');
  }

  const shots: LooseShot[] = [];
  for (const rawScene of scenesIn) {
    const scene = asRecord(rawScene);
    if (!scene) continue;
    const placeName =
      readLine(scene, "place", "placeName", "heading", "location") || "";
    const sceneBeats = parseBeats(scene.beats || scene.dialogueLines);
    const nested = Array.isArray(scene.shots) ? scene.shots : [];
    if (!nested.length) {
      shots.push({
        placeName,
        title: readLine(scene, "title") || placeName,
        summary: readLine(scene, "action", "summary"),
        staging: readLine(scene, "staging"),
        lines: sceneBeats,
      });
      continue;
    }
    for (const rawShot of nested) {
      const shot = asRecord(rawShot);
      if (!shot) continue;
      shots.push({
        placeName: readLine(shot, "place", "placeName") || placeName,
        title: readLine(shot, "title") || placeName,
        summary: readLine(shot, "action", "summary"),
        staging: readLine(shot, "staging"),
        lines: parseBeats(shot.beats || shot.lines) || sceneBeats,
      });
    }
  }

  const story = shotsToStory(styleId, title, logline, shots);
  const named = Array.isArray(doc.characters)
    ? doc.characters.flatMap((c) => {
        if (typeof c === "string") return charactersFromNames([c]);
        const rec = asRecord(c);
        if (!rec) return [];
        const name = readLine(rec, "name");
        if (!name) return [];
        return [
          {
            name,
            description: readLine(rec, "description"),
            appearance: readLine(rec, "appearance", "look"),
          } satisfies ScriptCharacterData,
        ];
      })
    : charactersFromNames(speakersFromStory(story));

  return { title, logline, characters: named, story };
}

function parseShotBlocks(text: string, styleId: ShowStyleId): MobilePasteResult {
  const epMatch = text.match(/^EPISODE:\s*(.+)$/im);
  const gagMatch = text.match(/^GAG:\s*(.+)$/im);
  const title = epMatch?.[1]?.trim() || "Untitled episode";
  const logline = gagMatch?.[1]?.trim() || "";

  const parts = text.split(/(?:^|\n)---\s*SHOT(?:\s+\d+)?\s*---\s*/im).slice(1);
  if (!parts.length) {
    throw new Error("Need at least one --- SHOT --- block.");
  }

  const shots: LooseShot[] = [];
  for (const [i, block] of parts.entries()) {
    const lines = block.split("\n").map((l) => l.trim());
    let placeName = "";
    let titleLine = `Shot ${i + 1}`;
    let summary = "";
    let staging = "";
    let camera = "";
    let namedSpeaker = "";
    const castNames: string[] = [];
    const cues: string[] = [];
    const spoken: { speaker: string; text: string }[] = [];
    for (let n = 0; n < lines.length; n++) {
      const line = lines[n];
      if (!line) continue;
      const place = line.match(/^Place:\s*(.+)$/i);
      if (place) {
        placeName = place[1].trim();
        continue;
      }
      const t = line.match(/^Title:\s*(.+)$/i);
      if (t) {
        titleLine = t[1].trim();
        continue;
      }
      const plate = line.match(/^Plate:\s*(.+)$/i);
      if (plate) {
        staging = plate[1].trim();
        continue;
      }
      const action = line.match(/^Action:\s*(.+)$/i);
      if (action) {
        summary = action[1].trim();
        continue;
      }
      const cam = line.match(/^Camera:\s*(.+)$/i);
      if (cam) {
        camera = cam[1].trim();
        continue;
      }
      const cast = line.match(/^Cast:\s*(.+)$/i);
      if (cast) {
        for (const name of cast[1].split(/,|&|\band\b/i)) {
          const bit = canonSpeaker(styleId, name.trim());
          if (bit && !/^none$/i.test(bit)) castNames.push(bit);
        }
        continue;
      }
      const named = line.match(/^Name:\s*(.+)$/i);
      if (named) {
        const bit = canonSpeaker(styleId, named[1].trim());
        if (bit && !/^none$/i.test(bit)) namedSpeaker = bit;
        continue;
      }
      const sfx = line.match(/^SFX:\s*(.+)$/i);
      if (sfx) {
        cues.push(...cuesFromSfxLine(sfx[1]));
        continue;
      }
      if (/^(GAG|EPISODE):/i.test(line)) continue;
      if (/^\[[^\]]+\]/.test(line)) {
        cues.push(...cuesFromBracketLine(line));
        const after = line.replace(/^\[[^\]]+\]\s*/, "").trim();
        const text = stripWrapQuotes(after);
        if (text && namedSpeaker) {
          spoken.push({ speaker: namedSpeaker, text });
        }
        continue;
      }
      const quotedOnly = line.match(/^[“"'](.+)[”"']\s*$/);
      if (quotedOnly && namedSpeaker) {
        spoken.push({ speaker: namedSpeaker, text: quotedOnly[1].trim() });
        continue;
      }
      const cue = line.match(/^([A-Z][A-Z0-9_\s\-']{1,40})$/);
      const next = lines[n + 1] || "";
      if (cue && next && !/^(Place|Title|Action|Plate|Cast|SFX|Camera|Name):/i.test(next)) {
        spoken.push({ speaker: canonSpeaker(styleId, cue[1].trim()), text: next });
        n += 1;
        continue;
      }
      const inline = line.match(/^([^:]{1,40}):\s+(.+)$/);
      if (
        inline &&
        !/^(place|title|action|plate|cast|sfx|gag|episode|camera|name)$/i.test(inline[1])
      ) {
        spoken.push({
          speaker: canonSpeaker(styleId, inline[1].trim()),
          text: inline[2].trim(),
        });
      }
    }
    if (!placeName) {
      throw new Error(`SHOT ${i + 1}: need Place:`);
    }
    shots.push({
      placeName,
      title: titleLine,
      summary,
      staging,
      camera,
      castNames,
      cues,
      lines: spoken,
    });
  }

  const story = shotsToStory(styleId, title, logline, shots);
  return {
    title,
    logline,
    characters: charactersFromNames(speakersFromStory(story)),
    story,
  };
}

function ensureProductionWrapper(
  text: string,
  fallbackTitle: string,
  styleId: ShowStyleId,
): string {
  let body = text.trim();
  if (!/^ACT\s+[IVX]+/im.test(body)) {
    body = `ACT I\n\n${body}`;
  }
  if (!/Episode\s+\d+:\s*"/i.test(body)) {
    body = `${productionShowLabel(styleId)}\nEpisode 1: "${fallbackTitle}"\n\n${body}`;
  }
  return body;
}

function parseProductionPaste(text: string, styleId: ShowStyleId, fallbackTitle: string): MobilePasteResult {
  const wrapped = ensureProductionWrapper(text, fallbackTitle, styleId);
  const parsed = parseProductionScript(wrapped, styleId, fallbackTitle);
  const ep = parsed.parsedEpisodes[0];
  if (!ep?.scenes?.length) {
    throw new Error(
      "Could not read that as a script. Use --- SHOT --- blocks, a production screenplay (INT./EXT. + NAME then line), or JSON with scenes/shots/beats.",
    );
  }
  const shots: LooseShot[] = ep.scenes.map((sc) => {
    const heading = sc.heading || "";
    const place =
      heading.replace(/^(INT|EXT)\.\s*/i, "").replace(/\s+-\s+.+$/, "").trim() ||
      heading;
    return {
      placeName: place,
      title: heading || place,
      summary: (sc.action || []).join(" ").trim(),
      staging: "",
      lines: (sc.dialogueLines || []).map((d) => ({
        speaker: d.character,
        text: d.line,
      })),
    };
  });
  const title = ep.title || fallbackTitle;
  const story = shotsToStory(styleId, title, ep.logline || "", shots);
  const characters = parsed.parsedCharacters.length
    ? parsed.parsedCharacters
    : charactersFromNames(speakersFromStory(story));
  return { title, logline: ep.logline || "", characters, story };
}

const CONSTRUCTION_HINT =
  /MASTER EPISODE CONSTRUCTION TEMPLATE|##\s*<ACT_|##\s*<SHOT_|\*\s*\[EP_TITLE\]:/i;

const CONSTRUCTION_SKIP_KEYS = new Set([
  "ACT",
  "ACT_NOTE",
  "BUDGET_TIER",
  "CAST",
  "CAST_BACKGROUND",
  "CAST_MAIN",
  "COLOR_LUT",
  "CUTAWAY",
  "DIAL",
  "ENV",
  "ENV_SETS",
  "EP_NUM",
  "EP_TITLE",
  "GENRE_STYLE",
  "GRAIN_OVERLAY",
  "MASTER_AUDIO_NOTE",
  "MUSIC",
  "PROP_LIST",
  "SFX",
  "TARGET_RUN_TIME",
  "TIME_LIGHTING",
  "VISUAL_ACTION",
]);

function isConstructionTemplate(text: string): boolean {
  return CONSTRUCTION_HINT.test(text);
}

function normalizeConstruction(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/##\s*<ACT_/gi, "\n## <ACT_")
    .replace(/##\s*<SHOT_/gi, "\n## <SHOT_");
}

function constructionTag(line: string): { key: string; value: string } | null {
  const m = line.match(/^\*?\s*\[([A-Z0-9_]+)\]:\s*(.*)$/i);
  if (!m) return null;
  return { key: m[1].toUpperCase(), value: (m[2] || "").trim() };
}

function stripWrapQuotes(raw: string): string {
  return raw.trim().replace(/^[“"']|[”"']$/g, "").trim();
}

function constructionSpeakerLine(line: string): { speaker: string; text: string } | null {
  const t = line.replace(/^\*\s*/, "").trim();
  if (!t) return null;
  const body = t.replace(/^\[DIAL\]:\s*/i, "").trim();
  const m = body.match(/^([A-Z][A-Z0-9]*(?:\s+[A-Z0-9]+){0,8}):\s*(.+)$/);
  if (!m) return null;
  const speaker = m[1].trim();
  if (CONSTRUCTION_SKIP_KEYS.has(speaker.replace(/\s+/g, "_"))) return null;
  const text = stripWrapQuotes(m[2]);
  if (!speaker || !text) return null;
  return { speaker, text };
}

function constructionField(block: string, key: string): string {
  const re = new RegExp(`^\\*?\\s*\\[${key}\\]:\\s*(.*)$`, "im");
  return (block.match(re)?.[1] || "").trim();
}

/** Blank construction / filled MASTER EPISODE CONSTRUCTION TEMPLATE. */
function parseConstructionTemplate(
  raw: string,
  styleId: ShowStyleId,
  fallbackTitle: string,
): MobilePasteResult {
  const text = normalizeConstruction(raw);
  const title = constructionField(text, "EP_TITLE") || fallbackTitle;
  const actChunks = text.split(/##\s*<ACT_[^>]*>/i).slice(1);
  if (!actChunks.length) {
    throw new Error("Construction template needs at least one ## <ACT_I> block.");
  }

  const shots: LooseShot[] = [];
  let shotNo = 0;
  for (const actChunk of actChunks) {
    const actName = constructionField(actChunk, "ACT") || "";
    const actPlace = constructionField(actChunk, "ENV");
    const shotChunks = actChunk.split(/##\s*<SHOT_[^>]*>/i).slice(1);
    for (const shotChunk of shotChunks) {
      shotNo += 1;
      let placeName = actPlace;
      let visual = "";
      let budget = "";
      let sfx = "";
      let music = "";
      let cutaway = "";
      const spoken: { speaker: string; text: string }[] = [];
      let mode = "";
      for (const rawLine of shotChunk.split("\n")) {
        const line = rawLine.trim();
        if (!line || line === "*") continue;
        if (/^##\s*\[/.test(line) || /^---/.test(line)) {
          mode = "";
          continue;
        }
        const tag = constructionTag(line);
        if (tag) {
          mode = tag.key;
          if (tag.key === "ENV" && tag.value) placeName = tag.value;
          if (tag.key === "BUDGET_TIER") budget = tag.value;
          if (tag.key === "VISUAL_ACTION") visual = tag.value;
          if (tag.key === "SFX") sfx = tag.value;
          if (tag.key === "MUSIC") music = tag.value;
          if (tag.key === "CUTAWAY") cutaway = tag.value;
          if (tag.key === "DIAL") {
            const hit = constructionSpeakerLine(tag.value);
            if (hit) spoken.push(hit);
          }
          continue;
        }
        const hit = constructionSpeakerLine(line);
        if (hit) {
          spoken.push(hit);
          mode = "DIAL";
        }
      }
      const place = (placeName || "").trim();
      if (!place) {
        throw new Error(`SHOT ${String(shotNo).padStart(2, "0")}: need [ENV] on the act or shot.`);
      }
      const no = String(shotNo).padStart(2, "0");
      const actBit = actName.replace(/^[IVX]+\s*—\s*/i, "").trim() || actName;
      const tags = [
        actName ? `[ACT] ${actName}` : "",
        budget ? `[BUDGET_TIER] ${budget}` : "",
        visual ? `[VISUAL_ACTION] ${visual}` : "",
        sfx ? `[SFX] ${sfx}` : "",
        music ? `[MUSIC] ${music}` : "",
        cutaway ? `[CUTAWAY] ${cutaway}` : "",
      ].filter(Boolean);
      shots.push({
        placeName: place,
        title: `SHOT ${no}${actBit ? ` — ${actBit}` : ""}`,
        summary: tags.join("\n"),
        staging: visual,
        lines: spoken,
      });
    }
  }

  if (!shots.length) {
    throw new Error("Construction template needs at least one ## <SHOT_01> inside an act.");
  }

  const story = shotsToStory(styleId, title, "", shots);
  return {
    title,
    logline: "",
    characters: charactersFromNames(speakersFromStory(story)),
    story,
  };
}

/** One paste → story. JSON, construction template, --- SHOT ---, or screenplay. */
export function parseMobilePaste(
  raw: string,
  styleId: ShowStyleId,
  fallbackTitle = "Untitled episode",
): MobilePasteResult {
  const text = stripFence(raw);
  if (!text) throw new Error("Paste the episode first.");

  if (text.startsWith("{")) {
    let doc: unknown;
    try {
      doc = JSON.parse(text);
    } catch {
      throw new Error("JSON did not parse. Check the commas.");
    }
    const rec = asRecord(doc);
    if (!rec) throw new Error("JSON needs an object with scenes or episodes.");
    const json = parseJsonPaste(rec, styleId);
    if (!storyHasSpokenLine(json.story)) {
      throw new Error("Need at least one spoken line. Tap AI, then tweak.");
    }
    return json;
  }

  const pasted = isConstructionTemplate(text)
    ? parseConstructionTemplate(text, styleId, fallbackTitle)
    : /---\s*SHOT/i.test(text)
      ? parseShotBlocks(text, styleId)
      : parseProductionPaste(text, styleId, fallbackTitle);
  if (!storyHasSpokenLine(pasted.story)) {
    throw new Error("Need at least one spoken line. Tap AI, then tweak.");
  }
  return pasted;
}
