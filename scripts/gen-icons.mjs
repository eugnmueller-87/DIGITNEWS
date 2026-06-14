// Deterministic PWA icon generator. Composites the single master SVG
// (public/icons/master.svg — the sun mark) onto the brand paper background at
// the right scale per target, and writes PNGs into public/.
//
//   npm run gen:icons
//
// Uses `sharp` (already present in the toolchain). No network, no randomness —
// same master in, byte-stable PNGs out. The TARGETS table is the single place
// to add sizes; an `ios`/`android` density block can be appended later to emit
// AppIcon.appiconset / mipmap-* from the SAME master without touching the rest.
//
// Maskable note: Android masks crop to the inner ~80%, so maskable targets
// scale the sun smaller (safe zone) on a FULL-BLEED paper ground. Regular
// targets fill more. Apple touch icon is opaque (iOS dislikes transparency).

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MASTER = join(ROOT, "public", "icons", "master.svg");
const OUT_DIR = join(ROOT, "public");

const PAPER = { r: 0xf7, g: 0xf6, b: 0xf3, alpha: 1 }; // --app-bg #f7f6f3

/**
 * Each target: output filename, pixel size, the fraction of the canvas the sun
 * mark occupies (smaller = more safe-zone margin), and whether the background
 * is the opaque paper colour or transparent.
 */
const TARGETS = [
  { file: "icon-192.png", size: 192, scale: 0.78, bg: "paper" },
  { file: "icon-512.png", size: 512, scale: 0.78, bg: "paper" },
  { file: "icon-192-maskable.png", size: 192, scale: 0.6, bg: "paper" },
  { file: "icon-512-maskable.png", size: 512, scale: 0.6, bg: "paper" },
  // Apple touch icon: 180px, opaque (no rounded corners — iOS applies them).
  { file: "apple-icon.png", size: 180, scale: 0.74, bg: "paper" },
];

async function main() {
  const masterSvg = await readFile(MASTER);
  await mkdir(OUT_DIR, { recursive: true });

  for (const t of TARGETS) {
    const inner = Math.round(t.size * t.scale);
    // Rasterize the sun at the inner size.
    const sun = await sharp(masterSvg, { density: 384 })
      .resize(inner, inner, {
        fit: "contain",
        background: { ...PAPER, alpha: 0 },
      })
      .png()
      .toBuffer();

    const background =
      t.bg === "paper" ? PAPER : { r: 0, g: 0, b: 0, alpha: 0 };

    const canvas = sharp({
      create: {
        width: t.size,
        height: t.size,
        channels: 4,
        background,
      },
    });

    const offset = Math.round((t.size - inner) / 2);
    const out = await canvas
      .composite([{ input: sun, top: offset, left: offset }])
      .png({ compressionLevel: 9 })
      .toBuffer();

    await writeFile(join(OUT_DIR, t.file), out);
    console.log(`✓ ${t.file} (${t.size}px, sun ${inner}px, ${t.bg})`);
  }

  console.log(`\nGenerated ${TARGETS.length} icons from ${MASTER}`);
}

main().catch((err) => {
  console.error("gen-icons failed:", err);
  process.exit(1);
});
