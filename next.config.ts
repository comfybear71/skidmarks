import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ffmpeg-static's binary is reached through a path at runtime, not an
  // import, so tracing drops it and the stitch fails with ENOENT on Vercel.
  outputFileTracingIncludes: {
    // Glob key so this applies whatever shape the route path takes, and both
    // packages listed because they fail in different ways.
    "/api/crash/mobile/**": [
      "./node_modules/@ffmpeg-installer/**",
      "./node_modules/ffmpeg-static/ffmpeg",
    ],
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
