import { NextResponse } from "next/server";
import { applyImportedStoryToJob } from "@/lib/mobileApplyScreenplay";
import { findReusableCastCards } from "@/lib/mobileCastReuse";
import { createMobileGenJob, patchMobileGenJob } from "@/lib/mobileGenJob";
import { importPastedStory, parseMobilePaste } from "@/lib/mobilePasteScript";
import { DEFAULT_DESK_ID } from "@/lib/mobileDesk";
import { newId } from "@/lib/types";
import { isSunnyExtraName, matchSunnyPlace, sunnyEpisodeGate } from "@/lib/sunnyEpisodeSpec";
import { listSunnyShelfPlaces } from "@/lib/sunnyEpisodeShelf";

export const runtime = "nodejs";
export const maxDuration = 300;

const DEFAULT_SECONDS_PER_SHOT = 5;

/**
 * POST { brief, script } — Sunny Banks create-episode.
 * Locks the paste. Extras (residents, turkeys, props) are not faces.
 * Missing guest stills land on CAST after Make — they do not block start.
 * Does not cook plates or LTX. Does not mint a music-video job.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      brief?: string;
      script?: string;
      styleRealism?: number;
      deskId?: string;
    };
    const brief = (body.brief || "").trim();
    const script = (body.script || "").trim();
    const shelfPlaces = await listSunnyShelfPlaces();
    const gate = sunnyEpisodeGate({ brief, script, shelfPlaces });
    if (!gate.ok) {
      return NextResponse.json(
        { error: gate.error, scan: gate.scan },
        { status: 400 },
      );
    }

    const pasted = parseMobilePaste(script, "sunny_banks", gate.scan.title || "Untitled episode");
    const title = gate.scan.title || pasted.title || "Untitled episode";
    const gag = gate.scan.gag || brief || pasted.logline || title;

    const created = await createMobileGenJob({
      styleId: "sunny_banks",
      prompt: gag,
      targetDurationSec: 0,
      secondsPerShot: DEFAULT_SECONDS_PER_SHOT,
      styleRealism:
        typeof body.styleRealism === "number" ? body.styleRealism : 25,
      deskId: body.deskId || DEFAULT_DESK_ID,
    });

    const speakers = gate.scan.speakers;
    const reusable = speakers.length
      ? await findReusableCastCards("sunny_banks", speakers)
      : {};
    const castCandidates: Record<
      string,
      { id: string; fileName: string; approved: boolean; prompt: string }[]
    > = {};
    for (const [name, card] of Object.entries(reusable)) {
      castCandidates[name] = [
        {
          id: card.fileName,
          fileName: card.fileName,
          approved: true,
          prompt: card.look || "",
        },
      ];
    }

    const scenes = gate.scan.places.map((placeName) => {
      const hit = matchSunnyPlace(placeName, shelfPlaces);
      return {
        id: newId("scene"),
        placeName: hit?.name || placeName,
        worldThumbKey: hit?.thumbKey || "",
      };
    });

    const storyPlaces = pasted.story.scenes.map((sc) => {
      const hit = matchSunnyPlace(sc.placeName, shelfPlaces);
      const scene = scenes.find(
        (s) => s.placeName.toLowerCase() === (hit?.name || sc.placeName).toLowerCase(),
      );
      return {
        ...sc,
        id: scene?.id || sc.id,
        placeName: hit?.name || sc.placeName,
        worldThumbKey: scene?.worldThumbKey || sc.worldThumbKey || "",
      };
    });
    const story = {
      ...pasted.story,
      campaignLabel: title,
      gagNote: gag,
      scenes: storyPlaces,
    };

    const seeded = await patchMobileGenJob(created.id, {
      prompt: gag,
      speakers,
      roster: speakers.map((name) => ({ name, description: "", appearance: "" })),
      scenes,
      castCandidates,
    });
    const job = seeded || created;

    const runTag = job.id.slice(-6);
    const packTitle = `${title} ${runTag}`;
    const { folderName } = await importPastedStory({
      styleId: "sunny_banks",
      title: packTitle,
      story: { ...story, campaignLabel: packTitle },
    });

    const updated = await applyImportedStoryToJob({
      job,
      folderName,
      story: { ...story, campaignLabel: packTitle },
      parsedCharacters: pasted.characters.filter((c) => !isSunnyExtraName(c.name)),
    });
    const speakersOnly = updated.speakers.filter((s) => !isSunnyExtraName(s));
    const jobOut =
      speakersOnly.length !== updated.speakers.length
        ? await patchMobileGenJob(updated.id, { speakers: speakersOnly })
        : updated;

    return NextResponse.json({ ok: true, job: jobOut || updated, scan: gate.scan });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
