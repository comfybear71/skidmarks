import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ffmpeg-static's binary is reached through a path at runtime, not an
  // import, so tracing drops it and the stitch fails with ENOENT on Vercel.
  outputFileTracingIncludes: {
    "/api/crash/mobile/step": ["./node_modules/ffmpeg-static/ffmpeg"],
    "/api/crash/mobile/final": ["./node_modules/ffmpeg-static/ffmpeg"],
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
