/** Studio type zoom (html style.zoom) — breaks mouse unless drag uses this. */
export function studioZoomFactor(): number {
  if (typeof document === "undefined") return 1;
  try {
    const inline = parseFloat(String(document.documentElement.style.zoom || ""));
    if (Number.isFinite(inline) && inline > 0.2) return inline;
    const computed = parseFloat(
      String(getComputedStyle(document.documentElement).zoom || ""),
    );
    if (Number.isFinite(computed) && computed > 0.2) return computed;
  } catch {
    /* ignore */
  }
  return 1;
}
