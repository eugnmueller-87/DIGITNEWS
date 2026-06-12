import type { MetadataRoute } from "next";

/**
 * Deny all crawlers. This is a private tool; nothing here should be indexed.
 * Defense-in-depth with the global `X-Robots-Tag: noindex, nofollow` header
 * set in next.config.ts. @see Brief §11.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", disallow: "/" }],
  };
}
