import type { AssistKind } from "./mobileAssist";

export async function requestAssist(opts: {
  kind: AssistKind;
  text: string;
  styleId: string;
  hint?: string;
}): Promise<string> {
  const res = await fetch("/api/crash/mobile/assist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });
  const data = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
  if (!res.ok) throw new Error(data.error || "AI assist failed");
  const text = (data.text || "").trim();
  if (!text) throw new Error("AI returned nothing — tap again");
  return text;
}
