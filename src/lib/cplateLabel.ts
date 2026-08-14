/** Human label for cplate_20260808000108230_nu2.png → "8 Aug 12:01 am · nu2" */
import { humanMediaLabel } from "./mediaMatch";

export function formatCplateLabel(fileName: string, mtime?: number): string {
  const m = /^cplate_(\d{17})_([a-z0-9]+)\./i.exec(fileName);
  if (m) {
    const s = m[1];
    const tag = m[2];
    const dt = new Date(
      Number(s.slice(0, 4)),
      Number(s.slice(4, 6)) - 1,
      Number(s.slice(6, 8)),
      Number(s.slice(8, 10)),
      Number(s.slice(10, 12)),
      Number(s.slice(12, 14)),
      Number(s.slice(14, 17)),
    );
    const stamp = dt.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
    return `${stamp} · ${tag}`;
  }
  const named = humanMediaLabel(fileName);
  if (named && named !== fileName) return named;
  if (mtime) {
    return new Date(mtime).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }
  return named || fileName;
}
