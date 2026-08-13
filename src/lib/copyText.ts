/** Copy text — clipboard API first; textarea fallback for Cursor/Electron on Windows. */
export async function copyTextToClipboard(
  text: string,
  source?: HTMLTextAreaElement | null,
): Promise<number> {
  const body = text.replace(/\r\n/g, "\n");
  if (!body.trim()) throw new Error("Nothing to copy");

  if (source) {
    source.value = body;
    source.focus();
    source.select();
    source.setSelectionRange(0, body.length);
  }

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(body);
      return body.length;
    } catch {
      /* fall through */
    }
  }

  if (typeof document === "undefined") {
    throw new Error("Clipboard not available");
  }

  const ta = source ?? document.createElement("textarea");
  const created = !source;
  if (created) {
    ta.value = body;
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.left = "0";
    ta.style.width = "2em";
    ta.style.height = "2em";
    ta.style.padding = "0";
    ta.style.border = "none";
    ta.style.outline = "none";
    ta.style.boxShadow = "none";
    ta.style.background = "transparent";
    document.body.appendChild(ta);
  }
  ta.focus();
  ta.select();
  ta.setSelectionRange(0, body.length);

  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }

  if (created) document.body.removeChild(ta);

  if (ok) return body.length;

  throw new Error("Clipboard blocked — Show template → Ctrl+A → Ctrl+C");
}
