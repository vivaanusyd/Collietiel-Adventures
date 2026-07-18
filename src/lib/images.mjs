import fs from 'node:fs';
import path from 'node:path';
import { publicDir } from './public-files.mjs';

// Reads the manifest written by scripts/optimize-images.mjs and turns a
// source path into the srcset strings a <picture> needs.
//
// Split out from Picture.astro so the map — which builds popups in
// client-side JS and can't use an Astro component — can get the same
// optimised URL through the same lookup, rather than hardcoding the
// filename pattern in a second place.

let manifestCache = null;

function loadManifest() {
  if (manifestCache !== null) return manifestCache;

  const manifestPath = path.join(publicDir(), 'images', 'reviews', 'optimized', 'manifest.json');

  try {
    manifestCache = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch {
    // No manifest yet — the optimiser hasn't run, which is normal on a
    // fresh clone before the first build. Empty means every caller falls
    // back to the original file, so the site still works.
    manifestCache = {};
  }

  return manifestCache;
}

/**
 * Variants for a site-root image path, or null if there are none.
 *
 * Null is a legitimate answer, not an error: a photo uploaded seconds ago
 * in dev has no variants until the optimiser next runs.
 */
export function imageVariants(src) {
  if (!src) return null;

  const entry = loadManifest()[src];
  if (!entry || entry.widths.length === 0) return null;

  const url = (width, ext) => `/images/reviews/optimized/${entry.base}-${width}.${ext}`;
  const srcset = (ext) => entry.widths.map((w) => `${url(w, ext)} ${w}w`).join(', ');

  // Largest generated width as the plain `src`. It's what a browser without
  // srcset support gets, so it should be the one that always looks right —
  // too large is recoverable, too small is visibly blurry.
  const largest = entry.widths[entry.widths.length - 1];

  return {
    webpSrcset: srcset('webp'),
    jpgSrcset: srcset('jpg'),
    fallback: url(largest, 'jpg'),
    width: entry.width,
    height: entry.height,
  };
}

/**
 * One reasonably-sized URL for contexts that can't use a srcset — the map
 * popup, and the Open Graph image social scrapers fetch.
 *
 * 800px because a map popup renders about 200px wide (so 800 covers a 3x
 * display) and because social cards are usually rendered around 600px.
 */
export function imageUrl(src, width = 800) {
  const entry = loadManifest()[src];
  if (!entry) return src;

  const best = entry.widths.find((w) => w >= width) ?? entry.widths[entry.widths.length - 1];
  return `/images/reviews/optimized/${entry.base}-${best}.jpg`;
}
