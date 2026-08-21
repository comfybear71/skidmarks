import type { NextConfig } from "next";

/**
 * Only routes that actually run ffmpeg (stitch / song slice / duration probe).
 * Do NOT use `/api/crash/mobile/**` — that stuffed ~140MB of binaries into
 * every mobile function and made deploys crawl vs a larger app under ~1m.
 * linux-x64 only — Vercel is Linux; shipping darwin/win packages is waste.
 */
const FFMPEG_RUNTIME_BINS = [
  "./node_modules/@ffmpeg-installer/linux-x64/ffmpeg",
  "./node_modules/ffmpeg-static/ffmpeg",
];

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/crash/mobile/song/**": FFMPEG_RUNTIME_BINS,
    "/api/crash/mobile/scratch/**": FFMPEG_RUNTIME_BINS,
    "/api/crash/mobile/step/**": FFMPEG_RUNTIME_BINS,
    "/api/crash/mobile/beat-audio/**": FFMPEG_RUNTIME_BINS,
    // public/ is served statically, not bundled with a function — this
    // one-time seed route needs the actual bytes on disk to push to Blob.
    "/api/home/seed-cast": ["./public/skid-cast/**"],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "64mb",
      allowedOrigins: [
        "skidmarks.aiglitch.app",
        "skidmarks-seven.vercel.app",
      ],
    },
  },
};

export default nextConfig;
