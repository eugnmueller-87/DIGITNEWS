import type { MetadataRoute } from "next";

import { brand } from "@/config/brand";

/**
 * PWA manifest — makes the app installable on phones/desktops. Icons are
 * generated from public/icons/master.svg by `npm run gen:icons`. `any` and
 * `maskable` use SEPARATE files: the maskable variants keep the mark inside
 * Android's ~80% safe zone so it isn't cropped, while `any` fills more.
 *
 * background_color / theme_color match the app's paper ground (globals.css)
 * so the splash + status bar tint to the brand, not a mismatched neutral.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: brand.name,
    short_name: brand.name,
    description: brand.tagline,
    id: "/feed",
    start_url: "/feed",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fff9ec", // --paper
    theme_color: "#fff9ec", // --paper (matches the sticky header)
    lang: "de",
    dir: "ltr",
    categories: ["productivity", "education"],
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-192-maskable.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
