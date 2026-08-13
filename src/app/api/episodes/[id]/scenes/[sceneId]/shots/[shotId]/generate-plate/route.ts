import { NextResponse } from "next/server";
import {
  faceFilePath,
  getCharacter,
  listCharacters,
} from "@/lib/characters";
import { castFacePath } from "@/lib/episodeCast";
import {
  buildShotPlatePrompt,
  generateFaceImage,
  imageKeyPresent,
} from "@/lib/imageGen";
import { getLocation, locationRefPath } from "@/lib/locations";
import { getEpisode, patchShotPrompts, setShotPlate } from "@/lib/store";
import type { Character } from "@/lib/types";
import { ensureShotBeats } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

type Ctx = {
  params: Promise<{ id: string; sceneId: string; shotId: string }>;
};

function faceFileForCast(
  episodeId: string,
  castId: string,
  approvedFaceId: string,
  faceAttempts: { id: string; fileName: string; status: string }[],
): string | null {
  const attempt =
    faceAttempts.find((a) => a.id === approvedFaceId) ||
    faceAttempts.find((a) => a.status === "approved" && a.fileName);
  if (!attempt?.fileName) return null;
  return castFacePath(episodeId, castId, attempt.fileName);
}

function faceFileForVictim(
  characterId: string,
  approvedFaceId: string,
  faceAttempts: { id: string; fileName: string; status: string }[],
): string | null {
  const attempt =
    faceAttempts.find((a) => a.id === approvedFaceId) ||
    faceAttempts.find((a) => a.status === "approved" && a.fileName);
  if (!attempt?.fileName) return null;
  return faceFilePath(characterId, attempt.fileName);
}

/** People named in haystack — victim first, then cast. Max 3 faces. */
function peopleForShot(
  haystack: string,
  victimName: string | null,
  cast: { id: string; name: string }[],
): { id: string; name: string; kind: "victim" | "cast" }[] {
  const text = haystack.toLowerCase();
  const out: { id: string; name: string; kind: "victim" | "cast" }[] = [];

  if (victimName) {
    const n = victimName.trim();
    const parts = n.split(/\s+/).filter(Boolean);
    const first = parts[0] || n;
    const last = parts[parts.length - 1] || n;
    // First name matters — Lab names like "Kim the Gypsy KUNT" only say "Kim" in plates.
    if (
      text.includes(n.toLowerCase()) ||
      (first.length > 2 && text.includes(first.toLowerCase())) ||
      (last.length > 2 && text.includes(last.toLowerCase()))
    ) {
      out.push({ id: "victim", name: n, kind: "victim" });
    }
  }

  for (const c of cast) {
    const n = c.name.trim();
    if (!n) continue;
    const first = n.split(/\s+/)[0] || n;
    if (
      text.includes(n.toLowerCase()) ||
      (first.length > 2 && text.includes(first.toLowerCase()))
    ) {
      out.push({ id: c.id, name: n, kind: "cast" });
    }
  }

  // No silent Darryl fallback — empty means name who is in frame in PLATE PROMPT
  return out.slice(0, 3);
}

