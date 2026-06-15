import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/**
 * Vitest config. Covers the app's PURE logic (validation, content routing,
 * feed/calendar/ICS date math, publish + registration state) — not React
 * rendering, so the default `node` environment is used. The `@/*` alias mirrors
 * tsconfig so test imports match app imports. TZ is pinned so date math is
 * deterministic regardless of the CI/dev machine's zone.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` is a Next.js build-time guard with no runtime export; in
      // the Vitest node env it has nothing to resolve, so stub it to empty.
      "server-only": fileURLToPath(
        new URL("./src/test/server-only-stub.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    env: { TZ: "Europe/Berlin" },
  },
});
