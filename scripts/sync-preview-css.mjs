import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Copies src/styles/global.css to public/admin/preview.css so the CMS's live
// preview pane renders with the REAL site stylesheet.
//
// WHY A COPY AND NOT A LINK
//
// Astro bundles and content-hashes global.css into /_astro/hoisted.<hash>.css.
// The hash changes on every edit, so the CMS — which is a plain static page
// outside Astro's build — has no stable URL to point at. The alternatives
// were: hand-maintain a second stylesheet for the preview (two sources of
// truth for the same palette, guaranteed to drift the first time a colour
// changes), or stop bundling global.css for everyone to suit the editor.
//
// Generating the copy on every build costs nothing and keeps ONE stylesheet
// authoritative. The output is gitignored precisely so nobody edits it and
// expects the change to stick — edit src/styles/global.css.
//
// Runs as npm's `prebuild`, so it happens on Netlify too without anyone
// remembering to run it.

const root = fileURLToPath(new URL('..', import.meta.url));
const source = path.join(root, 'src', 'styles', 'global.css');
const target = path.join(root, 'public', 'admin', 'preview.css');

const banner = `/* GENERATED FILE — DO NOT EDIT.
 *
 * Copied from src/styles/global.css by scripts/sync-preview-css.mjs on every
 * build, so the CMS preview pane matches the live site. Edit the source file;
 * anything you change here is overwritten on the next build.
 */

`;

// The preview pane renders review content on its own, without the site's
// nav or footer chrome, and without <body> being the page. Scoping rules
// aren't needed — Sveltia injects this into the preview iframe — but the
// body background does need to apply, which it does as written.
const css = fs.readFileSync(source, 'utf8');

fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, banner + css);

console.log(`[sync-preview-css] ${path.relative(root, source)} -> ${path.relative(root, target)}`);
