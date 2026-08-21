import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { resolveMobileMedia, uploadMobileMedia } from "@/lib/mobileMediaStore";
import { readMobileStory } from "@/lib/mobileStoryStore";
import { patchMobileGenJob, readMobileGenJob } from "@/lib/mobileGenJob";
import { runScratchLtxClip } from "@/lib/mobileScratchClip";
import { mobileFinalVideoPath, stitchClips } from "@/lib/mobileStitch";
import { mobileMediaFolder } from "@/lib/mobileJobFolder";
import { CRASH_DIR } from "@/lib/paths";
import { newId } from "@/lib/types";
import { nextCutAfter, songWindowLabel, type ScratchSongCut } from "@/lib/scratchSongSlice";
import {
  findSongCarrierBeatId,
  isMusicVideoSongJob,
  plateSliceWindows,
} from "@/lib/musicVideoSong";
import { isMobileSavedVoiceFile } from "@/lib/mobileSavedVoice";

export const runtime = "nodejs";
export const maxDuration = 900;

/**
 * /m Music video song desk.
 * POST { action, jobId, ... }
 *   assign — park N × 15s on one plate (reuse the same plate later).
 *   remove — drop one parked cut.
 *   unstick — running with no clip → pending (left the screen too long).
 *   run — one LTX slice. Client polls the job if the phone drops.
 *   stitch — concat done cuts. Does not write job.finalVideoFile.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    jobId?: string;
    shotId?: string;
    cutId?: string;
    count?: number;
    beatId?: string;
  };
  const action = String(body.action || "").trim();
  const jobId = String(body.jobId || "").trim();
  if (!jobId) return NextResponse.json({ error: "Need jobId" }, { status: 400 });

  let job = await readMobileGenJob(jobId);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (!isMusicVideoSongJob(job)) {
    return NextResponse.json({ error: "Song cuts on /m are Music video only." }, { status: 400 });
  }
  const story = await readMobileStory(job.styleId, job.folderName);

  try {
    if (action === "assign") {
      const song = job.scratchSong;
      if (!song?.fileName) {
        return NextResponse.json({ error: "Drop the song mp3 first." }, { status: 400 });
      }
      const shotId = String(body.shotId || "").trim();
      const shot = job.shots.find((s) => s.shotId === shotId);
      const plateFile = (shot?.plateFile || "").trim();
      if (!shotId || !plateFile || plateFile === "__error__") {
        return NextResponse.json({ error: "Draw that plate first, then park 15s slices." }, { status: 400 });
      }
      const extra = plateSliceWindows(song.cuts || [], song.durationSec, Number(body.count));
      if (!extra.length) {
        return NextResponse.json({ error: "Nothing left to park — at the end of the track." }, { status: 400 });
      }
      const cuts: ScratchSongCut[] = [
        ...(song.cuts || []),
        ...extra.map((window) => ({
          id: newId("cut"),
          plateFile,
          shotId,
          startSec: window.startSec,
          durationSec: window.durationSec,
          status: "pending" as const,
        })),
      ];
      const nextWin = nextCutAfter(cuts, song.durationSec);
      const updated = await patchMobileGenJob(jobId, {
        scratchSong: {
          ...song,
          cuts,
          sliceStartSec: nextWin.startSec,
          sliceDurationSec: nextWin.durationSec,
        },
        error: "",
      });
      return NextResponse.json({
        ok: true,
        job: updated,
        added: extra.length,
        label: songWindowLabel(song.durationSec, cuts),
      });
    }

    if (action === "remove") {
      const song = job.scratchSong;
      const cutId = String(body.cutId || "").trim();
      if (!song || !cutId) {
        return NextResponse.json({ error: "Need a cut to remove." }, { status: 400 });
      }
      const cuts = (song.cuts || []).filter((c) => c.id !== cutId);
      const nextWin = nextCutAfter(cuts, song.durationSec);
      const updated = await patchMobileGenJob(jobId, {
        scratchSong: {
          ...song,
          cuts,
          sliceStartSec: nextWin.startSec,
          sliceDurationSec: nextWin.durationSec,
        },
        error: "",
      });
      return NextResponse.json({ ok: true, job: updated, label: songWindowLabel(song.durationSec, cuts) });
    }

    if (action === "unstick") {
      const song = job.scratchSong;
      const cutId = String(body.cutId || "").trim();
      if (!song || !cutId) {
        return NextResponse.json({ error: "Need a cut to unstick." }, { status: 400 });
      }
      const cuts = (song.cuts || []).map((c) =>
        c.id === cutId && c.status === "running" && !c.clipFile
          ? { ...c, status: "pending" as const, error: "" }
          : c,
      );
      const updated = await patchMobileGenJob(jobId, {
        scratchSong: { ...song, cuts },
        error: "",
      });
      return NextResponse.json({ ok: true, job: updated });
    }

    if (action === "run") {
      const song = job.scratchSong;
      if (!song?.fileName) {
        return NextResponse.json({ error: "Drop the song mp3 first." }, { status: 400 });
      }
      const wantId = String(body.cutId || "").trim();
      const cut =
        (wantId ? (song.cuts || []).find((c) => c.id === wantId) : undefined) ||
        (song.cuts || []).find((c) => c.status !== "done") ||
        (song.cuts || [])[0];
      if (!cut) {
        return NextResponse.json({ error: "Park 15s slices on a plate first." }, { status: 400 });
      }
      const shotId =
        (cut.shotId || "").trim() ||
        job.shots.find((s) => s.plateFile === cut.plateFile)?.shotId ||
        job.shots[0]?.shotId ||
        "";
      const scene = story.scenes.find((sc) => sc.shots.some((sh) => sh.id === shotId));
      const storyShot = scene?.shots.find((sh) => sh.id === shotId);
      if (!scene || !storyShot) {
        return NextResponse.json({ error: "That plate is not on this episode." }, { status: 400 });
      }
      const beatId =
        String(body.beatId || "").trim() ||
        findSongCarrierBeatId(story, song.fileName, shotId) ||
        storyShot.beats.find((b) => isMobileSavedVoiceFile(b.voiceFile))?.id ||
        storyShot.beats[0]?.id ||
        "";
      if (!beatId) {
        return NextResponse.json({ error: "Lock the episode and draw a plate first." }, { status: 400 });
      }
      try {
        const running: ScratchSongCut[] = (song.cuts || []).map((c) =>
          c.id === cut.id ? { ...c, status: "running", error: "" } : c,
        );
        job = (await patchMobileGenJob(jobId, {
          scratchSong: { ...song, cuts: running },
          error: "",
        }))!;
        const updated = await runScratchLtxClip({
          job,
          story,
          shotId,
          sceneId: scene.id,
          beatId,
          plateFile: cut.plateFile,
          sliceStartSec: cut.startSec,
          sliceDurationSec: cut.durationSec,
          cutId: cut.id,
        });
        return NextResponse.json({
          ok: true,
          job: updated,
          cutId: cut.id,
          label: songWindowLabel(song.durationSec, updated.scratchSong?.cuts || running),
        });
      } catch (e) {
        const latest = await readMobileGenJob(jobId);
        return NextResponse.json(
          {
            error: e instanceof Error ? e.message : String(e),
            job: latest || job,
          },
          { status: 502 },
        );
      }
    }

    if (action === "stitch") {
      const song = job.scratchSong;
      const cuts = (song?.cuts || []).filter((c) => c.clipFile && c.status === "done");
      if (cuts.length < 2) {
        return NextResponse.json(
          { error: "Need two finished clips to stitch." },
          { status: 400 },
        );
      }
      const mediaFolder = mobileMediaFolder(job);
      const paths: string[] = [];
      for (const cut of cuts) {
        const name = path.basename(cut.clipFile || "");
        const localPath = path.join(CRASH_DIR, "ltx", name);
        const genPath = path.join(CRASH_DIR, "gen", name);
        const found =
          (fs.existsSync(localPath) && localPath) ||
          (fs.existsSync(genPath) && genPath) ||
          (await resolveMobileMedia({
            styleId: job.styleId,
            folderName: mediaFolder,
            kind: "mp4",
            fileName: name,
            destPath: localPath,
          }));
        if (!found) {
          return NextResponse.json(
            { error: `Clip ${name} is missing — generate that slice again.` },
            { status: 404 },
          );
        }
        paths.push(found);
      }
      const stitchedFile = stitchClips(paths);
      const stitchedPath = mobileFinalVideoPath(stitchedFile);
      try {
        await uploadMobileMedia({
          styleId: job.styleId,
          folderName: mediaFolder,
          kind: "mp4",
          localPath: stitchedPath,
        });
      } catch {
        /* local stitch still plays this request */
      }
      const updated = await patchMobileGenJob(jobId, {
        scratchSong: { ...song!, stitchedFile },
        error: "",
      });
      return NextResponse.json({ ok: true, job: updated, stitchedFile });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
