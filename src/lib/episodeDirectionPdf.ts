/**
 * Resolve sheet — shot order, lines, and [cues]. Not SFX audio.
 */
import type { CrashStoryDoc } from "./crashStoryTypes";

function pdfEscape(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrapLine(text: string, max = 92): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > max) {
      if (cur) lines.push(cur);
      cur = w;
    } else {
      cur = next;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

export function directionLinesFromStory(story: CrashStoryDoc): string[] {
  const lines: string[] = [];
  lines.push(story.campaignLabel || "Episode");
  if (story.gagNote) lines.push(story.gagNote);
  lines.push("");
  let n = 0;
  for (const sc of story.scenes) {
    for (const sh of sc.shots) {
      n += 1;
      lines.push(`SHOT ${n} — ${sh.title || sc.placeName}`);
      lines.push(`Place: ${sc.placeName}`);
      if (sh.staging) {
        for (const bit of wrapLine(`Plate: ${sh.staging}`)) lines.push(bit);
      }
      for (const beat of sh.beats) {
        const who = (beat.speaker || "").trim();
        const text = (beat.text || "").trim();
        if (!who && !text) continue;
        for (const bit of wrapLine(who ? `${who}: ${text}` : text)) lines.push(bit);
      }
      for (const sfx of sh.sfx || []) {
        const label = (sfx.label || "").trim();
        if (label) lines.push(`[${label}]`);
      }
      lines.push("");
    }
  }
  return lines;
}

/** Tiny Helvetica PDF. No extra dependency. */
export function buildDirectionPdf(lines: string[]): Buffer {
  const body = lines.length ? lines : ["(empty episode)"];
  const perPage = 60;
  const pages: string[][] = [];
  for (let i = 0; i < body.length; i += perPage) pages.push(body.slice(i, i + perPage));

  const chunks: string[] = [];
  const offsets: number[] = [0];
  const pushObj = (id: number, bodyText: string) => {
    offsets[id] = Buffer.byteLength(chunks.join(""));
    chunks.push(`${id} 0 obj\n${bodyText}\nendobj\n`);
  };

  const fontId = 3;
  const pageIds: number[] = [];
  let nextId = 4;
  const pageChunks: { pageId: number; contentId: number; stream: string }[] = [];
  for (const page of pages) {
    const contentId = nextId++;
    const pageId = nextId++;
    pageIds.push(pageId);
    const streamLines = ["BT", "/F1 10 Tf", "14 TL", "50 800 Td"];
    page.forEach((line, i) => {
      if (i) streamLines.push("T*");
      streamLines.push(`(${pdfEscape(line)}) Tj`);
    });
    streamLines.push("ET");
    pageChunks.push({ pageId, contentId, stream: streamLines.join("\n") });
  }

  chunks.push("%PDF-1.4\n");
  pushObj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  pushObj(2, `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`);
  pushObj(fontId, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  for (const p of pageChunks) {
    pushObj(
      p.contentId,
      `<< /Length ${Buffer.byteLength(p.stream)} >>\nstream\n${p.stream}\nendstream`,
    );
    pushObj(
      p.pageId,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${p.contentId} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >>`,
    );
  }

  const outSoFar = chunks.join("");
  const xrefAt = Buffer.byteLength(outSoFar);
  const maxId = nextId - 1;
  let xref = `xref\n0 ${maxId + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= maxId; i++) {
    xref += `${String(offsets[i] || 0).padStart(10, "0")} 00000 n \n`;
  }
  return Buffer.from(
    `${outSoFar}${xref}trailer\n<< /Size ${maxId + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`,
  );
}
