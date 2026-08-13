import { NextResponse } from "next/server";
import { getCharacter } from "@/lib/characters";
import { elevenKeyPresent, synthesizeSpeech } from "@/lib/elevenLabs";
import {
  getEpisode,
  patchShotPrompts,
  saveEpisode,
  setShotVoiceFile,
} from "@/lib/store";
import { ensureShotBeats } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

type Ctx = {
  params: Promise<{ id: string; sceneId: string; shotId: string }>;
};

type Speaker = {
  name: string;
  voiceId: string;
};

/**
 * Exact / first-name match. Cast before victim so "Chloe" never becomes Darryl.
 */
function matchSpeaker(
  want: string,
  victim: ReturnType<typeof getCharacter>,
  cast: { id: string; name: string; approvedVoiceId: string }[],
): Speaker | null {
  const w = want.trim().toLowerCase();
  if (!w) return null;

  for (const c of cast) {
    if (!c.approvedVoiceId) continue;
    const n = c.name.trim().toLowerCase();
    const first = n.split(/\s+/)[0] || n;
    if (w === n || w === first) {
      return { name: c.name, voiceId: c.approvedVoiceId };
    }
  }

  if (victim?.approvedVoiceId) {
    const vn = victim.name.trim().toLowerCase();
    const parts = vn.split(/\s+/).filter(Boolean);
    const vfirst = parts[0] || vn;
    const vlast = parts[parts.length - 1] || vn;
    if (
      w === vn ||
      w === vfirst ||
      w === vlast ||
      w === "kim" ||
      w === "darryl" ||
      w === "crackwhore darryl"
    ) {
      return { name: victim.name, voiceId: victim.approvedVoiceId };
    }
  }

  // Loose contains — cast only, then victim (still cast-first)
  for (const c of cast) {
    if (!c.approvedVoiceId) continue;
    const n = c.name.trim().toLowerCase();
    const first = n.split(/\s+/)[0] || n;
    if (first.length > 2 && (w.includes(n) || w.includes(first))) {
      return { name: c.name, voiceId: c.approvedVoiceId };
    }
  }
  if (victim?.approvedVoiceId) {
    const vn = victim.name.trim().toLowerCase();
    const parts = vn.split(/\s+/).filter(Boolean);
    const vfirst = parts[0] || vn;
    const vlast = parts[parts.length - 1] || vn;
    if (
      w.includes(vn) ||
      (vfirst.length > 2 && (w.includes(vfirst) || vfirst.includes(w))) ||
      (vlast.length > 3 && w.includes(vlast))
    ) {
      return { name: victim.name, voiceId: victim.approvedVoiceId };
    }
  }

  return null;
}

/**
 * Who speaks.
 * If the beat/UI named a speaker, that wins — never fall back to Darryl.
 */
function pickSpeaker(
  shot: { resolveNotes: string; title: string },
  beatSpeaker: string,
  victim: ReturnType<typeof getCharacter>,
  cast: { id: string; name: string; approvedVoiceId: string }[],
  explicitFromUi: boolean,
): Speaker | null {
  if (beatSpeaker.trim()) {
    const hit = matchSpeaker(beatSpeaker, victim, cast);
    if (hit) return hit;
    // UI/beat named someone we can't resolve — fail, don't give Darryl
    if (explicitFromUi) return null;
  }

  const notes = (shot.resolveNotes || "").trim();
  const speakerNote = notes.match(/Speaker:\s*([^\n.]+)/i)?.[1]?.trim();
  if (speakerNote) {
    const hit = matchSpeaker(speakerNote, victim, cast);
    if (hit) return hit;
  }

  const title = (shot.title || "").trim();
  for (const c of cast) {
    if (!c.approvedVoiceId) continue;
    const first = (c.name.split(/\s+/)[0] || c.name).toLowerCase();
    if (first.length > 2 && title.toLowerCase().startsWith(first)) {
      return { name: c.name, voiceId: c.approvedVoiceId };
    }
  }

  if (victim?.approvedVoiceId) {
    return { name: victim.name, voiceId: victim.approvedVoiceId };
  }

  const any = cast.find((c) => c.approvedVoiceId);
  if (any) return { name: any.name, voiceId: any.approvedVoiceId };
  return null;
}

/**
 * TEXT box = what ElevenLabs speaks. Whole field wins.
 * Old bug: only the first "quoted" chunk was spoken — tail after the quotes
 * was dropped, so Rebuild felt like it ignored your edit.
 */
