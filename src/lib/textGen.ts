import { runningOnVercel } from "./cloudEnv";
import { getEnv } from "./env";

/** Same xAI key as the image side. Override with XAI_TEXT_MODEL in .env. */
function model(): string {
  return getEnv("XAI_TEXT_MODEL") || "grok-4.5";
}

function key(): string {
  return getEnv("XAI_API_KEY") || getEnv("GROK_API_KEY");
}

export function textKeyPresent(): boolean {
  return Boolean(key());
}

/** PC reads MY MOVIES\\.env. Live Vercel already has XAI_API_KEY in project env. */
export function missingXaiMessage(): string {
  return runningOnVercel()
    ? "Missing XAI_API_KEY in Vercel environment variables."
    : "Missing XAI_API_KEY in MY MOVIES\\.env, then restart Studio.";
}

type ChatResponse = {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string } | string;
};

/** One-shot ask. Temperature is up so a reroll gives a different take. */
export async function askGrok(opts: {
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  const apiKey = key();
  if (!apiKey) throw new Error(missingXaiMessage());

  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model(),
      temperature: opts.temperature ?? 0.9,
      max_tokens: opts.maxTokens ?? 700,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
    }),
  });

  const body = (await res.json().catch(() => ({}))) as ChatResponse;
  if (!res.ok) {
    const msg =
      typeof body.error === "string"
        ? body.error
        : body.error?.message || `xAI text HTTP ${res.status}`;
    throw new Error(msg);
  }

  const text = (body.choices?.[0]?.message?.content || "").trim();
  if (!text) throw new Error("xAI returned nothing — try again");
  return text;
}
