import type { MetadataRoute } from "next";

import { brand } from "@/config/brand";

/**
 * PWA manifest — makes the app installable on phones/desktops. Icons live in
 * /public (icon-192.png, icon-512.png). Standalone display + a neutral theme.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: brand.name,
    short_name: brand.name,
    description: brand.tagline,
    start_url: "/feed",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#18181b",
    lang: "de",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
