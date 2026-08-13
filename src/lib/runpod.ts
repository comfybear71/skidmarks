import { getEnv } from "./env";

export function runpodApiKey(): string {
  return getEnv("RUNPOD_API_KEY") || "";
}

export function runpodKeyPresent(): boolean {
  return Boolean(runpodApiKey());
}

export type RunpodPodSummary = {
  id: string;
  name: string;
  desiredStatus: string;
  /** Proxy URL for Comfy if port 3000 is mapped, else "" */
  comfyUrl: string;
  gpu: string;
  /** How many GPUs this pod wants when resumed */
  gpuCount: number;
};

type GraphqlPod = {
  id?: string;
  name?: string;
  desiredStatus?: string;
  gpuCount?: number;
  machine?: { gpuDisplayName?: string };
  runtime?: {
    ports?: Array<{
      privatePort?: number;
      publicPort?: number;
      type?: string;
    }>;
  } | null;
};

async function runpodGraphql<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const key = runpodApiKey();
  if (!key) {
    return { ok: false, error: "Missing RUNPOD_API_KEY in MY MOVIES\\.env" };
  }
  try {
    const res = await fetch(
      `https://api.runpod.io/graphql?api_key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query, variables }),
        cache: "no-store",
      },
    );
    const json = (await res.json()) as {
      data?: T;
      errors?: Array<{ message?: string }>;
    };
    if (!res.ok) {
      return { ok: false, error: `RunPod HTTP ${res.status}` };
    }
    if (json.errors?.length) {
      return {
        ok: false,
        error: json.errors[0]?.message || "RunPod GraphQL error",
      };
    }
    if (!json.data) {
      return { ok: false, error: "RunPod empty response" };
    }
    return { ok: true, data: json.data };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * List pods via RunPod GraphQL. Never log the API key.
 */
export async function listRunpodPods(): Promise<
  | { ok: true; pods: RunpodPodSummary[] }
  | { ok: false; error: string }
> {
  const query = `
    query {
      myself {
        pods {
          id
          name
          desiredStatus
          gpuCount
          machine {
            gpuDisplayName
          }
          runtime {
            ports {
              privatePort
              publicPort
              type
            }
          }
        }
      }
    }
  `;

  const result = await runpodGraphql<{ myself?: { pods?: GraphqlPod[] } }>(
    query,
  );
  if (!result.ok) return result;

  const raw = result.data.myself?.pods || [];
  const pods: RunpodPodSummary[] = raw.map((p) => {
    const id = String(p.id || "");
    const has3000 = Boolean(
      p.runtime?.ports?.some((port) => port.privatePort === 3000),
    );
    const gpuCount = Number(p.gpuCount);
    return {
      id,
      name: String(p.name || id),
      desiredStatus: String(p.desiredStatus || "UNKNOWN"),
      comfyUrl: has3000 && id ? `https://${id}-3000.proxy.runpod.net` : "",
      gpu: String(p.machine?.gpuDisplayName || ""),
      gpuCount: Number.isFinite(gpuCount) && gpuCount > 0 ? gpuCount : 1,
    };
  });
  return { ok: true, pods };
}

/** Start a stopped pod (RunPod podResume). */
export async function resumeRunpodPod(
  podId: string,
  gpuCount = 1,
): Promise<{ ok: true; desiredStatus: string } | { ok: false; error: string }> {
  const id = podId.trim();
  if (!id) return { ok: false, error: "Missing pod id" };
  const n = Math.max(1, Math.min(8, Math.floor(gpuCount) || 1));
  const query = `
    mutation ($input: PodResumeInput!) {
      podResume(input: $input) {
        id
        desiredStatus
      }
    }
  `;
  const result = await runpodGraphql<{
    podResume?: { id?: string; desiredStatus?: string };
  }>(query, { input: { podId: id, gpuCount: n } });
  if (!result.ok) return result;
  return {
    ok: true,
    desiredStatus: String(result.data.podResume?.desiredStatus || "RUNNING"),
  };
}

/** Stop a running pod (keeps disk / volume). */
export async function stopRunpodPod(
  podId: string,
): Promise<{ ok: true; desiredStatus: string } | { ok: false; error: string }> {
  const id = podId.trim();
  if (!id) return { ok: false, error: "Missing pod id" };
  const query = `
    mutation ($input: PodStopInput!) {
      podStop(input: $input) {
        id
        desiredStatus
      }
    }
  `;
  const result = await runpodGraphql<{
    podStop?: { id?: string; desiredStatus?: string };
  }>(query, { input: { podId: id } });
  if (!result.ok) return result;
  return {
    ok: true,
    desiredStatus: String(result.data.podStop?.desiredStatus || "EXITED"),
  };
}

/** Cheap check — does Comfy proxy answer? */
export async function probeComfyUrl(
  url: string,
): Promise<"up" | "down" | "skip"> {
  if (!url) return "skip";
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    // Any HTTP response means the proxy is alive (even 404)
    if (res.status > 0) return "up";
    return "down";
  } catch {
    return "down";
  }
}