function spokenLineFromTextBox(textSegment: string): string {
  const textRow = (textSegment || "").trim();
  if (!textRow) return "";
  // Whole field wrapped in one pair of quotes → unwrap
  const wrapped =
    textRow.match(/^"([\s\S]*)"$/) || textRow.match(/^“([\s\S]*)”$/);
  if (wrapped) return wrapped[1].trim();
  // Otherwise speak the lot — strip quote marks so TTS doesn’t say “quote”
  return textRow.replace(/["“”]/g, "").replace(/\s+/g, " ").trim();
}

function speechFromImage(imageMotion: string): string {
  const row = (imageMotion || "").match(/\[SPEECH\]:\s*(.+)$/im)?.[1]?.trim();
  if (!row) return "";
  const q =
    row.match(/"([^"]+)"/) ||
    row.match(/“([^”]+)”/);
  if (q) return q[1].trim();
  return row.replace(/^[^:]+:\s*/, "").trim();
}

function spokenLine(
  textSegment: string,
  resolveNotes: string,
  imageMotion = "",
): string {
  const fromText = spokenLineFromTextBox(textSegment);
  if (fromText) return fromText;
  const fromImage = speechFromImage(imageMotion);
  if (fromImage) return fromImage;
  const lineFromNotes = (resolveNotes || "").match(
    /Line:\s*(.+)$/im,
  )?.[1]?.trim();
  return (lineFromNotes || "").trim();
}

/** Generate dialogue mp3 for one beat (or beat 0). */
export async function POST(req: Request, ctx: Ctx) {
  const { id, sceneId, shotId } = await ctx.params;
  const ep = getEpisode(id);
  if (!ep) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!elevenKeyPresent()) {
    return NextResponse.json(
      { error: "Missing ELEVENLABS_API_KEY in MY MOVIES\\.env" },
      { status: 503 },
    );
  }

  // Quiet / "silent" vibe shots still get mp3s per beat — stack always has audio.

  let beatId = "";
  let speakerFromUi = "";
  let textFromUi = "";
  let body: {
    beatId?: string;
    speaker?: string;
    textSegment?: string;
    global?: string;
    beats?: {
      id: string;
      label?: string;
      speaker?: string;
      imageMotion?: string;
      textSegment?: string;
      imageSeconds?: number;
      textSeconds?: number;
      gapAfterSeconds?: number;
    }[];
  } = {};
  try {
    body = (await req.json().catch(() => ({}))) as typeof body;
    beatId = body.beatId || "";
    speakerFromUi = (body.speaker || "").trim();
    textFromUi = (body.textSegment || "").trim();
  } catch {
    beatId = "";
  }

  let epLive = ep;
  if (body.global !== undefined || (body.beats && body.beats.length)) {
    const saved = patchShotPrompts(id, sceneId, shotId, {
      global: body.global,
      beats: body.beats,
    });
    if (saved) epLive = saved;
  }

  const scene = epLive.scenes.find((s) => s.id === sceneId);
  const shotRaw = scene?.shots.find((s) => s.id === shotId);
  if (!scene || !shotRaw) {
    return NextResponse.json({ error: "Shot not found" }, { status: 404 });
  }

  const shot = ensureShotBeats(shotRaw);

  // Never fall back to Beat 1 when Beat 2's id was sent — that felt like "rebuild broke"
  const beat = beatId
    ? shot.beats.find((b) => b.id === beatId)
    : shot.beats[0];
  if (beatId && !beat) {
    return NextResponse.json(
      { error: `Beat not found (${beatId}) — refresh Studio and try again` },
      { status: 400 },
    );
  }
  if (!beat) {
    return NextResponse.json({ error: "No beat on shot" }, { status: 400 });
  }

  // Fresh episode — Keep voice in Scene kit must be visible here
  const epNow = getEpisode(id) || epLive;

  // What you see on screen wins over stale disk — TEXT box only (never smear IMAGE into TEXT)
  const beatSpeaker = speakerFromUi || beat.speaker || "";
  const textSegment = textFromUi || beat.textSegment || "";
  const explicitFromUi = Boolean(speakerFromUi || beat.speaker?.trim());

  const line = spokenLine(textSegment, shot.resolveNotes, beat.imageMotion);
  if (!line) {
    return NextResponse.json(
      {
        error:
          "Put the spoken words in TEXT (quotes for Generate mp3) on this beat",
      },
      { status: 400 },
    );
  }

  const victim = epNow.victimCharacterId
    ? getCharacter(epNow.victimCharacterId)
    : null;
  const cast = (epNow.cast || []).map((c) => ({
    id: c.id,
    name: c.name,
    approvedVoiceId: c.approvedVoiceId,
  }));

  const speaker = pickSpeaker(
    shot,
    beatSpeaker,
    victim,
    cast,
    explicitFromUi,
  );

  if (!speaker) {
    return NextResponse.json(
      {
        error: beatSpeaker
          ? `No locked voice for "${beatSpeaker}" — Scene kit → Keep voice on ${beatSpeaker}`
          : "No locked voice — Keep Darryl's / cast voice in the kit first",
      },
      { status: 400 },
    );
  }

  try {
    const buffer = await synthesizeSpeech({
      voiceId: speaker.voiceId,
      text: line,
    });
    const episode = setShotVoiceFile(id, sceneId, shotId, {
      buffer,
      ext: ".mp3",
      beatId: beat.id,
    });
    if (!episode) {
      return NextResponse.json({ error: "Save failed" }, { status: 500 });
    }

    // Persist speaker choice onto the beat so next Save keeps it
    const withSpeaker = {
      ...episode,
      scenes: episode.scenes.map((s) =>
        s.id !== sceneId
          ? s
          : {
              ...s,
              shots: s.shots.map((sh) => {
                if (sh.id !== shotId) return sh;
                const beats = (sh.beats || []).map((b) =>
                  b.id === beat.id
                    ? {
                        ...b,
                        speaker: speaker.name,
                        // Keep TEXT as the dialogue box — never replace with IMAGE
                        textSegment: textSegment || b.textSegment,
                      }
                    : b,
                );
                return { ...sh, beats };
              }),
            },
      ),
    };
    const saved = saveEpisode(withSpeaker);

    const updated = saved.scenes
      .find((s) => s.id === sceneId)
      ?.shots.find((s) => s.id === shotId);
    const updatedBeat = updated?.beats?.find((b) => b.id === beat.id);
    // Rough duration from mp3 bytes (~128kbps) so UI can show it stuck vs short line
    const durationSec = Math.max(
      0.1,
      Math.round((buffer.length * 8) / 128000 * 10) / 10,
    );
    return NextResponse.json({
      episode: saved,
      beatId: beat.id,
      voiceFile: updatedBeat?.voiceFile || updated?.voiceFile || "",
      speaker: speaker.name,
      voiceId: speaker.voiceId,
      line,
      durationSec,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
