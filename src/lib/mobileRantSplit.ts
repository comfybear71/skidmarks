/**
 * LTX holds Jo alone for ~6s, then a walker walks in (4/4 take, ~7s on a
 * 39s rant). Same still. Split the spoken line at sentence ends so each
 * clip stays under that cliff. Words stay Stuie's — only the cuts change.
 */
export const LTX_RANT_HOLD_SEC = 6;
export const LTX_RANT_WORDS_PER_SEC = 2.5;
export const LTX_RANT_MAX_WORDS = Math.floor(LTX_RANT_HOLD_SEC * LTX_RANT_WORDS_PER_SEC);

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function splitOverlongChunk(text: string): string[] {
  const raw = text.trim();
  if (wordCount(raw) <= LTX_RANT_MAX_WORDS) return [raw];
  const words = raw.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  let buf: string[] = [];
  for (const w of words) {
    if (buf.length && buf.length + 1 > LTX_RANT_MAX_WORDS) {
      chunks.push(buf.join(" "));
      buf = [w];
    } else {
      buf.push(w);
    }
  }
  if (buf.length) chunks.push(buf.join(" "));
  return chunks;
}

export function splitSpokenRant(text: string): string[] {
  const raw = text.replace(/\s+/g, " ").trim();
  if (!raw) return [];
  if (wordCount(raw) <= LTX_RANT_MAX_WORDS) return [raw];
  const sentences = raw.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  const pieces: string[] = [];
  if (sentences.length <= 1) {
    pieces.push(raw);
  } else {
    let buf = "";
    for (const sentence of sentences) {
      const next = buf ? `${buf} ${sentence}` : sentence;
      if (buf && wordCount(next) > LTX_RANT_MAX_WORDS) {
        pieces.push(buf);
        buf = sentence;
      } else {
        buf = next;
      }
    }
    if (buf) pieces.push(buf);
  }
  return pieces.flatMap(splitOverlongChunk);
}
