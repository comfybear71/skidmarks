import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { readMobileGenJob, patchMobileGenJob } from "@/lib/mobileGenJob";
import { uploadMobileMedia } from "@/lib/mobileMediaStore";
import { sortableId } from "@/lib/types";
import { CRASH_DIR } from "@/lib/paths";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST multipart: jobId, beatId, file — attach a clip made elsewhere (Grok
 * video, an earlier LTX Director export, anything) as this beat's finished
 * clip, instead of generating one. Marks the clip done and skips it on the
 * next animate step, the same way a successful render would.
 */
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const jobId = String(form.get("jobId") || "").trim();
    const beatId = String(form.get("beatId") || "").trim();
    const file = form.get("file");
    if (!jobId || !beatId) {
      return NextResponse.json({ error: "Need jobId and beatId" }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Need a video file" }, { status: 400 });
    }

    const job = await readMobileGenJob(jobId);
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    if (!job.clips.some((c) => c.beatId === beatId)) {
      return NextResponse.json({ error: "No such clip on this job" }, { status: 404 });
    }

    const dir = path.join(CRASH_DIR, "ltx");
    fs.mkdirSync(dir, { recursive: true });
    const fileName = `${sortableId("byoclip")}.mp4`;
    const localPath = path.join(dir, fileName);
    fs.writeFileSync(localPath, Buffer.from(await file.arrayBuffer()));

    try {
      await uploadMobileMedia({
        styleId: job.styleId,
        folderName: job.folderName,
        kind: "mp4",
        localPath,
      });
    } catch {
      /* best effort — clip still usable this request; stitch falls back to local disk */
    }

    const clips = job.clips.map((c) =>
      c.beatId === beatId
        ? { ...c, clipFile: localPath, clipStatus: "done" as const, error: "" }
        : c,
    );
    const updated = await patchMobileGenJob(jobId, { clips });
    return NextResponse.json({ ok: true, job: updated });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
