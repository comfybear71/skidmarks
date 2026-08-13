import { getEnv } from "./env";

/** Read token from MY MOVIES\.env — never expose to the browser. */
export function hfToken(): string {
  return getEnv("HF_TOKEN") || getEnv("HUGGINGFACE_TOKEN") || "";
}

export function hfTokenPresent(): boolean {
  return Boolean(hfToken());
}

export type HfWhoAmI = {
  name: string;
  fullname?: string;
  type?: string;
};

/**
 * Call Hugging Face whoami-v2 to prove the token works.
 * https://huggingface.co/docs/hub/en/api#get-apimanagerwhoami-v2
 */
export async function hfWhoAmI(): Promise<
  | { ok: true; user: HfWhoAmI }
  | { ok: false; error: string }
> {
  const token = hfToken();
  if (!token) {
    return {
      ok: false,
      error: "Missing HF_TOKEN in MY MOVIES\\.env",
    };
  }

  try {
    const res = await fetch("https://huggingface.co/api/whoami-v2", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (res.status === 401) {
        return {
          ok: false,
          error: "HF token rejected — make a new Read token and update .env",
        };
      }
      return {
        ok: false,
        error: `Hugging Face ${res.status}${body ? `: ${body.slice(0, 120)}` : ""}`,
      };
    }
    const data = (await res.json()) as {
      name?: string;
      fullname?: string;
      type?: string;
    };
    if (!data.name) {
      return { ok: false, error: "HF responded but no username" };
    }
    return {
      ok: true,
      user: {
        name: data.name,
        fullname: data.fullname,
        type: data.type,
      },
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
