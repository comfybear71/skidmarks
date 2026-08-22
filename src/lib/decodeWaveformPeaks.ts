/**
 * Browser-only waveform peak extraction for TRACK timeline.
 * No Node — safe to import from /m client components.
 */

const DEFAULT_SAMPLES = 192;

/** Normalized peaks 0..1, length = samples (default 192). */
export async function decodeWaveformPeaks(
  file: File | Blob,
  samples = DEFAULT_SAMPLES,
): Promise<number[]> {
  const ctx = new AudioContext();
  try {
    const buf = await file.arrayBuffer();
    const audio = await ctx.decodeAudioData(buf.slice(0));
    const channel = audio.getChannelData(0);
    const block = Math.max(1, Math.floor(channel.length / samples));
    const peaks: number[] = [];
    for (let i = 0; i < samples; i++) {
      const start = i * block;
      const end = Math.min(channel.length, start + block);
      let peak = 0;
      for (let j = start; j < end; j++) {
        const v = Math.abs(channel[j] || 0);
        if (v > peak) peak = v;
      }
      peaks.push(peak);
    }
    const max = Math.max(...peaks, 0.001);
    return peaks.map((p) => Math.round((p / max) * 1000) / 1000);
  } finally {
    await ctx.close().catch(() => undefined);
  }
}
