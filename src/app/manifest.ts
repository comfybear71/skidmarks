import type { MetadataRoute } from "next";

/**
 * Web app manifest — Next.js only resolves manifest.(ts|js|json) from the
 * true root of app/, not from a nested route group, so this lives here
 * even though it's scoped to the mobile PWA only (start_url/scope: "/m").
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Skidmarks — Vibe Director",
    short_name: "Vibe Director",
    description: "Vibe direct a film. Cast, places, and plates stay on the tree.",
    start_url: "/m",
    scope: "/m",
    display: "standalone",
    orientation: "portrait",
    background_color: "#07060a",
    theme_color: "#07060a",
    icons: [
      { src: "/brand/skidmarks-logo.png", sizes: "611x394", type: "image/png" },
    ],
  };
}
