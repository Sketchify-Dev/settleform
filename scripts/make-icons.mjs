#!/usr/bin/env node
/**
 * Generate the full favicon and icon set from one source image.
 *
 *   node scripts/make-icons.mjs path/to/logo.svg
 *
 * SVG is preferred: it rasterises crisply at every size and is also served
 * directly as app/icon.svg for browsers that support it. A PNG of 512px or
 * larger works too, but no app/icon.svg is written in that case.
 *
 * Outputs:
 *   app/icon.png            512x512  Next picks this up as <link rel="icon">
 *   app/icon.svg            vector   served to modern browsers
 *   app/apple-icon.png      180x180  iOS home screen
 *   app/favicon.ico         16/32/48 Vista ICO, PNG-encoded entries
 *   public/icon-192.png     PWA / manifest reuse
 *   public/icon-32.png      explicit small raster
 *   public/favicon.svg      stable URL for anyone hotlinking
 */
import { promises as fs } from "node:fs";
import * as path from "node:path";

/**
 * sharp is not a declared dependency: it arrives as a dependency of next, which
 * uses it for image optimisation. Say that plainly instead of dying on a bare
 * module-not-found, since the fix is "run npm install", not "go find a package".
 */
let sharp;
try {
  ({ default: sharp } = await import("sharp"));
} catch {
  console.error(
    "This script needs sharp. It ships as a dependency of next, so `npm install` in the repo root provides it."
  );
  process.exit(1);
}

const ROOT = process.cwd();
const SRC = process.argv[2];

if (!SRC) {
  console.error("usage: node scripts/make-icons.mjs <source.svg|source.png>");
  process.exit(1);
}

const isSvg = path.extname(SRC).toLowerCase() === ".svg";

/** Render the source at a square size. Density is raised for SVG so edges stay crisp. */
async function png(size) {
  return sharp(SRC, isSvg ? { density: 384 } : {})
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/**
 * Build an ICO container. Modern Windows accepts PNG-encoded entries directly,
 * so each entry is just a PNG blob behind a 16-byte directory record.
 */
function buildIco(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(entries.length, 4);

  const dir = Buffer.alloc(16 * entries.length);
  let offset = 6 + 16 * entries.length;

  entries.forEach(({ size, buf }, i) => {
    const at = i * 16;
    // 0 encodes 256 in the ICO directory.
    dir.writeUInt8(size >= 256 ? 0 : size, at);
    dir.writeUInt8(size >= 256 ? 0 : size, at + 1);
    dir.writeUInt8(0, at + 2); // palette entries
    dir.writeUInt8(0, at + 3); // reserved
    dir.writeUInt16LE(1, at + 4); // colour planes
    dir.writeUInt16LE(32, at + 6); // bits per pixel
    dir.writeUInt32LE(buf.length, at + 8);
    dir.writeUInt32LE(offset, at + 12);
    offset += buf.length;
  });

  return Buffer.concat([header, dir, ...entries.map((e) => e.buf)]);
}

async function write(rel, data) {
  const abs = path.join(ROOT, rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, data);
  const kb = (data.length / 1024).toFixed(1);
  console.log(`  ${rel.padEnd(26)} ${String(kb).padStart(7)} KB`);
}

async function main() {
  await fs.access(SRC);
  console.log(`source: ${SRC}${isSvg ? " (vector)" : " (raster)"}\n`);

  const renders = {};
  for (const size of [512, 192, 180, 48, 32, 16]) {
    renders[size] = await png(size);
  }

  await write("app/icon.png", renders[512]);
  await write("app/apple-icon.png", renders[180]);
  await write("public/icon-192.png", renders[192]);
  await write("public/icon-32.png", renders[32]);

  if (isSvg) {
    const svg = await fs.readFile(SRC);
    await write("app/icon.svg", svg);
    await write("public/favicon.svg", svg);
  } else {
    console.log("  (raster source: skipping app/icon.svg)");
  }

  // 48 is the size browsers show in tabs; 16 and 32 cover taskbar and bookmarks.
  await write("app/favicon.ico", buildIco([48, 32, 16].map((size) => ({ size, buf: renders[size] }))));

  // Remove the create-next-app placeholder if it is still around under another name.
  for (const stale of ["public/favicon.ico"]) {
    await fs.rm(path.join(ROOT, stale), { force: true }).catch(() => {});
  }

  console.log("\ndone. Restart the dev server and hard-reload: browsers cache favicons hard.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
