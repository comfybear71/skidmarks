/** Browser TypeError when the request never lands. Don't show that raw. */
export function studioFetchError(e: unknown, fallback: string): string {
  const msg = e instanceof Error ? e.message : "";
  if (/failed to fetch|networkerror|load failed/i.test(msg)) {
    return "Couldn't reach Studio. The episode is still there — tap again. Don't start a new episode.";
  }
  if (/did not match the expected pattern/i.test(msg)) {
    return "That line is long — the voice request timed out. Keep this episode. Tap Save again.";
  }
  if (/requested file or directory could not be found/i.test(msg)) {
    return "That file vanished before Studio could read it. Copy it to Downloads and drop that copy.";
  }
  return msg.trim() || fallback;
}

/** Safari throws "did not match the expected pattern" when the body is an
 * HTML 504, not JSON. Read JSON when we can; otherwise say what happened. */
export async function readApiJson<T extends { error?: string }>(
  res: Response,
): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as T;
  if (res.ok) return data;
  if (res.status === 401) {
    throw new Error(data.error?.trim() || "Sign in");
  }
  if (data.error?.trim()) throw new Error(data.error.trim());
  if (res.status === 504 || res.status === 408) {
    throw new Error(
      "Studio timed out. The episode is still there — tap again. Don't start a new episode.",
    );
  }
  if (res.status === 413) {
    throw new Error(
      "That file is too big for one drop — the song never reached Studio. Keep this episode.",
    );
  }
  throw new Error(`Request failed (${res.status})`);
}
