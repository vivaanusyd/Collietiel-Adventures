import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

// Generates responsive, modern-format copies of every review photo.
//
// WHY THIS EXISTS RATHER THAN ASTRO'S <Image>
//
// Astro's image pipeline only handles files it can see as ES imports —
// anything under src/. Our photos live in public/ and have to, for two
// reasons that aren't negotiable: the CMS writes uploads there, and the map
// popups are built by client-side JS which can only consume a plain URL.
// Files in public/ are copied verbatim and never touched by the optimiser.
//
// The result before this script: a 4 MB photo straight off a phone was sent
// at full resolution to every reader, including a phone on mobile data
// rendering it 380px wide. For an image-heavy food blog that's the single
// worst thing on the page.
//
// So: pre-generate the variants at build time and let a <picture> element
// pick. Runs as part of `prebuild`, so it happens on Netlify too.
//
// IDEMPOTENT AND CACHED — it skips any variant already newer than its
// source, so a rebuild with no new photos costs nothing. That matters
// because this runs on every deploy.

const root = fileURLToPath(new URL('..', import.meta.url));
const SOURCE_DIR = path.join(root, 'public', 'images', 'reviews');
const OUT_DIR = path.join(SOURCE_DIR, 'optimized');

// The widths a photo can actually be displayed at on this site, from a
// full-bleed hero on a large desktop down to a gallery thumbnail on a
// phone. Not a generic ladder — every number corresponds to a real slot in
// the layout, because generating sizes nothing requests is just slower
// builds and a bigger repo.
const WIDTHS = [400, 800, 1200, 1600, 2000];

// WebP over AVIF: AVIF encodes smaller but is dramatically slower to
// encode, and this runs on every deploy inside Netlify's build minutes.
// WebP is universally supported and ~30% smaller than equivalent JPEG.
const FORMATS = [
  { ext: 'webp', options: { quality: 80, effort: 4 } },
  // JPEG fallback stays, because <picture> needs a <img src> that works
  // everywhere and an RSS reader or an email client may not do WebP.
  { ext: 'jpg', options: { quality: 82, progressive: true, mozjpeg: true } },
];

const SOURCE_EXT = /\.(jpe?g|png|webp)$/i;

/** Has `target` already been built from a `source` that hasn't changed? */
async function isFresh(source, target) {
  if (!existsSync(target)) return false;
  const [s, t] = await Promise.all([fs.stat(source), fs.stat(target)]);
  return t.mtimeMs >= s.mtimeMs;
}

async function processImage(file) {
  const source = path.join(SOURCE_DIR, file);
  const base = file.replace(SOURCE_EXT, '');
  const image = sharp(source);
  const meta = await image.metadata();

  let built = 0;

  for (const width of WIDTHS) {
    // Never upscale. Enlarging a 900px photo to 2000px adds bytes and
    // removes nothing but sharpness — the browser would rather have the
    // real 900px file.
    if (meta.width && width > meta.width) continue;

    for (const { ext, options } of FORMATS) {
      const target = path.join(OUT_DIR, `${base}-${width}.${ext}`);
      if (await isFresh(source, target)) continue;

      await image
        .clone()
        .resize({ width, withoutEnlargement: true })
        .toFormat(ext === 'jpg' ? 'jpeg' : ext, options)
        .toFile(target);
      built++;
    }
  }

  // Record the intrinsic dimensions so the site can set width/height on the
  // <img> without re-reading every file at render time. Without these the
  // page reflows as each photo loads, which is the layout-shift readers
  // experience as text jumping under their thumb.
  return {
    file,
    base,
    width: meta.width ?? null,
    height: meta.height ?? null,
    built,
  };
}

async function main() {
  if (!existsSync(SOURCE_DIR)) {
    console.log('[optimize-images] no public/images/reviews — nothing to do');
    return;
  }

  await fs.mkdir(OUT_DIR, { recursive: true });

  const files = (await fs.readdir(SOURCE_DIR)).filter((f) => SOURCE_EXT.test(f));

  if (files.length === 0) {
    // Still write the manifest, so the site imports a real (empty) object
    // rather than failing on a missing file.
    await fs.writeFile(path.join(OUT_DIR, 'manifest.json'), '{}\n');
    console.log('[optimize-images] no source images yet');
    return;
  }

  const results = [];
  for (const file of files) {
    try {
      results.push(await processImage(file));
    } catch (error) {
      // One unreadable file (a truncated upload, a mislabelled .jpg that's
      // actually HEIC) shouldn't fail the whole deploy. Warn, skip it, and
      // let the site fall back to serving the original.
      console.warn(`[optimize-images] skipped ${file}: ${error.message}`);
    }
  }

  const manifest = Object.fromEntries(
    results.map((r) => [
      `/images/reviews/${r.file}`,
      {
        base: r.base,
        width: r.width,
        height: r.height,
        widths: WIDTHS.filter((w) => !r.width || w <= r.width),
      },
    ])
  );

  await fs.writeFile(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

  const builtCount = results.reduce((sum, r) => sum + r.built, 0);
  console.log(
    `[optimize-images] ${results.length} image(s), ${builtCount} variant(s) generated` +
      (builtCount === 0 ? ' (all cached)' : '')
  );
}

await main();
