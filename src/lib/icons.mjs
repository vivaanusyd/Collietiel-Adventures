import fs from 'node:fs';
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

const ICON_DIR = fileURLToPath(new URL('../../public/icons/', import.meta.url));

let cache = null;

export function availableIcons() {
  if (cache === null) {
    cache = fs
      .readdirSync(ICON_DIR)
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
