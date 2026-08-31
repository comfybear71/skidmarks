/** Run: npx tsx scripts/run-script-go.mjs <jobId> [baseUrl] */
import { runScriptGo } from "../src/lib/scriptGoRun.ts";

const jobId = String(process.argv[2] || "").trim();
const baseUrl = String(process.argv[3] || "http://127.0.0.1:3737").replace(/\/$/, "");
if (!jobId) {
  console.error("Need a job id.");
  process.exit(2);
}

const stop = { on: false };
process.on("SIGINT", () => {
  stop.on = true;
  console.log("Stopping after this still…");
});

try {
  const job = await runScriptGo({
    jobId,
    baseUrl,
    onNote: (msg) => console.log(msg),
    cancelled: () => stop.on,
  });
  const cuts = job?.scratchSong?.cuts || [];
  const done = cuts.filter((c) => c.status === "done" && c.clipFile).length;
  console.log(`script-go finished · ${done}/${cuts.length} hung clips`);
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
