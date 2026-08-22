import { parseProductionScript } from "./scriptParser";
import { newId, type ScriptCharacterData, type ScriptEpisodeData } from "./types";
import type {
  CrashStoryBeat,
  CrashStoryDoc,
  CrashStoryScene,
  CrashStoryShot,
} from "./crashStoryTypes";
import type { ShowStyleId } from "./showStylePresets";

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
}): string {
  const vibe = job.prompt.trim();
  const artist = (job.artist || "").trim();
  const song = (job.songTitle || "").trim();
  const credit = [artist, song].filter(Boolean).join(" — ");
  const title =
    credit || vibe.split(/\n/)[0]?.slice(0, 80) || "Untitled episode";
  const gag = credit ? [vibe, `Artist: ${artist || "—"}`, `Song: ${song || "—"}`].filter(Boolean).join("\n") : vibe;
  const shots = job.scenes.map((s, i) =>
    [`--- SHOT ${i + 1} ---`, `Place: ${s.placeName}`, "Title: ", "Action: ", "Plate: "].join("\n"),
  );
  return [`EPISODE: ${title}`, `GAG: ${gag}`, "", ...shots].join("\n\n");
}

/** A music video's only audio is the dropped mp3 — shots with no dialogue
 * already get a valid silent "hold" beat (holdOrSpoken below), so requiring
 * a typed line here would only ever force fake lyrics into the box. */
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
  lines: { speaker: string; text: string }[];
};

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
      new Set(beats.map((b) => b.speaker).filter(Boolean)),
    );
    const next: CrashStoryShot = {
      id: newId("shot"),
      title: shot.title || placeName,
      summary: shot.summary,
      staging: shot.staging || (cast.length ? `${cast.join(", ")} · ${placeName}` : placeName),
      plateFile: "",
      beats,
      sfx: [],
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
      if (/^(Cast|SFX|GAG|EPISODE):/i.test(line)) continue;
      const cue = line.match(/^([A-Z][A-Z0-9_\s\-']{1,40})$/);
      const next = lines[n + 1] || "";
      if (cue && next && !/^(Place|Title|Action|Plate|Cast|SFX):/i.test(next)) {
        spoken.push({ speaker: cue[1].trim(), text: next });
        n += 1;
        continue;
      }
      const inline = line.match(/^([^:]{1,40}):\s+(.+)$/);
      if (inline && !/^(place|title|action|plate|cast|sfx|gag|episode)$/i.test(inline[1])) {
        spoken.push({ speaker: inline[1].trim(), text: inline[2].trim() });
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

function ensureProductionWrapper(text: string, fallbackTitle: string): string {
  let body = text.trim();
  if (!/^ACT\s+[IVX]+/im.test(body)) {
    body = `ACT I\n\n${body}`;
  }
  if (!/Episode\s+\d+:\s*"/i.test(body)) {
    body = `Skidmarks\nEpisode 1: "${fallbackTitle}"\n\n${body}`;
  }
  return body;
}

function parseProductionPaste(text: string, styleId: ShowStyleId, fallbackTitle: string): MobilePasteResult {
  const wrapped = ensureProductionWrapper(text, fallbackTitle);
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

/** One paste → story. JSON, --- SHOT --- blocks, or production screenplay. */
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
    if (styleId !== "music_video" && !storyHasSpokenLine(json.story)) {
      throw new Error("Need at least one spoken line. Tap AI, then tweak.");
    }
    return json;
  }

  const pasted = /---\s*SHOT/i.test(text)
    ? parseShotBlocks(text, styleId)
    : parseProductionPaste(text, styleId, fallbackTitle);
  if (styleId !== "music_video" && !storyHasSpokenLine(pasted.story)) {
    throw new Error("Need at least one spoken line. Tap AI, then tweak.");
  }
  return pasted;
}
