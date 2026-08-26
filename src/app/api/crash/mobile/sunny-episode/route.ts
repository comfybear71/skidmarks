import { NextResponse } from "next/server";
import { applyImportedStoryToJob } from "@/lib/mobileApplyScreenplay";
import { createMobileGenJob, patchMobileGenJob } from "@/lib/mobileGenJob";
import { importPastedStory, parseMobilePaste } from "@/lib/mobilePasteScript";
import { DEFAULT_DESK_ID } from "@/lib/mobileDesk";
import { newId } from "@/lib/types";
import {
  isSunnyExtraName,
  isSunnySeriesName,
  matchSunnyPlaceLoose,
  SUNNY_SERIES_NAMES,
  sunnyEpisodeGate,
  sunnyGuestLooksFromScript,
} from "@/lib/sunnyEpisodeSpec";
import { listSunnyShelfPlaces } from "@/lib/sunnyEpisodeShelf";
import {
  attachSunnyCharacterPlates,
  copySunnyPlaceStills,
  findSunnyReusableFaces,
  seedSunnyCastCandidates,
} from "@/lib/sunnyEpisodeSeed";

export const runtime = "nodejs";
export const maxDuration = 300;

const DEFAULT_SECONDS_PER_SHOT = 5;

/**
 * POST { brief, script } — Sunny Banks create-episode.
 * Locks the paste, picks series faces/places, then /step cooks plates
 * and clips. No Pick this one. No Send this. Extras are not faces.
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
    const deskId = body.deskId || DEFAULT_DESK_ID;
    const shelfPlaces = await listSunnyShelfPlaces();
    const gate = sunnyEpisodeGate({ brief, script, shelfPlaces });
    if (!gate.ok) {
      return NextResponse.json(
        { error: gate.error, scan: gate.scan },
        { status: 400 },
      );
    }

    const scriptSpeakers = gate.scan.speakers.filter((s) => !isSunnyExtraName(s));
    const reusable = await findSunnyReusableFaces(scriptSpeakers, deskId);
    const guestLooks = sunnyGuestLooksFromScript(script);
    const speakers = [
      ...new Set([
        ...scriptSpeakers,
        ...SUNNY_SERIES_NAMES.filter((name) => reusable[name]),
      ]),
    ];
    const missingSeries = scriptSpeakers.filter(
      (name) => isSunnySeriesName(name) && !reusable[name],
    );
    if (missingSeries.length) {
      return NextResponse.json(
        {
          error: `Couldn't find the locked ${missingSeries.join(", ")} face. Those stay the series cards — won't invent them.`,
          scan: gate.scan,
        },
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
      deskId,
    });

    const scenes = gate.scan.places.map((placeName) => {
      const hit = matchSunnyPlaceLoose(placeName, shelfPlaces);
      return {
        id: newId("scene"),
        placeName: hit?.name || placeName,
        worldThumbKey: hit?.thumbKey || "",
      };
    });

    const storyPlaces = pasted.story.scenes.map((sc) => {
      const hit = matchSunnyPlaceLoose(sc.placeName, shelfPlaces);
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
      roster: speakers.map((name) => ({
        name,
        description: "",
        appearance: reusable[name]?.look || guestLooks[name] || "",
      })),
      scenes,
      castCandidates: seedSunnyCastCandidates(reusable),
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
    const speakersOnly = [
      ...new Set([
        ...updated.speakers.filter((s) => !isSunnyExtraName(s)),
        ...SUNNY_SERIES_NAMES.filter((name) => reusable[name]),
      ]),
    ];
    const locationCandidates = await copySunnyPlaceStills({
      job: { ...updated, speakers: speakersOnly },
      places: gate.scan.places,
      shelf: shelfPlaces,
    });
    const characterPlates = await attachSunnyCharacterPlates(updated, speakersOnly);
    const jobOut = await patchMobileGenJob(updated.id, {
      speakers: speakersOnly,
      castCandidates: {
        ...updated.castCandidates,
        ...seedSunnyCastCandidates(reusable),
      },
      locationCandidates,
      characterPlates,
      sunnyAuto: true,
      phase: "plates",
      error: "",
    });

    return NextResponse.json({ ok: true, job: jobOut || updated, scan: gate.scan });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
