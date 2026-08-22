import { NextResponse } from "next/server";
import { applyImportedStoryToJob } from "@/lib/mobileApplyScreenplay";
import { patchMobileGenJob, readMobileGenJob } from "@/lib/mobileGenJob";
import { canLockEpisode } from "@/lib/mobileJobReady";
import { importPastedStory } from "@/lib/mobilePasteScript";
import { buildMusicVideoStartStory } from "@/lib/musicVideoStart";
import { findSongCarrierBeatId, isMusicVideoSongJob } from "@/lib/musicVideoSong";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * POST { jobId, lyrics? } — music video has no script. Build one shot per
 * band member at the first place, lock the pack, return a carrier beat for
 * the parked mp3.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      jobId?: string;
      lyrics?: string;
    };
    const jobId = (body.jobId || "").trim();
    if (!jobId) return NextResponse.json({ error: "Need jobId" }, { status: 400 });

    const job = await readMobileGenJob(jobId);
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    if (!isMusicVideoSongJob(job)) {
      return NextResponse.json({ error: "Start the video is Music video only." }, { status: 400 });
    }
    if (!canLockEpisode(job.phase)) {
      return NextResponse.json(
        { error: "This episode is already animating. Open it in Crash Lab — don't start over." },
        { status: 409 },
      );
    }
    if (job.folderName) {
      return NextResponse.json({ error: "This video is already started." }, { status: 409 });
    }

    const built = buildMusicVideoStartStory(job);
    const runTag = jobId.slice(-6);
    const packTitle = `${built.title} ${runTag}`;
    const story = { ...built.story, campaignLabel: packTitle };

    const { folderName } = await importPastedStory({
      styleId: job.styleId,
      title: packTitle,
      story,
    });

    const updated = await applyImportedStoryToJob({
      job,
      folderName,
      story,
      parsedCharacters: built.characters,
    });

    const lyrics = typeof body.lyrics === "string" ? body.lyrics : job.lyrics || "";
    const withLyrics =
      lyrics.trim() && lyrics !== (job.lyrics || "")
        ? await patchMobileGenJob(jobId, { lyrics })
        : updated;

    const carrierBeatId = findSongCarrierBeatId(story);

    return NextResponse.json({
      ok: true,
      job: withLyrics || updated,
      carrierBeatId,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