function tidy(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

/**
 * Look line for one person in frame.
 * Character bible first (holds them the same show-wide), then this episode's
 * cast note after it so wardrobe changes override the clothes. Never truncated.
 */
/** Recurring cast can have a bible entry too — matched on name. */
function lockedLookFor(name: string, lab: Character[]): string {
  const key = tidy(name).toLowerCase();
  return lab.find((c) => tidy(c.name).toLowerCase() === key)?.lookNote || "";
}

function identityFor(opts: {
  name: string;
  locked: string;
  episodeNote: string;
}): string {
  const locked = tidy(opts.locked);
  const note = tidy(opts.episodeNote);
  if (locked && note) return `${locked}. This episode: ${note}`;
  return (
    locked || note || `${opts.name}, Skidmarks cast, caricatured 3D face`
  );
}

/** Shot plate for one beat (or beat 0). Face refs only; place in words. */
export async function POST(req: Request, ctx: Ctx) {
  const { id, sceneId, shotId } = await ctx.params;
  const ep = getEpisode(id);
  if (!ep) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!imageKeyPresent()) {
    return NextResponse.json(
      { error: "Missing XAI_API_KEY in MY MOVIES\\.env" },
      { status: 503 },
    );
  }

  let beatId = "";
  let platePromptFromUi = "";
  let body: {
    beatId?: string;
    platePrompt?: string;
    global?: string;
    beats?: {
      id: string;
      label?: string;
      speaker?: string;
      platePrompt?: string;
      imageMotion?: string;
      textSegment?: string;
      imageSeconds?: number;
      textSeconds?: number;
      actionSegment?: string;
      actionSeconds?: number;
      gapAfterSeconds?: number;
    }[];
  } = {};
  try {
    body = (await req.json().catch(() => ({}))) as typeof body;
    beatId = body.beatId || "";
    platePromptFromUi = (body.platePrompt || "").trim();
  } catch {
    beatId = "";
  }

  // Save what's on screen FIRST — also ADDS new beats (Beat 3) so they don't vanish
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
  const beat = beatId
    ? shot.beats.find((b) => b.id === beatId)
    : shot.beats[0];
  if (beatId && !beat) {
    return NextResponse.json(
      { error: `Beat not found (${beatId}) — refresh and try again` },
      { status: 400 },
    );
  }
  if (!beat) {
    return NextResponse.json({ error: "No beat on shot" }, { status: 400 });
  }

  const victim = ep.victimCharacterId
    ? getCharacter(ep.victimCharacterId)
    : null;

  const sceneIsHell = /HELL|CREDITS/i.test(scene?.title || "");
  // Bus impact: face-edit glues Kim big beside the bus. Force wide + text-only.
  const sceneIsBusImpact =
    /SMASHED/i.test(scene?.title || "") &&
    /cut before impact|into the path/i.test(
      `${shot?.title || ""} ${beat?.label || ""}`,
    ) &&
    !/SIDE OF BUS|cutaway|pass/i.test(shot?.title || "");
  const skipFaceEdit = sceneIsHell || sceneIsBusImpact;
  // Hell: Stuie's PLATE PROMPT wins. Do NOT force old demon-pack / torn-in-half text —
  // that made Rebuild ignore the box and spit the same camp hell every time.
  const BUS_IMPACT_PLATE =
    "highly detailed stylised 3D animated feature render, clean simplified forms, believable materials, soft overcast lighting, cinematic quality, sharp focus. Not photographic, not a cartoon. Wide shot from far away at a wet bus terminal under grey overcast sky. A big white coach bus fills most of the frame, side on, nose pointing right, back end cut off the left of the picture. Tiny Kim stands right in front of the bus nose — in the path of the bus, about to get hit. She is small. The bus is huge. She looks terrified. Cream blouse, black trousers, heels, gold jewellery, long brown hair. Freeze before it hits her.";

  let platePrompt =
    platePromptFromUi || (beat.platePrompt || "").trim();
  if (sceneIsBusImpact && !platePrompt) {
    platePrompt = BUS_IMPACT_PLATE;
  } else if (sceneIsBusImpact) {
    // Keep forced wide bus composition only when he left the box empty
    platePrompt = platePrompt || BUS_IMPACT_PLATE;
  }
  // Optional one-line override when locked look fights the beat (e.g. hell ruin).
  // Write: BEAT LOOK: <description>  — used instead of Lab immaculate wardrobe.
  const beatLookMatch = platePrompt.match(/BEAT LOOK:\s*(.+?)(?:\n|$)/i);
  const beatLook = (beatLookMatch?.[1] || "").trim();
  // Faces = who is ON CAMERA only. Never Speaker / TEXT / GLOBAL / SPEECH —
  // those name Darryl for voice and he gets glued into girls-only plates.
  const visualOnly = (beat.imageMotion || "")
    .replace(/\[SPEECH\][\s\S]*/i, "")
    .trim();
  const haystack = `${platePrompt}\n${visualOnly}`;
  const people = peopleForShot(
    haystack,
    victim?.name || null,
    (ep.cast || []).map((c) => ({ id: c.id, name: c.name })),
  );

  const lab = listCharacters();
  const refPaths: string[] = [];
  const peopleMeta: { name: string; identity: string }[] = [];
  const missing: string[] = [];

  for (const p of people) {
    if (p.kind === "victim") {
      if (!victim) {
        missing.push(p.name);
        continue;
      }
      const fp = faceFileForVictim(
        victim.id,
        victim.approvedFaceId,
        victim.faceAttempts,
      );
      if (!fp && !skipFaceEdit) {
        missing.push(victim.name);
        continue;
      }
      // Hell / bus smash: text-only. Glam face edit forces camera stare + clean clothes.
      if (fp && !skipFaceEdit) refPaths.push(fp);
      peopleMeta.push({
        name: victim.name,
        identity: beatLook
          ? beatLook
          : sceneIsBusImpact
            ? "Kim, high-maintenance woman, cream blouse, black trousers, gold jewellery, long brown hair — tiny distant figure in front of a bus, terrified"
            : identityFor({
                name: victim.name,
                locked: victim.lookNote,
                episodeNote: "",
              }),
      });
    } else {
      const c = (ep.cast || []).find((x) => x.id === p.id);
      if (!c) continue;
      const fp = faceFileForCast(
        id,
        c.id,
        c.approvedFaceId,
        c.faceAttempts,
      );
      if (!fp) {
        missing.push(c.name);
        continue;
      }
      refPaths.push(fp);
      peopleMeta.push({
        name: c.name,
        identity: identityFor({
          name: c.name,
          locked: lockedLookFor(c.name, lab),
          episodeNote: c.roleNote || "",
        }),
      });
    }
  }

  if (missing.length) {
    return NextResponse.json(
      { error: `Lock faces first: ${missing.join(", ")}` },
      { status: 400 },
    );
  }
  const emptyCutaway =
    Boolean(shot.cutaway) ||
    /empty of (all )?people/i.test(platePrompt) ||
    /cutaway/i.test(shot.title || "");
  const busSidePass =
    emptyCutaway &&
    /SMASHED/i.test(scene?.title || "") &&
    (/pass|cutaway|SIDE OF BUS/i.test(shot?.title || "") ||
      /SIDE of bus/i.test(beat?.label || ""));
  if (!refPaths.length && !skipFaceEdit && !emptyCutaway) {
    return NextResponse.json(
      {
        error:
          "Name who is in frame in PLATE PROMPT (e.g. Chloe and Sarah). Speaker / TEXT are ignored for faces.",
      },
      { status: 400 },
    );
  }
  if (skipFaceEdit && !peopleMeta.length && !emptyCutaway) {
    return NextResponse.json(
      { error: "Name Kim in the plate prompt." },
      { status: 400 },
    );
  }
  if (sceneIsHell && !peopleMeta.length) {
    return NextResponse.json(
      { error: "Hell plate needs Kim named in the plate prompt." },
      { status: 400 },
    );
  }

  const loc = scene.locationId ? getLocation(scene.locationId) : null;
  const room = loc?.rooms.find((r) => r.id === scene.roomId) || null;
  // Never feed "Bus Terminal (Kim)" into the prompt — model paints it on signs.
  const scrubPlace = (s: string) =>
    (s || "")
      .replace(/\s*\([^)]*\)\s*/g, " ")
      .replace(/\bKim\b/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();
  const placeDescription = sceneIsHell
    ? "" // Hell place lives in Stuie's PLATE PROMPT — don't inject volcanic demon default
    : [
        scrubPlace(loc?.name || ""),
        scrubPlace(room?.name || ""),
        scrubPlace(loc?.lookNote || ""),
        scrubPlace(room?.lookNote || ""),
      ]
        .filter(Boolean)
        .join(". ");

  if (!platePrompt) {
    return NextResponse.json(
      {
        error:
          "Write PLATE PROMPT first — who is in frame, pose, props (Build plate reads that box)",
      },
      { status: 400 },
    );
  }

  // Don't append "feet down / not mid-stunt" — that fights action plates (bus leap, bag swing).
  const poseNote = `${platePrompt}. Single still frame of this beat.`;

  let prompt: string;
  if (sceneIsBusImpact && !platePromptFromUi && !(beat.platePrompt || "").trim()) {
    prompt = [
      BUS_IMPACT_PLATE,
      "COMPOSITION: bus is huge. Kim is tiny. Kim is IN FRONT of the bus nose — in the path — about to get hit. Not beside the bus.",
      "Wide shot from far away, 768 by 512. No writing, no logos, no labels.",
    ].join("\n\n");
  } else if (busSidePass) {
    // Prefer Stuie's flat side-profile coach ref (nose RIGHT).
    const sideRefs = [...(room?.references || []), ...(loc?.references || [])];
    const busRef =
      sideRefs.find((r) => /BUS SIDE|side profile|nose RIGHT/i.test(r.label)) ||
      sideRefs.find((r) => /bus/i.test(r.label)) ||
      sideRefs[0];
    if (busRef && loc) {
      const rp = locationRefPath(loc.id, busRef.fileName, room?.id);
      if (rp) refPaths.push(rp);
    }
    prompt = [
      "Edit the reference into a stylised 3D animated feature still.",
      "KEEP the exact same flat SIDE PROFILE and direction: nose of the bus on the RIGHT, rear on the LEFT.",
      "White coach bus, full side, windows row, wheels. Wet bus terminal ground, overcast grey sky soft behind.",
      "Empty of people. No woman. No person. No face. Bus only.",
      "Not photographic, not a cartoon. Clean simplified forms, believable materials, cinematic, sharp focus.",
      "768 by 512. No writing, no watermarks, no logos, no labels.",
    ].join("\n");
  } else if (emptyCutaway) {
    prompt = [
      "highly detailed stylised 3D animated feature render, clean simplified forms, believable materials, soft overcast lighting, shallow depth of field, cinematic quality, sharp focus. Not photographic, not a cartoon.",
      "LOOK LOCK: stylised 3D animated feature — sculpted forms, believable materials. Clearly made, not a camera photo.",
      "Empty of people — no humans, no faces.",
      `Place: ${placeDescription}`,
      `Pose / beat: ${poseNote}`,
      "Wide low shot, 768 by 512. No writing, no signage text, no labels, no captions, no watermarks.",
    ].join("\n\n");
  } else {
    prompt = buildShotPlatePrompt({
      people: peopleMeta,
      placeDescription,
      poseNote,
    });
  }

  try {
    const { buffer, ext } = await generateFaceImage({
      prompt,
      referencePaths: refPaths,
      aspectRatio: "3:2",
    });
    const episode = setShotPlate(id, sceneId, shotId, {
      buffer,
      ext,
      beatId: beat.id,
    });
    if (!episode) {
      return NextResponse.json({ error: "Save failed" }, { status: 500 });
    }
    const updated = episode.scenes
      .find((s) => s.id === sceneId)
      ?.shots.find((s) => s.id === shotId);
    const updatedBeat = updated?.beats?.find((b) => b.id === beat.id);
    return NextResponse.json({
      episode,
      beatId: beat.id,
      plateFile: updatedBeat?.plateFile || updated?.plateFile || "",
      people: peopleMeta.map((p) => p.name),
      place: loc ? `${loc.name}${room ? ` — ${room.name}` : ""}` : "",
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
