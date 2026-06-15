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

// Android launcher densities. base = the px size of ic_launcher / round at that
// density; the adaptive `foreground` is rendered on a larger 108dp canvas where
// the system crops to the inner ~66dp, so the sun uses a smaller safe-zone scale.
const ANDROID_RES = join(ROOT, "android", "app", "src", "main", "res");
const ANDROID_DENSITIES = [
  { dir: "mipmap-mdpi", base: 48, fg: 108 },
  { dir: "mipmap-hdpi", base: 72, fg: 162 },
  { dir: "mipmap-xhdpi", base: 96, fg: 216 },
  { dir: "mipmap-xxhdpi", base: 144, fg: 324 },
  { dir: "mipmap-xxxhdpi", base: 192, fg: 432 },
];

/** Composite the sun mark onto a square canvas. scale = sun fraction of canvas. */
async function renderIcon(masterSvg, size, scale, bg) {
  const inner = Math.round(size * scale);
  const sun = await sharp(masterSvg, { density: 384 })
    .resize(inner, inner, {
      fit: "contain",
      background: { ...PAPER, alpha: 0 },
    })
    .png()
    .toBuffer();
  const offset = Math.round((size - inner) / 2);
  return sharp({
    create: { width: size, height: size, channels: 4, background: bg },
  })
    .composite([{ input: sun, top: offset, left: offset }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function genAndroid(masterSvg) {
  const transparent = { r: 0, g: 0, b: 0, alpha: 0 };
  for (const d of ANDROID_DENSITIES) {
    await mkdir(join(ANDROID_RES, d.dir), { recursive: true });
    // Square + round launcher icons: full paper ground, sun fills ~74%.
    const square = await renderIcon(masterSvg, d.base, 0.74, PAPER);
    await writeFile(join(ANDROID_RES, d.dir, "ic_launcher.png"), square);
    await writeFile(join(ANDROID_RES, d.dir, "ic_launcher_round.png"), square);
    // Adaptive foreground: transparent ground (the XML supplies the bg colour),
    // sun ~46% so it survives the system's center-crop on the 108dp canvas.
    const fg = await renderIcon(masterSvg, d.fg, 0.46, transparent);
    await writeFile(join(ANDROID_RES, d.dir, "ic_launcher_foreground.png"), fg);
    console.log(
      `✓ android/${d.dir} (launcher ${d.base}px, foreground ${d.fg}px)`,
    );
  }
}

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

  console.log(`\nGenerated ${TARGETS.length} PWA icons from ${MASTER}`);

  // Android launcher icons (only when the native project exists).
  try {
    await genAndroid(masterSvg);
    console.log(`Generated Android launcher icons from ${MASTER}`);
  } catch (err) {
    if (err?.code === "ENOENT") {
      console.log("(skipped Android icons — no android/ project)");
    } else {
      throw err;
    }
  }
}

main().catch((err) => {
  console.error("gen-icons failed:", err);
  process.exit(1);
});
