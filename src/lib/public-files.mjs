import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Where public/ actually is, and whether a given site-root path exists in it.
//
// Files under public/ are copied to the site root verbatim and are NOT
// touched by Vite's asset pipeline. That's what makes `/images/reviews/x.jpg`
// work identically in Markdown frontmatter, in a component, and in the
// client-side JS that builds map popups — but it also means NOTHING checks
// that the file is really there. A typo'd filename builds clean and ships a
// broken image, which is only discovered by a reader.
//
// So the check has to be explicit. src/lib/icons.mjs does this for icons;
// this module generalises the directory lookup so covers and in-review
// images get it too, from one implementation.
//
// .mjs for the same reason as emotions.mjs — imported by both the remark
// plugin (plain Node, before TS compilation) and Astro code.

// Resolving public/ is fiddlier than it looks, because this module runs in
// two places: from SOURCE during config load and dev, where the path
// relative to this file is right; and from BUNDLED BUILD OUTPUT when a page
// renders at build time, where import.meta.url points inside dist/ and the
// relative path resolves to a folder that doesn't exist. Try both, and fail
// saying where we looked rather than claiming the files are missing.
const PUBLIC_DIR_CANDIDATES = [
  fileURLToPath(new URL('../../public/', import.meta.url)),
  path.join(process.cwd(), 'public'),
];

let publicDirCache = null;

/** Absolute path to the project's public/ directory. */
export function publicDir() {
  if (publicDirCache === null) {
    publicDirCache = PUBLIC_DIR_CANDIDATES.find((dir) => fs.existsSync(dir));
    if (!publicDirCache) {
      throw new Error(
        `Could not locate public/. Looked in:\n  ${PUBLIC_DIR_CANDIDATES.join('\n  ')}`
      );
    }
  }
  return publicDirCache;
}

/**
 * Does a site-root path like "/images/reviews/x.jpg" exist in public/?
 *
 * Only meaningful for local paths. Anything absolute (http://, //cdn...) is
 * reported as existing, because this module has no business asserting
 * whether someone else's server has a file.
 */
export function publicFileExists(sitePath) {
  if (!sitePath || /^(https?:)?\/\//.test(sitePath)) return true;

  // Strip any query or fragment before hitting the filesystem — "x.jpg?v=2"
  // is a real thing to write and is not a filename.
  const clean = sitePath.split(/[?#]/)[0];
  return fs.existsSync(path.join(publicDir(), clean.replace(/^\//, '')));
}
