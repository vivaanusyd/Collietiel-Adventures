import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { defineConfig } from 'astro/config';
import { remarkEmotionIcons } from './src/lib/remark-emotion-icons.mjs';

// Serves the Claude Design editor prototype (layout-editor/) at
// /dev/editor — DEV SERVER ONLY. The 'astro:server:setup' hook never runs
// during `astro build`, so nothing from this folder can reach the live
// site: the prototype is a design playground for Vivaan, not a page for
// writers or readers. It stays in the repo (rather than public/, which
// ships) precisely so it can be served here and nowhere else.
const devDesignEditor = {
  name: 'dev-design-editor',
  hooks: {
    'astro:server:setup': ({ server }) => {
      const root = new URL('./layout-editor/', import.meta.url).pathname;
      const types = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'text/javascript; charset=utf-8',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
      };
      server.middlewares.use('/dev/editor', async (req, res, next) => {
        try {
          // Without the trailing slash the page's relative './support.js'
          // resolves to /dev/support.js and 404s — leaving the raw template
          // (a page full of {{ placeholders }}) instead of the editor.
          if (req.originalUrl === '/dev/editor') {
            res.statusCode = 302;
            res.setHeader('Location', '/dev/editor/');
            return res.end();
          }
          const raw = decodeURIComponent((req.url || '/').split('?')[0]);
          // The bare route opens the newest prototype.
          const name = raw === '/' || raw === '' ? '/Blog Editor v2.dc.html' : raw;
          const path = normalize(join(root, name));
          if (!path.startsWith(root)) return next(); // no escaping the folder
          const body = await readFile(path);
          res.setHeader('Content-Type', types[extname(path)] ?? 'application/octet-stream');
          res.end(body);
        } catch {
          next();
        }
      });
    },
  },
};

// The Sunday Table editor ships as public/desk/index.html and any static
// host resolves /desk/ to it — but Vite's dev server doesn't do directory
// indexes for public/ files, so in dev the bare URL 404s and the page
// "looks broken" (the same trailing-slash trap /dev/editor hit). Redirect
// only that exact URL; everything else is untouched.
const devDeskIndex = {
  name: 'dev-desk-index',
  hooks: {
    'astro:server:setup': ({ server }) => {
      server.middlewares.use((req, res, next) => {
        if ((req.url || '').split('?')[0] === '/desk/') {
          res.statusCode = 302;
          res.setHeader('Location', '/desk/index.html');
          return res.end();
        }
        next();
      });
    },
  },
};

// Static output — no server needed. Both Netlify and Vercel detect Astro
// automatically and build this with their zero-config static presets
// (Netlify: `astro build` -> publish `dist/`; Vercel: Astro preset).
// If you later add a form handler or auth, that's when an adapter
// (@astrojs/netlify or @astrojs/vercel) would become necessary.
export default defineConfig({
  // Canonical URLs, RSS links, the sitemap and social preview images all
  // derive from this. If you later move to a custom domain, change it here
  // and in the Sitemap: line of public/robots.txt — those are the only two
  // places the domain is written down.
  site: 'https://collietiel-adventures.netlify.app',
  output: 'static',
  integrations: [devDesignEditor, devDeskIndex],
  markdown: {
    // Lets reviews write `:collie-smiling:` inline. See the plugin file.
    remarkPlugins: [remarkEmotionIcons],
  },
});
