/**
 * Generates every app icon / splash PNG from the InvoiceGen glyph (the same
 * document glyph as the web logo in apps/web/src/components/brand.tsx).
 *
 *   node apps/mobile/scripts/generate-icons.mjs
 *
 * Uses `sharp`, which is installed at the repo root (via Next.js).
 */
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "assets", "images");

const BLUE = "#2563EB";
const BLUE_LIGHT = "#3B82F6";
const BLUE_DARK = "#1D4ED8";

/** The web logo glyph (24×24 viewBox, stroked). */
const GLYPH_PATHS = `
  <path d="M6 2h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z" />
  <path d="M14 2v6h6" />
  <path d="M9 13h6M9 17h6M9 9h1" />`;

/**
 * A square canvas with the glyph centred, `glyphRatio` of the canvas wide.
 * The glyph's ink spans x 5–20, y 2–21 of its 24-unit box, so it's shifted to
 * be optically centred.
 */
function svg({ size, glyphRatio, background, color = "#FFFFFF", strokeWidth = 2 }) {
  const scale = (size * glyphRatio) / 24;
  const offset = (size - 24 * scale) / 2;
  const nudgeX = -0.5 * scale; // ink centre is x 12.5
  const nudgeY = -(11.5 - 12) * scale; // ink centre is y 11.5
  const bg =
    background === "gradient"
      ? `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
           <stop offset="0" stop-color="${BLUE_LIGHT}"/><stop offset="1" stop-color="${BLUE_DARK}"/>
         </linearGradient></defs><rect width="${size}" height="${size}" fill="url(#g)"/>`
      : background
        ? `<rect width="${size}" height="${size}" fill="${background}"/>`
        : "";
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    ${bg}
    <g transform="translate(${offset + nudgeX} ${offset + nudgeY}) scale(${scale})"
       fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
      ${GLYPH_PATHS}
    </g>
  </svg>`);
}

const outputs = [
  // iOS app icon: full-bleed, opaque (iOS applies the rounded mask).
  { file: "icon.png", size: 1024, glyphRatio: 0.56, background: "gradient", flatten: true },
  // Android adaptive icon: glyph inside the 66% safe zone; background layer separate.
  { file: "android-icon-foreground.png", size: 1024, glyphRatio: 0.42 },
  { file: "android-icon-background.png", size: 1024, glyphRatio: 0, background: "gradient", flatten: true },
  // Android 13+ themed icon: single-colour glyph, tinted by the system.
  { file: "android-icon-monochrome.png", size: 1024, glyphRatio: 0.42 },
  // Splash: white glyph on the brand-blue splash background (see app.json).
  { file: "splash-icon.png", size: 512, glyphRatio: 0.9 },
  // Android status-bar notification icon: white on transparent, per Android rules.
  { file: "notification-icon.png", size: 96, glyphRatio: 0.8, strokeWidth: 2.2 },
  // Web favicon.
  { file: "favicon.png", size: 48, glyphRatio: 0.62, background: BLUE, strokeWidth: 2.4 },
];

await mkdir(OUT, { recursive: true });
for (const o of outputs) {
  let img = sharp(svg(o)).png();
  if (o.flatten) img = img.flatten({ background: BLUE });
  await img.toFile(join(OUT, o.file));
  console.log(`✓ ${o.file} (${o.size}×${o.size})`);
}
