import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
