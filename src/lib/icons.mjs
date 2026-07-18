import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Icons live in public/icons/ rather than src/, because the Markdown
// shortcode (:collie-smiling:) is rewritten by a remark plugin that runs
// before Vite's asset pipeline exists — it can only emit a plain URL. Since
// there's no way to have BOTH bundled assets and Markdown shortcodes, one
// folder for every icon beat two folders with different rules.
//
// The tradeoff: /public files aren't content-hashed, so a browser can serve
// a stale icon after you overwrite one. If that ever bites, either rename
// the file or set cache headers on /icons/* at your host.

// Resolving this is fiddlier than it looks. This module runs in two very
// different places:
//
//   1. From SOURCE, during config load and dev — where `../../public/icons/`
//      relative to this file is correct.
//   2. From BUNDLED BUILD OUTPUT, when a page renders Markdown at build time
//      (src/lib/markdown.ts does this for text blocks). There, import.meta.url
//      points inside dist/, and the relative path resolves to a folder that
//      doesn't exist.
//
// Case 2 failed loudly — "no PNG in public/icons/" listing every icon that
// plainly does exist. So try the source-relative path first and fall back to
// the project root, and fail with a message that says where it actually
// looked rather than asserting the files are missing.
const ICON_DIR_CANDIDATES = [
  fileURLToPath(new URL('../../public/icons/', import.meta.url)),
  path.join(process.cwd(), 'public', 'icons'),
];

let iconDir = null;

function getIconDir() {
  if (iconDir === null) {
    iconDir = ICON_DIR_CANDIDATES.find((dir) => fs.existsSync(dir));
    if (!iconDir) {
      throw new Error(
        `Could not locate public/icons/. Looked in:\n  ${ICON_DIR_CANDIDATES.join('\n  ')}`
      );
    }
  }
  return iconDir;
}

let cache = null;

export function availableIcons() {
  if (cache === null) {
    cache = fs
      .readdirSync(getIconDir())
      .filter((f) => f.endsWith('.png'))
      .map((f) => f.slice(0, -4))
      .sort();
  }
  return cache;
}

export function hasIcon(name) {
  return availableIcons().includes(name);
}

/** Site-root URL for an icon, throwing at build time if the file is absent. */
export function iconPath(name) {
  if (!hasIcon(name)) {
    throw new Error(
      `Icon "${name}" not found in public/icons/.\n  Available: ${availableIcons().join(', ')}`
    );
  }
  return `/icons/${name}.png`;
}
