/** Browser TypeError when the request never lands. Don't show that raw. */
export function studioFetchError(e: unknown, fallback: string): string {
  const msg = e instanceof Error ? e.message : "";
  if (/failed to fetch|networkerror|load failed/i.test(msg)) {
    return "Couldn't reach Studio. Check the signal and tap again. Don't start a new episode.";
  }
  return msg.trim() || fallback;
}
