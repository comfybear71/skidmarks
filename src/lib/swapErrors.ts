/** Plain-English swap errors — never dump CLI usage JSON at Stuie. */
export function friendlySwapError(raw: string): string {
  const text = String(raw || "").trim();
  if (!text) return "Swap failed — try Run swap again.";

  if (text.startsWith("{") && text.includes('"error"')) {
    try {
      const parsed = JSON.parse(text) as { error?: string };
      if (parsed.error) return friendlySwapError(parsed.error);
    } catch {
      /* fall through */
    }
  }

  if (text.includes("usage: facefusion") || text.includes("invalid choice")) {
    return "Face swap could not start — restart the app, then try Run swap again.";
  }
  if (/source missing/i.test(text)) {
    return "Source photo missing — check Characters step has Andrew's face saved.";
  }
  if (/target still missing/i.test(text)) {
    return "Pick your plate in the dropdown first.";
  }
  if (/facefusion not found/i.test(text)) {
    return "Face swap not set up on this machine yet.";
  }
  if (text.length > 140) return `${text.slice(0, 140)}…`;
  return text;
}
